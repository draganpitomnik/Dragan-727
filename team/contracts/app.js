/* DRAGAN Manager — модуль договоров поставки.
   Данные клиентов в GitHub не хранятся: заявка приходит в ссылке после #, реестр — в Supabase (RLS). */
(function () {
  'use strict';
  var TPL = window.DG_TPL, SET = window.DG_SETTINGS, B = window.DG_DOCX;
  var $ = function (id) { return document.getElementById(id); };
  var URL_ = 'https://abudsqoclurrtrtqlkvz.supabase.co';
  var KEY = 'sb_publishable_KD9NLO5_HEtI_g6-Bv6anA_YyFDAbXA';
  var identities = { 'natalia.pitomnik@gmail.com': 'Наталья', 'vasilina.pitomnik@gmail.com': 'Василина' };
  var client = null, me = null, order = null, items = [], seller = 'too';

  // ---------- даты ----------
  function todayISO() { return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Almaty' }).format(new Date()); }
  function ru(iso) { if (!iso) return ''; var p = String(iso).slice(0, 10).split('-'); return p[2] + '.' + p[1] + '.' + p[0]; }
  // Праздники РК (ТК РК). Курбан айт — по году; переносы постановлениями правительства не учтены — дату возврата можно поправить вручную.
  var FIXED = ['01-01', '01-02', '01-07', '03-08', '03-21', '03-22', '03-23', '05-01', '05-07', '05-09', '07-06', '08-30', '10-25', '12-16'];
  var NO_SHIFT = { '01-07': 1 };
  var KURBAN = { 2026: '05-27', 2027: '05-16', 2028: '05-05' };
  function isoOf(d) { return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }
  function holidaySet(y) {
    var s = {}, add = function (md, shift) {
      var d = new Date(y + '-' + md + 'T00:00:00'); s[isoOf(d)] = 1;
      if (shift && (d.getDay() === 0 || d.getDay() === 6)) { do { d.setDate(d.getDate() + 1); } while (d.getDay() === 0 || d.getDay() === 6 || s[isoOf(d)]); s[isoOf(d)] = 1; }
    };
    FIXED.forEach(function (md) { add(md, !NO_SHIFT[md]); });
    if (KURBAN[y]) add(KURBAN[y], false);
    return s;
  }
  function addWorkdays(iso, n) {
    var d = new Date(iso + 'T00:00:00'), h = Object.assign(holidaySet(d.getFullYear()), holidaySet(d.getFullYear() + 1));
    while (n > 0) { d.setDate(d.getDate() + 1); if (d.getDay() !== 0 && d.getDay() !== 6 && !h[isoOf(d)]) n--; }
    return isoOf(d);
  }

  // ---------- сообщения ----------
  function msg(id, text, kind) { var e = $(id); e.className = 'msg ' + (kind || 'info'); e.textContent = text; }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function v(id) { return ($(id).value || '').trim(); }

  // ---------- заявка ----------
  function decodeOrder(hash) {
    var m = String(hash || '').match(/[#&]o=([^&]+)/); if (!m) return null;
    try { var b = m[1].replace(/-/g, '+').replace(/_/g, '/'); while (b.length % 4) b += '='; return JSON.parse(decodeURIComponent(escape(atob(b)))); } catch (e) { return null; }
  }
  function loadOrder(o) {
    if (!o || !o.i || !o.i.length) return false;
    order = o; order.c = order.c || {};
    items = o.i.map(function (a) { return { p: String(a[0]), t: String(a[1] || ''), q: Math.max(0, parseInt(a[2], 10) || 0), c: Math.max(0, Math.round(+a[3]) || 0), size: '' }; })
      .filter(function (x) { return x.q > 0; });
    $('order-box').classList.remove('hidden'); $('order-paste').classList.add('hidden');
    $('order-box').innerHTML = '<b>Заявка №' + esc(o.n) + '</b>' + (o.d ? ' от ' + esc(o.d) : '') + (o.m ? ' · менеджер ' + esc(o.m) : '') +
      '<br>Заказчик: ' + esc(o.c.fn || '—') + ' · ' + esc(o.c.ct || '—') + ' · ' + esc(o.c.ph || '—') + '<br>Позиций: ' + items.length;
    if (o.c.ph && !v('b-phone')) $('b-phone').value = o.c.ph;
    if (o.c.ct && !v('c-dest')) $('c-dest').value = o.c.ct;
    renderItems(); return true;
  }
  function renderItems() {
    var s = TPL.sellers[seller];
    if (!items.length) { $('items').innerHTML = '<tr><td colspan="7" style="color:var(--muted)">Загрузите заявку</td></tr>'; $('totals').innerHTML = ''; return; }
    $('items').innerHTML = items.map(function (x, i) {
      return '<tr><td>' + (i + 1) + '</td><td>' + esc(x.p) + '</td><td class="hm">' + esc(x.t) + '</td><td><input data-i="' + i + '" class="sz" value="' + esc(x.size) + '" placeholder="40–60 см" style="width:110px"></td><td class="r">' + x.q + '</td><td class="r">' + B.money(x.c) + '</td><td class="r">' + B.money(x.q * x.c) + '</td></tr>';
    }).join('');
    var t = B.totals(items, s);
    $('totals').innerHTML = 'Итого: ' + B.money(t.sum) + ' ₸ ' + (s.vat ? '<span>в т.ч. НДС ' + t.rate + '%: ' + B.money(t.vat, 2) + ' ₸</span>' : '<span>без НДС</span>');
    $('vat-note').textContent = s.vat ? 'с НДС 16%' : '— для ИП НДС не выделяется';
  }

  // ---------- форма ----------
  function setSeller(sv) {
    seller = sv;
    document.querySelectorAll('[data-seller]').forEach(function (b) { b.setAttribute('aria-pressed', String(b.getAttribute('data-seller') === sv)); });
    renderItems();
  }
  function toggles() {
    var f = $('b-form').value;
    document.querySelectorAll('.other-form').forEach(function (e) { e.classList.toggle('hidden', f !== 'other'); });
    var m = $('c-method').value;
    document.querySelector('.carrier-f').classList.toggle('hidden', m !== 'carrier');
    $('c-pick').closest('label').classList.toggle('hidden', m !== 'pickup');
    document.querySelector('.dsum-f').classList.toggle('hidden', $('c-dcost').value !== 'separate');
    $('basis-doc-l').classList.toggle('hidden', $('b-basis').value === 'charter');
  }

  function initials(fio) {
    var p = fio.split(/\s+/).filter(Boolean); if (!p.length) return '';
    return p[0] + (p[1] ? ' ' + p[1][0] + '.' : '') + (p[2] ? p[2][0] + '.' : '');
  }

  function buyer() {
    var f = $('b-form').value, F = TPL.buyerForms[f], name = v('b-name');
    var nameRu, nameKz;
    if (f === 'other') { nameRu = v('b-name-ru'); nameKz = v('b-name-kz'); }
    else if (F && name) { nameRu = F.ru + ' «' + name + '»'; nameKz = '«' + name + '» ' + F.kz; }
    var pos = TPL.positions[$('b-pos').value], bs = TPL.bases[$('b-basis').value], doc = v('b-basis-doc');
    var fio = v('b-fio'), gen = v('b-fio-gen');
    return { form: f, nameRu: nameRu || '', nameKz: nameKz || '',
      signRu: gen ? pos.ru + ' ' + gen : '', signKz: fio ? pos.kz + ' ' + fio : '',
      basisRu: B.fill(bs.ru, { BASIS_DOC: doc }), basisKz: B.fill(bs.kz, { BASIS_DOC: doc }),
      bin: v('b-bin'), address: v('b-address'), bank: v('b-bank'), iik: v('b-iik').toUpperCase(), bik: v('b-bik').toUpperCase(), kbe: v('b-kbe'),
      email: v('b-email'), phone: v('b-phone'), signerName: initials(fio), fio: fio };
  }

  function conds() {
    var s = TPL.sellers[seller], t = B.totals(items, s), pct = Math.min(100, Math.max(0, parseFloat(v('c-pct')) || 0)), days = parseInt(v('c-days'), 10) || 3;
    var pre = Math.round(t.sum * pct) / 100, rest = Math.round((t.sum - pre) * 100) / 100;
    var M = TPL.methods[$('c-method').value], P = TPL.packaging[$('c-pack').value];
    var from = ru(v('c-from')), to = ru(v('c-to')), term = from && to && to !== from ? from + '–' + to : from;
    var place = { CARRIER: v('c-carrier'), DEST: v('c-dest') };
    var dc = $('c-dcost').value, dcost = {
      na: 'қолданылмайды / не применяется', included: 'Тауар бағасына кіреді / входит в цену Товара',
      separate: (v('c-dsum') ? B.money(+v('c-dsum')) : '[ ]') + ' теңге, бөлек төленеді / оплачивается отдельно', buyer: 'Сатып алушының есебінен / за счёт Покупателя' }[dc];
    var rows = [
      ['Алдын ала төлем / Предоплата', pct > 0 ? pct + '% — ' + B.money(pre, 2) + ' теңге; шот ұсынылған күннен бастап ' + days + ' банктік күн ішінде / в течение ' + days + ' банковских дней со дня выставления счёта'
        : 'алдын ала төлемсіз; толық сома Тауар берілгенге (тасымалдаушыға тапсырылғанға) дейін төленеді / без предоплаты; полная оплата до передачи Товара (сдачи перевозчику)'],
      ['Қалған сома / Остаток', pct >= 100 ? 'жоқ / отсутствует' : B.money(rest, 2) + ' теңге — Тауар берілгенге немесе тасымалдаушыға тапсырылғанға дейін / до передачи Товара либо до сдачи перевозчику'],
      ['Беру мерзімі / Срок передачи', term],
      ['Алу тәсілі / Способ получения', M.kz + ' / ' + M.ru],
      ['Беру орны / Место передачи', B.fill(M.placeKz, place) + ' / ' + B.fill(M.placeRu, place)],
    ];
    if ($('c-method').value !== 'pickup' || v('c-dest')) rows.push(['Межелі жер, алушы / Пункт назначения, получатель', v('c-dest')]);
    if ($('c-method').value === 'pickup') { var pk = parseInt(v('c-pick'), 10) || 3; rows.push(['Алып кету мерзімі / Срок выборки', 'дайындық туралы хабарламадан кейін ' + pk + ' күнтізбелік күн / ' + pk + ' календарных дней после уведомления о готовности']); }
    rows.push(['Қаптама / Упаковка', P.kz + ' / ' + P.ru]);
    rows.push(['Жеткізу құны / Стоимость доставки', dcost]);
    var spr = v('c-sp-ru'), spk = v('c-sp-kz');
    rows.push(['Ерекше коммерциялық талаптар / Особые коммерческие условия', spr || spk ? (spk || '[ ]') + ' / ' + (spr || '[ ]') : 'жоқ / нет']);
    return { rows: rows, term: term, pct: pct, total: t.sum };
  }

  function collect(draft) {
    var b = buyer(), c = conds();
    return { seller: seller, draft: draft, buyer: b, items: items.map(function (x) { return { p: x.p, t: x.t, q: x.q, c: x.c, size: x.size }; }),
      conds: c.rows, term: c.term, total: c.total, sellerContacts: SET.sellerContacts, ipTalon: SET.ipTalon,
      order: order ? { n: order.n, d: order.d, m: order.m, c: order.c } : null, inputs: snapshotInputs() };
  }
  function snapshotInputs() { var o = {}; document.querySelectorAll('#view-new input[id],#view-new select[id],#view-new textarea[id]').forEach(function (e) { if (e.id !== 'order-link') o[e.id] = e.value; }); return o; }

  // Проверки перед регистрацией. Возвращает список ошибок и подсвечивает поля.
  function validate() {
    var errs = [], bad = function (id, t) { $(id).classList.add('bad'); errs.push(t); };
    document.querySelectorAll('.bad').forEach(function (e) { e.classList.remove('bad'); });
    var f = $('b-form').value;
    if (f === 'person') errs.push('Физлицу без ИП этот договор не подходит (это розничная продажа). Оформите обычный счёт/накладную.');
    if (f === 'gov') errs.push('Для госзакупок подписывается типовой договор заказчика, не этот.');
    if (!items.length) errs.push('Нет позиций: загрузите заявку.');
    if (f === 'other') { if (!v('b-name-ru')) bad('b-name-ru', 'Наименование на русском'); if (!v('b-name-kz')) bad('b-name-kz', 'Наименование на казахском'); }
    else if (!v('b-name')) bad('b-name', 'Название покупателя');
    if (!/^\d{12}$/.test(v('b-bin'))) bad('b-bin', 'БИН/ИИН — 12 цифр');
    if (!v('b-address')) bad('b-address', 'Юридический адрес');
    if (!v('b-bank')) bad('b-bank', 'Банк');
    if (!/^KZ[0-9A-Z]{18}$/i.test(v('b-iik'))) bad('b-iik', 'ИИК: KZ и 18 знаков');
    if (!/^[A-Z0-9]{8}([A-Z0-9]{3})?$/i.test(v('b-bik'))) bad('b-bik', 'БИК: 8 знаков');
    if (!/^\d{2}$/.test(v('b-kbe'))) bad('b-kbe', 'КБе: 2 цифры');
    if (!/^\S+@\S+\.\S+$/.test(v('b-email'))) bad('b-email', 'E-mail для уведомлений');
    if ((v('b-phone').replace(/\D/g, '')).length < 10) bad('b-phone', 'Телефон/WhatsApp');
    if (v('b-fio').split(/\s+/).length < 2) bad('b-fio', 'ФИО подписанта полностью');
    if (v('b-fio-gen').split(/\s+/).length < 2) bad('b-fio-gen', 'ФИО в родительном падеже');
    if ($('b-basis').value !== 'charter' && !v('b-basis-doc')) bad('b-basis-doc', '№ и дата документа-основания');
    var pct = parseFloat(v('c-pct')); if (!(pct >= 0 && pct <= 100)) bad('c-pct', 'Предоплата 0–100%');
    if (!v('c-from')) bad('c-from', 'Дата передачи');
    if (v('c-to') && v('c-to') < v('c-from')) bad('c-to', 'Конец периода раньше начала');
    if ($('c-method').value === 'carrier' && !v('c-carrier')) bad('c-carrier', 'Перевозчик и терминал');
    if ($('c-method').value !== 'pickup' && !v('c-dest')) bad('c-dest', 'Пункт назначения, получатель');
    if ($('c-dcost').value === 'separate' && !(+v('c-dsum') > 0)) bad('c-dsum', 'Сумма доставки');
    if (!!v('c-sp-ru') !== !!v('c-sp-kz')) bad(v('c-sp-ru') ? 'c-sp-kz' : 'c-sp-ru', 'Особые условия — на обоих языках');
    if (seller === 'ip' && !SET.ipTalon) errs.push('Для ИП не заполнен талон в настройках (settings.js) — сообщите владельцу.');
    return errs;
  }

  function download(doc, name) {
    return window.docx.Packer.toBlob(doc).then(function (blob) {
      var a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name.replace(/[\\/:*?"<>|]+/g, '_') + '.docx';
      document.body.appendChild(a); a.click(); setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 1500);
    });
  }
  function shortName(data) { return (data.buyer.nameRu || 'покупатель').slice(0, 40); }

  function draft() {
    if (!items.length) { msg('msg-new', 'Сначала загрузите заявку.', 'err'); return; }
    var d = collect(true); d.date = ru(todayISO());
    download(B.buildContract(TPL, d), 'ПРОЕКТ_Договор_' + shortName(d)).then(function () { msg('msg-new', 'Проект скачан. Красные [ ] в файле — незаполненные поля.', 'ok'); });
  }

  function register() {
    var errs = validate();
    if (errs.length) { msg('msg-new', 'Не хватает данных: ' + errs.join('; ') + '.', 'err'); return; }
    var d = collect(false);
    if (!confirm('Зарегистрировать договор ' + (seller === 'too' ? 'ТОО' : 'ИП') + ' с «' + d.buyer.nameRu + '» на ' + B.money(d.total) + ' ₸?\nНомер присваивается навсегда, изменить договор после этого нельзя.')) return;
    $('btn-register').disabled = true; msg('msg-new', 'Регистрируем…', 'info');
    client.rpc('dg_register_contract', { p_seller: seller, p_template_version: TPL.version, p_order_no: order ? String(order.n || '') : null,
      p_buyer_name: d.buyer.nameRu, p_total: d.total, p_payload: d })
      .then(function (r) {
        if (r.error) throw r.error;
        var row = r.data[0]; d.number = row.number; d.date = ru(row.contract_date);
        return download(B.buildContract(TPL, d), 'Договор_' + row.number + '_' + shortName(d)).then(function () {
          msg('msg-new', 'Готово: договор № ' + row.number + ' от ' + d.date + ' зарегистрирован и скачан.', 'ok');
        });
      })
      .catch(function (e) {
        var t = String(e && (e.message || e.details) || e);
        if (/dg_register_contract|function .* does not exist|schema cache/i.test(t)) t = 'Реестр ещё не подключён в Supabase (нужно выполнить team/sql/contracts_v1.sql). Проект можно скачать без номера.';
        msg('msg-new', 'Не зарегистрировано: ' + t, 'err');
      })
      .finally(function () { $('btn-register').disabled = false; });
  }

  // ---------- реестр ----------
  var regRows = [], regDocs = {};
  function loadRegistry() {
    $('reg-list').textContent = 'Загрузка…';
    client.from('contracts').select('id,number,seller,contract_date,buyer_name,total,status,status_note,order_no,template_version,payload,created_at').order('created_at', { ascending: false }).limit(100)
      .then(function (r) {
        if (r.error) throw r.error; regRows = r.data || [];
        if (!regRows.length) { $('reg-list').innerHTML = '<p class="sub">Пока нет зарегистрированных договоров.</p>'; return; }
        return client.from('contract_docs').select('id,contract_id,kind,number,doc_date,payload').in('contract_id', regRows.map(function (x) { return x.id; })).order('created_at')
          .then(function (q) { if (q.error) throw q.error; regDocs = {}; (q.data || []).forEach(function (d) { (regDocs[d.contract_id] = regDocs[d.contract_id] || []).push(d); }); renderRegistry(); });
      })
      .catch(function (e) {
        var t = String(e && e.message || e);
        $('reg-list').innerHTML = '<p class="sub">' + (/relation .*contracts|does not exist|schema cache/i.test(t) ? 'Реестр ещё не подключён в Supabase: владелец должен один раз выполнить team/sql/contracts_v1.sql.' : 'Ошибка загрузки: ' + esc(t)) + '</p>';
      });
  }
  var STATUS = { registered: 'действует', cancelled: 'отменён', annulled: 'аннулирован' };
  function renderRegistry() {
    $('reg-list').innerHTML = regRows.map(function (c) {
      var docs = (regDocs[c.id] || []).map(function (d) { return '<a href="#" data-doc="' + d.id + '">' + esc(d.number) + '</a> (' + ru(d.doc_date) + ')'; }).join(', ');
      var live = c.status === 'registered';
      return '<div class="reg" data-id="' + c.id + '"><div><span class="num">' + esc(c.number) + '</span><span class="st ' + c.status + '">' + STATUS[c.status] + '</span>' +
        '<div class="meta">' + ru(c.contract_date) + ' · ' + esc(c.buyer_name) + ' · ' + B.money(c.total) + ' ₸' + (c.order_no ? ' · заявка №' + esc(c.order_no) : '') + (c.template_version !== TPL.version ? ' · текст ред. ' + esc(c.template_version) : '') + (c.status_note ? ' · ' + esc(c.status_note) : '') + '</div>' +
        (docs ? '<div class="docs">Документы: ' + docs + '</div>' : '') + '<div class="sub-form hidden"></div></div>' +
        '<div class="acts"><button class="btn small alt" data-act="docx">DOCX</button>' + (live ? '<button class="btn small alt" data-act="ds">Перенос срока</button><button class="btn small alt" data-act="cancel">Отмена заказа</button><button class="btn small alt" data-act="annul">Аннулировать</button>' : '') + '</div></div>';
    }).join('');
  }
  function contractData(c) { var d = Object.assign({}, c.payload); d.number = c.number; d.date = ru(c.contract_date); d.draft = false; return d; }

  function regClick(e) {
    var a = e.target.closest('[data-doc]');
    if (a) { e.preventDefault(); return redownloadDoc(a.getAttribute('data-doc')); }
    var btn = e.target.closest('[data-act]'); if (!btn) return;
    var box = btn.closest('.reg'), c = regRows.filter(function (x) { return x.id === box.getAttribute('data-id'); })[0], act = btn.getAttribute('data-act');
    if (act === 'docx') {
      if (c.template_version !== TPL.version) alert('Договор зарегистрирован по тексту ред. ' + c.template_version + ', сейчас действует ред. ' + TPL.version + '. Файл соберётся по текущему тексту — для подписи используйте ранее скачанный экземпляр.');
      return download(B.buildContract(TPL, contractData(c)), 'Договор_' + c.number);
    }
    if (act === 'annul') {
      var why = prompt('Аннулировать ' + c.number + '? Только для ошибочной регистрации (договор не подписан). Номер останется занятым.\nПричина:');
      if (!why) return;
      return client.rpc('dg_annul_contract', { p_contract: c.id, p_reason: why }).then(function (r) { if (r.error) throw r.error; loadRegistry(); }).catch(function (e2) { msg('msg-reg', String(e2.message || e2), 'err'); });
    }
    var f = box.querySelector('.sub-form'); f.classList.remove('hidden');
    f.innerHTML = act === 'ds' ? dsForm(c) : cancelForm(c);
    f.querySelector('[data-go]').onclick = function () { (act === 'ds' ? submitDs : submitCancel)(c, f); };
    f.querySelector('[data-close]').onclick = function () { f.classList.add('hidden'); f.innerHTML = ''; };
    if (act === 'cancel') {
      var upd = function () {
        var paid = +f.querySelector('[name=paid]').value || 0, del = +f.querySelector('[name=delivered]').value || 0;
        f.querySelector('[name=refund]').value = Math.max(0, paid - del);
        var n = f.querySelector('[name=notice]').value; if (n) f.querySelector('[name=rdate]').value = addWorkdays(n, 10);
      };
      f.querySelectorAll('[name=paid],[name=delivered],[name=notice]').forEach(function (i) { i.oninput = upd; }); upd();
    }
  }
  function dsForm(c) {
    return '<b>Допсоглашение о переносе срока</b><div class="grid" style="margin-top:8px">' +
      '<label>Причина<select name="reason"><option value="weather">Погода</option><option value="plants">Состояние растений</option><option value="buyer">Просьба покупателя</option></select></label>' +
      '<label>Дата уведомления / обращения<input type="date" name="notice" value="' + todayISO() + '"></label>' +
      '<label>Новый срок: с<input type="date" name="from"></label><label>по <small>(если период)</small><input type="date" name="to"></label>' +
      '<label class="full">Позиции <small>(пусто — все позиции; иначе номера строк спецификации: 1, 3, 5)</small><input name="pos"></label></div>' +
      '<p class="lock">Прежний срок: ' + esc(c.payload.term || '—') + '. Покупатель отвечает 3 дня; если допсоглашение не подписано 7 дней — каждая сторона вправе отказаться от непереданной части (п. 6.4).</p>' +
      '<div class="actions"><button class="btn small" data-go>Зарегистрировать и скачать</button><button class="btn small alt" data-close>Закрыть</button></div>';
  }
  function cancelForm(c) {
    return '<b>Подтверждение отказа и возврата предоплаты</b><div class="grid" style="margin-top:8px">' +
      '<label>Дата получения уведомления покупателя<input type="date" name="notice" value="' + todayISO() + '"></label>' +
      '<label>Объём<select name="scope"><option value="full">Весь заказ</option><option value="partial">Часть позиций</option></select></label>' +
      '<label class="full">Позиции <small>(для частичной: номера строк спецификации)</small><input name="pos"></label>' +
      '<label>Получено предоплаты, теңге<input type="number" name="paid" min="0"></label><label>Стоимость уже переданного товара, теңге<input type="number" name="delivered" min="0" value="0"></label>' +
      '<label>К возврату, теңге <small>(без удержаний)</small><input type="number" name="refund" readonly></label><label>Вернуть не позднее <small>(10 раб. дней, проверьте)</small><input type="date" name="rdate"></label></div>' +
      '<div class="actions"><button class="btn small" data-go>Зарегистрировать и скачать</button><button class="btn small alt" data-close>Закрыть</button></div>';
  }
  function fv(f, n) { var e = f.querySelector('[name=' + n + ']'); return e ? (e.value || '').trim() : ''; }

  function submitDs(c, f) {
    var R = TPL.dsReasons[fv(f, 'reason')], from = fv(f, 'from'), to = fv(f, 'to'), notice = fv(f, 'notice'), pos = fv(f, 'pos');
    if (!from) { alert('Укажите новый срок.'); return; }
    var nt = ru(from) + (to && to !== from ? '–' + ru(to) : ''), buyerReq = fv(f, 'reason') === 'buyer';
    var vars = { SPEC_NO: '1', REASON_KZ: R.kz, REASON_RU: R.ru,
      NOTICE_KZ: buyerReq ? ' Сатып алушының өтініші ' + ru(notice) + ' алынды.' : ' Жеткізушінің хабарламасы ' + ru(notice) + ' жіберілді.',
      NOTICE_RU: buyerReq ? ' Обращение Покупателя получено ' + ru(notice) + '.' : ' Уведомление Поставщика направлено ' + ru(notice) + '.',
      SCOPE_KZ: pos ? 'Спецификацияның ' + pos + ' позициялары бойынша' : 'барлық позициялар бойынша', SCOPE_RU: pos ? 'по позициям Спецификации ' + pos : 'по всем позициям',
      NEW_TERM: nt, OLD_TERM: c.payload.term || '[ ]' };
    regDoc(c, 'ds', { vars: vars, reason: fv(f, 'reason'), notice: notice, newTerm: nt, positions: pos }, function (row) {
      return B.buildDs(TPL, contractData(c), { number: row.number, date: ru(row.doc_date), vars: vars });
    });
  }
  function submitCancel(c, f) {
    var scope = fv(f, 'scope'), pos = fv(f, 'pos'), notice = fv(f, 'notice'), paid = +fv(f, 'paid'), del = +fv(f, 'delivered') || 0, rdate = fv(f, 'rdate');
    if (!(paid >= 0) || fv(f, 'paid') === '') { alert('Укажите полученную предоплату (0, если не было).'); return; }
    if (scope === 'partial' && !pos) { alert('Для частичной отмены укажите позиции.'); return; }
    var b = c.payload.buyer, refund = Math.max(0, paid - del);
    var vars = { NOTICE_DATE: ru(notice), SCOPE_KZ: scope === 'full' ? 'толық көлемде' : 'Спецификацияның ' + pos + ' позициялары бөлігінде',
      SCOPE_RU: scope === 'full' ? 'полностью' : 'в части позиций Спецификации ' + pos,
      PAID: B.money(paid, 2), DELIVERED: B.money(del, 2), REFUND: B.money(refund, 2), REFUND_DATE: ru(rdate),
      BANK: b.bank + ', ЖСК/ИИК ' + b.iik + ', БСК/БИК ' + b.bik };
    regDoc(c, 'cancel', { vars: vars, scope: scope, positions: pos, notice: notice, paid: paid, delivered: del, refund: refund, refundDate: rdate }, function (row) {
      return B.buildCancel(TPL, contractData(c), { number: row.number, date: ru(row.doc_date), vars: vars });
    });
  }
  function regDoc(c, kind, payload, build) {
    if (!confirm('Зарегистрировать ' + (kind === 'ds' ? 'допсоглашение' : 'подтверждение отмены') + ' к ' + c.number + '? Номер присвоится навсегда.')) return;
    client.rpc('dg_register_contract_doc', { p_contract: c.id, p_kind: kind, p_payload: payload })
      .then(function (r) { if (r.error) throw r.error; var row = r.data[0]; return download(build(row), row.number).then(function () { msg('msg-reg', 'Готово: ' + row.number + ' зарегистрирован и скачан.', 'ok'); loadRegistry(); }); })
      .catch(function (e) { msg('msg-reg', 'Не зарегистрировано: ' + String(e.message || e), 'err'); });
  }
  function redownloadDoc(id) {
    var c, d;
    regRows.forEach(function (x) { (regDocs[x.id] || []).forEach(function (y) { if (y.id === id) { c = x; d = y; } }); });
    if (!d) return;
    var o = { number: d.number, date: ru(d.doc_date), vars: d.payload.vars };
    download(d.kind === 'ds' ? B.buildDs(TPL, contractData(c), o) : B.buildCancel(TPL, contractData(c), o), d.number);
  }

  // ---------- вход: тот же Supabase, что у кабинета ----------
  function locked(t) { document.body.className = 'auth-locked'; $('who').textContent = t; }
  function start() {
    $('tpl-ver').textContent = TPL.version;
    if (!window.supabase || !window.docx) { locked('Не загрузились модули. Проверьте интернет и обновите страницу.'); return; }
    client = window.supabase.createClient(URL_, KEY, { auth: { persistSession: true, autoRefreshToken: true } });
    client.auth.getUser().then(function (u) {
      var user = u.data && u.data.user; if (!user) { locked('Вы не вошли'); return; }
      return client.from('staff_access').select('role,active').eq('user_id', user.id).maybeSingle().then(function (r) {
        var a = r.data; if (r.error || !a || !a.active || ['admin', 'manager'].indexOf(a.role) < 0) { locked('Доступ запрещён'); return; }
        me = { id: user.id, role: a.role, name: a.role === 'admin' ? 'Администратор' : (identities[(user.email || '').toLowerCase()] || user.email) };
        $('who').textContent = me.name; document.body.className = 'auth-ok';
        if (me.role === 'admin') $('reg-sub').textContent = 'Администратор видит все договоры.';
      });
    }).catch(function () { locked('Ошибка проверки доступа'); });
  }

  // ---------- события ----------
  document.querySelectorAll('[data-seller]').forEach(function (b) { b.onclick = function () { setSeller(b.getAttribute('data-seller')); }; });
  ['b-form', 'c-method', 'c-dcost', 'b-basis'].forEach(function (id) { $(id).addEventListener('change', toggles); });
  $('b-form').addEventListener('change', function () {
    var f = $('b-form').value;
    if (f === 'ip') { $('b-pos').value = 'ip'; $('b-basis').value = 'talon'; }
    if (f === 'kh') { $('b-pos').value = 'head'; $('b-basis').value = 'kh'; }
    if (f === 'too' || f === 'ao') { $('b-pos').value = 'director'; $('b-basis').value = 'charter'; }
    if (f === 'person' || f === 'gov') msg('msg-new', f === 'person' ? 'Физлицу без ИП договор поставки не оформляем.' : 'Для госзакупок — типовой договор заказчика.', 'err');
    toggles();
  });
  $('items').addEventListener('input', function (e) { if (e.target.classList.contains('sz')) items[+e.target.getAttribute('data-i')].size = e.target.value; });
  $('order-load').onclick = function () { if (!loadOrder(decodeOrder(v('order-link')))) msg('msg-new', 'Ссылка не похожа на заявку (нет части #o=…).', 'err'); };
  $('btn-draft').onclick = draft; $('btn-register').onclick = register;
  $('tab-new').onclick = function () { $('view-new').classList.remove('hidden'); $('view-reg').classList.add('hidden'); $('tab-new').setAttribute('aria-pressed', 'true'); $('tab-reg').setAttribute('aria-pressed', 'false'); };
  $('tab-reg').onclick = function () { $('view-reg').classList.remove('hidden'); $('view-new').classList.add('hidden'); $('tab-reg').setAttribute('aria-pressed', 'true'); $('tab-new').setAttribute('aria-pressed', 'false'); if (client) loadRegistry(); };
  $('reg-list').addEventListener('click', regClick);
  $('c-from').value = todayISO();
  toggles(); setSeller('too'); loadOrder(decodeOrder(location.hash)); start();
})();
