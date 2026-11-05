/* Dragan — страница менеджера v3 (05.11.2026): при подтверждении клиенту заказ сам записывается в реестр (робот n8n «Реестр заказов v1»).
   Dragan — страница менеджера v2 (04.11.2026): скидка на весь заказ ИЛИ по позициям (%), новая цена вручную; опт — доп. скидка только с согласия Романа.
   Dragan — страница менеджера: обработка заявки клиента и лист подбора.
   Данные заявки приходят в ссылке после знака #. v3: при согласовании заказ уходит роботу реестра (n8n питомника). */
(function () {
  var VAT = "";   // розница: НДС не упоминаем; опт — ниже (VAT_OPT)
  var VAT_OPT = "цены без НДС; для плательщиков НДС +16% (счёт-фактура от ТОО)";
  var CLIENT_PAGE = "zakaz.html";   // страница «Ваш заказ» для клиента: состав, скидки, итог, PDF
  var $ = function (i) { return document.getElementById(i); };
  var f = function (n) { return Math.round(n).toLocaleString("ru-RU"); };
  var esc = function (s) { return String(s).replace(/[&<>"]/g, function (c) { return {"&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;"}[c]; }); };
  var D, L = [], disc = 0;
  // v3: авто-запись в реестр заказов. Адрес — «Production URL» узла «Заявка согласована (webhook)» в n8n.
  var REG_URL = "https://pitomnik.app.n8n.cloud/webhook/dragan-reestr-zakazov-v1-k7q2m";
  var REG_KEY = "dragan-reestr-v1";
  var regSent = "";

  function decode() {
    var m = location.hash.match(/[#&]o=([^&]+)/);
    if (!m) return null;
    try {
      var b = m[1].replace(/-/g, "+").replace(/_/g, "/"); while (b.length % 4) b += "=";
      return JSON.parse(decodeURIComponent(escape(atob(b))));
    } catch (e) { return null; }
  }
  function fmtDate(d) { return (d || new Date()).toLocaleDateString("ru-RU", {day: "numeric", month: "long", year: "numeric"}); }
  function waPhone(p) { var d = String(p || "").replace(/\D/g, ""); if (d.length === 11 && d[0] === "8") d = "7" + d.slice(1); if (d.length === 10) d = "7" + d; return d; }

  function totals() {
    var t = 0, t0 = 0, n = 0;
    L.forEach(function (x) { if (x.q > 0) { t += x.q * x.c; t0 += x.q * x.b; n++; } });
    return {t: t, t0: t0, n: n};
  }
  function render() {
    $("rows").innerHTML = L.map(function (x, i) {
      return '<article class="row' + (x.q > 0 ? " has" : "") + '" data-i="' + i + '" style="' + (x.q > 0 ? "" : "opacity:.55") + '"><div class="n">' + (i + 1) + '</div><div class="nm">' + esc(x.p) + '<span class="tp">' + esc(x.t) + '</span>' +
        (x.q !== x.q0 ? '<br><small style="color:#a8322a">запрошено: ' + x.q0 + " шт" + (x.q === 0 ? " · нет в наличии" : "") + "</small>" : "") + '</div><div class="ty">' + esc(x.t) + '</div>' +
        '<div class="pr"><input class="pi" type="number" min="0" inputmode="numeric" value="' + x.c + '" aria-label="Цена"' + ' style="width:96px;height:40px;border:1px solid #e3dccd;border-radius:8px;text-align:right;font-size:16px;padding:0 8px">' + (x.c !== x.b ? '<br><small><s>' + f(x.b) + "</s> " + pct(x) + "</small>" : "") +
        '<br><label style="font-size:12px;color:#6b7280;white-space:nowrap">скидка <input class="di" type="text" inputmode="decimal" placeholder="' + (disc || 0) + '" value="' + (x.d != null ? x.d : "") + '" aria-label="Скидка на позицию, %" style="width:46px;height:30px;border:1px solid #e3dccd;border-radius:6px;text-align:right;font-size:14px;padding:0 4px"> %</label></div>' +
        '<div class="qt"><button type="button" data-d="-1" aria-label="Меньше">−</button><input class="qi" type="number" min="0" inputmode="numeric" value="' + x.q + '" aria-label="Количество"><button type="button" data-d="1" aria-label="Больше">+</button></div><div class="sm"></div></article>';
    }).join("");
    calc();
  }
  function calc() {
    var r = totals();
    document.querySelectorAll("#rows .row").forEach(function (row) {
      var x = L[+row.getAttribute("data-i")];
      row.querySelector(".sm").textContent = x.q > 0 ? f(x.q * x.c) + " ₸" : "";
    });
    $("tt").textContent = f(r.t) + " ₸";
    $("sv").textContent = r.t0 > r.t ? "Скидка: −" + f(r.t0 - r.t) + " ₸ (от " + f(r.t0) + " ₸)" : "";
    $("cnt").textContent = "Позиций к сборке: " + r.n;
  }
  function pct(x) { var p = x.b ? Math.round((1 - x.c / x.b) * 1000) / 10 : 0; return p > 0 ? "−" + String(p).replace(".", ",") + "%" : p < 0 ? "+" + String(-p).replace(".", ",") + "%" : ""; }
  function price(x) { return x.man ? x.c : Math.round(x.b * (1 - (x.d != null ? x.d : disc) / 100)); }   // своя скидка позиции важнее общей; цена вручную — важнее всех
  function reprice() { L.forEach(function (x) { x.c = price(x); }); }
  function isOpt() { return D.k === "opt"; }
  function okOpt() { return !isOpt() || !L.some(function (x) { return x.q > 0 && x.c < x.b; }) || ($("okr") && $("okr").checked); }
  function missing() { return L.filter(function (x) { return x.q < x.q0; }); }
  function note() { return $("cm").value.trim(); }

  function vatNote() { return isOpt() ? VAT_OPT : VAT; }
  // v2: ссылка на страницу «Ваш заказ» — состав, скидки, итог (телефон клиента в ссылку не кладём)
  function clientLink() {
    var o = {n: D.n, d: fmtDate(), m: D.m || "", k: D.k || "retail", c: {fn: D.c.fn || "", ct: D.c.ct || ""}, cm: note(),
      i: L.filter(function (x) { return x.q > 0; }).map(function (x) { return [x.p, x.t, x.q, x.b, x.c, x.q0]; }),
      x: missing().filter(function (x) { return x.q === 0; }).map(function (x) { return x.p + " (" + x.t + ")"; })};
    var b = btoa(unescape(encodeURIComponent(JSON.stringify(o)))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
    return new URL(CLIENT_PAGE, location.href).href + "#o=" + b;
  }
  // v2 (решение Романа 04.11.2026): клиенту — коротко: согласован, сумма, скидка, итог + ссылка на состав заказа
  function clientText() {
    var r = totals(), mi = missing().filter(function (x) { return x.q === 0; }), ch = L.filter(function (x) { return x.q > 0 && x.q < x.q0; });
    var t = "Здравствуйте" + (D.c.fn ? ", " + D.c.fn : "") + "! Ваш заказ №" + D.n + " согласован.\n" +
      (r.t0 > r.t ? "Сумма по прайсу: " + f(r.t0) + " ₸\nСкидка: −" + f(r.t0 - r.t) + " ₸\n" : "") +
      "Итого к оплате: " + f(r.t) + " ₸" + (vatNote() ? " (" + vatNote() + ")" : "");
    if (mi.length || ch.length) t += "\nЕсть изменения по наличию — они отмечены в составе заказа.";
    if (note()) t += "\n" + note();
    return t + "\nСостав заказа: " + clientLink();
  }
  function sheet() {
    var r = totals(), u = 0, rows = "", k = 0;
    L.forEach(function (x) { if (x.q > 0) { k++; u += x.q; rows += "<tr><td>" + k + "</td><td>" + esc(x.p) + "</td><td>" + esc(x.t) + '</td><td class="c">' + x.q + '</td><td class="r">' + f(x.c) + '</td><td class="r">' + f(x.q * x.c) + '</td><td class="c">☐</td></tr>'; } });
    var mi = missing().filter(function (x) { return x.q === 0; });
    return "<h2>Лист подбора · заявка №" + esc(D.n) + "</h2><div class=\"shm\">Согласовано: " + fmtDate() + (D.m ? " · менеджер " + esc(D.m) : "") + "<br>Заказчик: <b>" + esc(D.c.fn) + "</b><br>Город: <b>" + esc(D.c.ct) + "</b><br>Телефон: <b>" + esc(D.c.ph) + "</b><br>Цены согласованы" + (vatNote() ? ", " + vatNote() : "") + "</div>" +
      '<table class="st"><thead><tr><th>№</th><th>Наименование</th><th>Тип</th><th>Кол-во</th><th>Цена, ₸</th><th>Сумма, ₸</th><th>Собрано</th></tr></thead><tbody>' + rows + "</tbody></table>" +
      '<div class="shm">Позиций: ' + k + " · Всего единиц: " + u + (r.t0 > r.t ? "<br>Сумма по прайсу: " + f(r.t0) + " ₸<br>Скидка: −" + f(r.t0 - r.t) + " ₸" : "") + "<br>К оплате: <b>" + f(r.t) + " ₸</b>" +
      (mi.length ? "<br>Нет в наличии (не собирать): " + esc(mi.map(function (x) { return x.p + " (" + x.t + ")"; }).join(", ")) : "") + (note() ? "<br>Примечание: " + esc(note()) : "") + "</div>";
  }

  D = decode();
  if (!D || !D.i || !D.i.length) {
    $("main").innerHTML = '<div class="empty" style="padding:40px 0">Заявка не найдена: ссылка повреждена или обрезана. Попросите клиента отправить заявку ещё раз.</div>';
    return;
  }
  D.c = D.c || {};
  L = D.i.map(function (a) { var c = Math.round(+a[3]) || 0; return {p: String(a[0]), t: String(a[1]), q0: Math.max(0, parseInt(a[2], 10) || 0), q: Math.max(0, parseInt(a[2], 10) || 0), b: c, c: c}; });
  $("on").textContent = "№" + D.n + " · " + (D.d || "") + " · " + (isOpt() ? "оптовый прайс" : "розничный прайс");
  if ($("optbox")) $("optbox").style.display = isOpt() ? "" : "none";
  $("fn").value = D.c.fn || ""; $("ct").value = D.c.ct || ""; $("ph").value = D.c.ph || "";
  ["fn", "ct", "ph"].forEach(function (i) { $(i).oninput = function () { D.c[i] = this.value; }; });

  var rows = $("rows");
  rows.addEventListener("click", function (e) {
    var b = e.target.closest("button[data-d]"); if (!b) return;
    var row = b.closest(".row"), x = L[+row.getAttribute("data-i")];
    x.q = Math.max(0, x.q + parseInt(b.getAttribute("data-d"), 10)); render();
  });
  rows.addEventListener("change", function (e) {
    var row = e.target.closest(".row"); if (!row) return;
    var x = L[+row.getAttribute("data-i")], v = Math.max(0, parseInt(e.target.value, 10) || 0);
    if (e.target.classList.contains("qi")) x.q = v;
    else if (e.target.classList.contains("pi")) { x.c = v; x.man = v !== price(Object.assign({}, x, {man: false})); }
    else if (e.target.classList.contains("di")) { var s = String(e.target.value).trim(); x.d = s === "" ? null : Math.min(100, Math.max(0, parseFloat(s.replace(",", ".")) || 0)); x.man = false; x.c = price(x); }
    render();
  });
  $("ds").oninput = function () {
    disc = Math.min(100, Math.max(0, parseFloat(this.value.replace(",", ".")) || 0));
    reprice(); render();
  };
  $("reset").onclick = function () { disc = 0; $("ds").value = ""; L.forEach(function (x) { x.q = x.q0; x.c = x.b; x.d = null; x.man = false; }); render(); };
  $("pdf").onclick = function () { if (!totals().n) { alert("Нет позиций к сборке."); return; } $("os").innerHTML = sheet(); document.body.classList.add("po"); window.print(); };
  window.addEventListener("afterprint", function () { document.body.classList.remove("po"); });
  // v2: подтверждение клиенту — всегда текстом. Большой заказ WhatsApp может не принять по ссылке — тогда копируем текст и вставляем в чат вручную.
  if ($("cpc")) $("cpc").onclick = function () {
    if (!totals().n) { alert("Нет позиций."); return; }
    if (!okOpt()) { alert("Это оптовый прайс. Дополнительная скидка на опт — только с согласия Романа. Согласуйте и отметьте галочку «Согласовано с Романом»."); return; }
    regSend(false);
    clip(clientText(), "Текст подтверждения скопирован. Вставьте его в чат с клиентом (WhatsApp, Telegram, e-mail).");
  };
  $("wa").onclick = function (e) {
    var p = waPhone(D.c.ph);
    if (!totals().n || p.length < 11) { e.preventDefault(); alert(p.length < 11 ? "Проверьте номер телефона клиента." : "Нет позиций."); return; }
    if (!okOpt()) { e.preventDefault(); alert("Это оптовый прайс. Дополнительная скидка на опт — только с согласия Романа. Согласуйте и отметьте галочку «Согласовано с Романом»."); return; }
    var t = clientText();
    this.href = "https://wa.me/" + p + "?text=" + encodeURIComponent(t);
    regSend(false);
  };
  // v3: запись в реестр — сама при подтверждении клиенту; кнопка «Записать в реестр» — повторить вручную
  function regMsg(t, c) { var e = $("rgs"); if (e) { e.textContent = t; e.style.color = c || "#6b7280"; } }
  function regSend(force) {
    if (!REG_URL) { regMsg("Реестр: робот ещё не подключён — используйте кнопки «Реестр: скопировать…».", "#a8322a"); return; }
    var s = JSON.stringify({key: REG_KEY, n: D.n, m: D.m || "", k: D.k || "retail", c: {fn: D.c.fn || "", ct: D.c.ct || "", ph: D.c.ph || ""}, cm: note(), link: enc(),
      i: L.map(function (x) { return [x.p, x.t, x.q, x.q0, x.b, x.c]; })});
    if (!force && s === regSent) return;   // ничего не менялось — второй раз не пишем
    regMsg("Реестр: записываю…");
    var body = new URLSearchParams(); body.set("p", s);
    fetch(REG_URL, {method: "POST", body: body, keepalive: s.length < 60000})
      .then(function (r) { if (!r.ok) throw new Error("HTTP " + r.status); return r.json(); })
      .then(function (j) {
        if (!j || !j.ok) throw new Error("ответ");
        regSent = s;
        regMsg("✓ Реестр: заказ №" + j.id + (j.action === "added" ? " добавлен" : " обновлён") + " (лист «Заказы», строка " + j.row + ").", "#2f6b3a");
      })
      .catch(function () { regMsg("⚠ Реестр: не записалось. Нажмите «Записать в реестр» ещё раз или вставьте вручную кнопками «Реестр: скопировать…».", "#a8322a"); });
  }
  if ($("rg0")) $("rg0").onclick = function () {
    if (!totals().n) { alert("Нет позиций."); return; }
    if (!okOpt()) { alert("Это оптовый прайс. Дополнительная скидка на опт — только с согласия Романа. Согласуйте и отметьте галочку «Согласовано с Романом»."); return; }
    regSend(true);
  };
  // Договор по заявке: передаём текущие (согласованные) позиции в модуль договоров. Данные остаются в ссылке после #.
  if ($("ctr")) $("ctr").onclick = function () {
    var it = L.filter(function (x) { return x.q > 0; }).map(function (x) { return [x.p, x.t, x.q, x.c]; });
    if (!it.length) { alert("Нет позиций к сборке."); return; }
    var s = JSON.stringify({n: D.n, d: D.d, m: D.m, c: D.c, i: it});
    var b = btoa(unescape(encodeURIComponent(s))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
    window.open("team/contracts.html#o=" + b, "_blank", "noopener");
  };
  // Общая таблица заказов (Google Sheets): строки для вставки. ID заказа = номер заявки, по клику открывает эту заявку.
  function enc() {
    var it = L.filter(function (x) { return x.q > 0; }).map(function (x) { return [x.p, x.t, x.q, x.c]; });
    var b = btoa(unescape(encodeURIComponent(JSON.stringify({n: D.n, d: D.d, m: D.m, c: D.c, i: it})))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
    return location.href.split("#")[0] + "#o=" + b;
  }
  function clip(t, okMsg) {
    var done = function () { alert(okMsg); };
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(t).then(done, function () { fallback(); });
    else fallback();
    function fallback() { var ta = document.createElement("textarea"); ta.value = t; document.body.appendChild(ta); ta.select(); try { document.execCommand("copy"); done(); } catch (e) { alert("Не удалось скопировать — браузер не разрешил."); } ta.remove(); }
  }
  function clean(v) { return String(v == null ? "" : v).replace(/[\t\r\n]+/g, " ").trim(); }
  function today() { var d = new Date(); return ("0" + d.getDate()).slice(-2) + "." + ("0" + (d.getMonth() + 1)).slice(-2) + "." + d.getFullYear(); }
  if ($("rg1")) $("rg1").onclick = function () {
    if (!totals().n) { alert("Нет позиций к сборке."); return; }
    var m = D.m === "Наталья" || D.m === "Василина" ? D.m : "";
    var row = ['=HYPERLINK("' + enc() + '";"' + clean(D.n) + '")', today(), m, "Заявка с прайса", clean(D.c.fn), clean(D.c.ph), clean(D.c.ct), "", "", "", Math.round(totals().t)];
    clip(row.join("\t"), "Строка заказа скопирована. Вставьте её на лист «Заказы» в столбец A первой пустой строки.");
  };
  if ($("rg2")) $("rg2").onclick = function () {
    var rows = L.filter(function (x) { return x.q > 0; }).map(function (x) { return [clean(D.n), clean(x.p), clean(x.t), "", x.q, x.c].join("\t"); });
    if (!rows.length) { alert("Нет позиций к сборке."); return; }
    clip(rows.join("\n"), "Позиции скопированы (" + rows.length + "). Вставьте их на лист «Позиции» в столбец A первой пустой строки.");
  };
  render();
})();
