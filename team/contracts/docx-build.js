/* DRAGAN — сборка DOCX договора, допсоглашения и подтверждения отмены.
   Работает в браузере (глобальный docx из docx@9.8.1) и в Node (для проверки). */
(function (root) {
  'use strict';
  var NAVY = '14283F', CREAM = 'F5F0E7';
  var D = null;
  function lib() { return D || (D = root.docx || (typeof require === 'function' ? require('docx') : null)); }

  function fill(text, vars) {
    return String(text).replace(/\{\{([A-Z_]+)\}\}/g, function (_, k) {
      var v = vars[k];
      return v === undefined || v === null || String(v).trim() === '' ? '[ ]' : String(v);
    });
  }

  // **жирный**, [пустое поле] — выделено цветом
  function runs(text, o) {
    var d = lib(); o = o || {}; var out = [], re = /(\*\*[^*]+\*\*|\[ \])/g, last = 0, m;
    var base = { font: 'Arial', size: o.size || 17, bold: o.bold, italics: o.italic, color: o.color };
    while ((m = re.exec(text))) {
      if (m.index > last) out.push(new d.TextRun(Object.assign({}, base, { text: text.slice(last, m.index) })));
      var t = m[0];
      if (t.indexOf('**') === 0) out.push(new d.TextRun(Object.assign({}, base, { text: t.slice(2, -2), bold: true })));
      else out.push(new d.TextRun(Object.assign({}, base, { text: t, color: 'B42318', shading: { type: d.ShadingType.CLEAR, fill: 'FDECEA', color: 'auto' } })));
      last = m.index + t.length;
    }
    if (last < text.length) out.push(new d.TextRun(Object.assign({}, base, { text: text.slice(last) })));
    return out;
  }
  function P(text, o) {
    var d = lib(); o = o || {};
    return new d.Paragraph({ alignment: o.align || d.AlignmentType.LEFT, keepNext: o.keepNext,
      spacing: { before: o.before || 0, after: o.after === undefined ? 40 : o.after, line: o.line || 228 }, children: runs(text, o) });
  }
  function border(b) { return { top: b, bottom: b, left: b, right: b }; }
  function C(paras, width, o) {
    var d = lib(); o = o || {};
    var thin = { style: d.BorderStyle.SINGLE, size: 4, color: 'BFBFBF' }, none = { style: d.BorderStyle.NONE, size: 0, color: 'FFFFFF' };
    return new d.TableCell({ width: { size: width, type: d.WidthType.DXA }, columnSpan: o.span,
      shading: o.fill ? { type: d.ShadingType.CLEAR, fill: o.fill, color: 'auto' } : undefined,
      borders: border(o.noBorder ? none : thin), margins: { top: 30, bottom: 30, left: 70, right: 70 },
      children: Array.isArray(paras) ? paras : [paras] });
  }
  function T(rows, widths) {
    var d = lib();
    return new d.Table({ width: { size: widths.reduce(function (a, b) { return a + b; }, 0), type: d.WidthType.DXA }, columnWidths: widths, rows: rows });
  }
  var W = 10466, H = W / 2;
  function row2(a, b, o) { var d = lib(); return new d.TableRow({ cantSplit: true, children: [C(a, H, o), C(b, H, o)] }); }
  function bi(items, vars) {
    return T(items.map(function (it) {
      if (it.h) return row2(P(it.h[0], { bold: true, color: NAVY, size: 18, after: 0 }), P(it.h[1], { bold: true, color: NAVY, size: 18, after: 0 }), { fill: CREAM });
      var kz = fill(it.kz, vars), ru = fill(it.ru, vars);
      if (it.n) { kz = '**' + it.n + '.** ' + kz; ru = '**' + it.n + '.** ' + ru; }
      return row2(P(kz, { after: 10 }), P(ru, { after: 10 }));
    }), [H, H]);
  }
  function title(kz, ru, sub) {
    var d = lib(); var s = sub ? sub.split('|') : null;
    var cell = function (t, i) {
      var c = [P(t, { bold: true, size: 22, color: NAVY, align: d.AlignmentType.CENTER, after: 10 })];
      if (s) c.push(P(s[i], { align: d.AlignmentType.CENTER, size: 17 }));
      return C(c, H, { noBorder: true });
    };
    return T([new d.TableRow({ children: [cell(kz, 0), cell(ru, 1)] })], [H, H]);
  }
  function gap(a) { var d = lib(); return new d.Paragraph({ spacing: { after: a || 100 }, children: [] }); }
  function note(t) { return P(t, { size: 15, italic: true, color: '7A6A4A', after: 60 }); }
  function signRow(left, right) {
    var d = lib();
    return T([new d.TableRow({ children: [
      C([P('Жеткізуші / Поставщик', { bold: true }), P(' ', { after: 120 }), P('____________ ' + left)], H, { noBorder: true }),
      C([P('Сатып алушы / Покупатель', { bold: true }), P(' ', { after: 120 }), P('____________ ' + right)], H, { noBorder: true }),
    ] })], [H, H]);
  }
  function money(n, dec) {
    var v = Number(n) || 0;
    return v.toLocaleString('ru-RU', { minimumFractionDigits: dec || 0, maximumFractionDigits: dec || 0 }).replace(/ /g, ' ');
  }

  // НДС выделяется построчно из цены с НДС: сумма × ставка / (100 + ставка), до тиын.
  function totals(items, seller) {
    var s = seller.vat ? seller.vatRate : 0, sum = 0, vat = 0;
    items.forEach(function (x) {
      var line = Math.round(x.q * x.c * 100) / 100; sum += line;
      if (s) vat += Math.round(line * s / (100 + s) * 100) / 100;
    });
    return { sum: Math.round(sum * 100) / 100, vat: Math.round(vat * 100) / 100, rate: s };
  }

  function buyerVars(b) {
    return { BUYER_NAME_KZ: b.nameKz, BUYER_NAME_RU: b.nameRu, BUYER_SIGNATORY_KZ: b.signKz, BUYER_SIGNATORY_RU: b.signRu,
      BUYER_BASIS_KZ: b.basisKz, BUYER_BASIS_RU: b.basisRu };
  }
  function document_(children, footerText) {
    var d = lib();
    return new d.Document({
      styles: { default: { document: { run: { font: 'Arial', size: 17 } } } },
      sections: [{ properties: { page: { size: { width: 11906, height: 16838 }, margin: { top: 680, bottom: 680, left: 720, right: 720 } } },
        footers: { default: new d.Footer({ children: [new d.Paragraph({ alignment: d.AlignmentType.CENTER, children: [
          new d.TextRun({ text: footerText + ' · ', font: 'Arial', size: 14, color: '7F7F7F' }),
          new d.TextRun({ children: [d.PageNumber.CURRENT], font: 'Arial', size: 14, color: '7F7F7F' })] })] }) },
        children: children }] });
  }

  function requisites(tpl, data) {
    var d = lib(), s = tpl.sellers[data.seller], b = data.buyer, v = { SELLER_EMAIL: data.sellerContacts.email, SELLER_PHONE: data.sellerContacts.phone };
    var col = function (head, lines, sign) {
      return [P(head, { bold: true, color: NAVY })].concat(lines.map(function (l) { return P(fill(l, v), { size: 16, after: 10 }); }),
        [P(' ', { after: 140 }), P('Қолы / Подпись: ____________ ' + sign, { size: 16 })]);
    };
    var bl = [b.nameKz + ' / ' + b.nameRu, 'БСН/ЖСН / БИН/ИИН: ' + (b.bin || '[ ]'), 'Мекенжайы / Адрес: ' + (b.address || '[ ]'),
      'Банк: ' + (b.bank || '[ ]'), 'ЖСК / ИИК: ' + (b.iik || '[ ]'), 'БСК / БИК: ' + (b.bik || '[ ]'), 'КБе: ' + (b.kbe || '[ ]'),
      'E-mail: ' + (b.email || '[ ]'), 'WhatsApp / тел.: ' + (b.phone || '[ ]')];
    return T([new d.TableRow({ cantSplit: true, children: [
      C(col('ЖЕТКІЗУШІ / ПОСТАВЩИК', s.lines, s.sign), H), C(col('САТЫП АЛУШЫ / ПОКУПАТЕЛЬ', bl, b.signerName || '[ ]'), H)] })], [H, H]);
  }

  function specTable(tpl, data) {
    var d = lib(), s = tpl.sellers[data.seller], tt = totals(data.items, s);
    var w = [400, 2900, 1450, 1200, 650, 700, 1550, 1616];
    var hd = ['№', 'Өсімдік атауы және сорты / Наименование растения и сорт', 'Тамыр жүйесі, контейнер / Корневая система, контейнер', 'Өлшемі / Размер', 'Өлш. бірл. / Ед.', 'Саны / Кол-во', 'Бағасы, теңге / Цена, теңге', 'Сомасы, теңге / Сумма, теңге'];
    var row = function (cells, o) {
      o = o || {};
      return new d.TableRow({ cantSplit: true, tableHeader: o.head, children: cells.map(function (c, i) {
        return C(P(String(c), { size: 16, bold: o.bold, align: i >= 5 ? d.AlignmentType.RIGHT : d.AlignmentType.LEFT, after: 0 }), w[i], { fill: o.fill }); }) });
    };
    var rows = [row(hd, { bold: true, fill: CREAM, head: true })];
    data.items.forEach(function (x, i) { rows.push(row([i + 1, x.p, x.t || '—', x.size || '—', 'дана / шт.', x.q, money(x.c), money(x.q * x.c)])); });
    var span = w.slice(0, 7).reduce(function (a, b) { return a + b; }, 0);
    var tot = function (label, val, bold) {
      return new d.TableRow({ children: [C(P(label, { bold: bold, size: 16, align: d.AlignmentType.RIGHT, after: 0 }), span, { span: 7 }), C(P(val, { bold: bold, size: 16, align: d.AlignmentType.RIGHT, after: 0 }), w[7])] });
    };
    rows.push(tot('Барлығы / Итого, теңге:', money(tt.sum), true));
    rows.push(s.vat ? tot('оның ішінде ҚҚС ' + tt.rate + '% / в т.ч. НДС ' + tt.rate + '%:', money(tt.vat, 2)) : tot('ҚҚС-сыз / Без НДС', '—'));
    return T(rows, w);
  }

  function condTable(conds) {
    var d = lib(), cw = [3300, W - 3300];
    return T(conds.map(function (r) {
      return new d.TableRow({ cantSplit: true, children: [C(P(r[0], { bold: true, size: 16, after: 0 }), cw[0], { fill: CREAM }), C(P(r[1] || '[ ]', { size: 16, after: 0 }), cw[1])] });
    }), cw);
  }

  // ---------- Договор + Спецификация №1 ----------
  function buildContract(tpl, data) {
    var d = lib(), vars = Object.assign(buyerVars(data.buyer), { IP_TALON: data.ipTalon });
    var items = tpl.contract.map(function (it) { return it; });
    if (data.seller === 'ip') {
      items[0] = tpl.ip.preamble;
      items = items.map(function (it) { return it.n && tpl.ip[it.n] ? Object.assign({ n: it.n }, tpl.ip[it.n]) : it; });
    }
    var num = data.number || '[ ]', date = data.date || '[ ]';
    var head = data.draft ? [note('ПРОЕКТ — номер не присвоен, не для подписания. Текст ред. ' + tpl.version + '. Красные [ ] — незаполненные поля.')] : [];
    var children = head.concat([
      title('ТАУАР ЖЕТКІЗУ ШАРТЫ № ' + num, 'ДОГОВОР ПОСТАВКИ № ' + num, 'Есік қ. · ' + date + '|г. Есик · ' + date),
      gap(60), bi(items, vars), gap(40), requisites(tpl, data),
      new d.Paragraph({ children: [new d.PageBreak()] }),
      title('№1 ҚОСЫМША. СПЕЦИФИКАЦИЯ № 1', 'ПРИЛОЖЕНИЕ №1. СПЕЦИФИКАЦИЯ № 1', date + ' №' + num + ' Тауар жеткізу шартына|к Договору поставки № ' + num + ' от ' + date),
      gap(60), specTable(tpl, data), gap(80), condTable(data.conds), gap(80),
      P('Спецификация Шарттың ажырамас бөлігі болып табылады, қазақ және орыс тілдерінде жасалды, екі мәтіннің заңдық күші бірдей. / Спецификация является неотъемлемой частью Договора, составлена на казахском и русском языках, оба текста имеют одинаковую силу.', { size: 15, italic: true }),
      gap(60), signRow(tpl.sellers[data.seller].sign, data.buyer.signerName || '[ ]'),
    ]);
    return document_(children, 'Шарт / Договор № ' + num + ' · ред. ' + tpl.version);
  }

  // ---------- Допсоглашение о переносе ----------
  function buildDs(tpl, c, ds) {
    var num = ds.number || '[ ]';
    var children = [
      title('№ ' + num + ' ҚОСЫМША КЕЛІСІМ', 'ДОПОЛНИТЕЛЬНОЕ СОГЛАШЕНИЕ № ' + num,
        c.date + ' №' + c.number + ' Тауар жеткізу шартына · Есік қ., ' + (ds.date || '[ ]') + '|к Договору поставки № ' + c.number + ' от ' + c.date + ' · г. Есик, ' + (ds.date || '[ ]')),
      gap(60), bi(tpl.ds, ds.vars), gap(140), signRow(tpl.sellers[c.seller].sign, c.buyer.signerName || '[ ]'),
    ];
    return document_(children, 'Қосымша келісім / Доп. соглашение № ' + num);
  }

  // ---------- Подтверждение отмены ----------
  function buildCancel(tpl, c, x) {
    var num = x.number || '[ ]';
    var children = [
      title('ТАПСЫРЫСТАН БАС ТАРТУДЫ ЖӘНЕ АЛДЫН АЛА ТӨЛЕМДІ ҚАЙТАРУДЫ РАСТАУ № ' + num, 'ПОДТВЕРЖДЕНИЕ ОТКАЗА ОТ ЗАКАЗА И ВОЗВРАТА ПРЕДОПЛАТЫ № ' + num,
        c.date + ' №' + c.number + ' Тауар жеткізу шартына · ' + (x.date || '[ ]') + '|к Договору поставки № ' + c.number + ' от ' + c.date + ' · ' + (x.date || '[ ]')),
      gap(60), bi(tpl.cancel, x.vars), gap(140),
      T([new (lib().TableRow)({ children: [C([P('Жеткізуші / Поставщик', { bold: true }), P(' ', { after: 120 }), P('____________ ' + tpl.sellers[c.seller].sign)], H, { noBorder: true }), C(P(' '), H, { noBorder: true })] })], [H, H]),
    ];
    return document_(children, 'Растау / Подтверждение № ' + num);
  }

  root.DG_DOCX = { buildContract: buildContract, buildDs: buildDs, buildCancel: buildCancel, totals: totals, money: money, fill: fill };
  if (typeof module !== 'undefined') module.exports = root.DG_DOCX;
})(typeof window !== 'undefined' ? window : globalThis);
