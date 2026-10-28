/* Dragan — страница менеджера: обработка заявки клиента и лист подбора.
   Данные заявки приходят в ссылке после знака # (на сервер не отправляются). */
(function () {
  var VAT = "с НДС 16%";
  var $ = function (i) { return document.getElementById(i); };
  var f = function (n) { return Math.round(n).toLocaleString("ru-RU"); };
  var esc = function (s) { return String(s).replace(/[&<>"]/g, function (c) { return {"&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;"}[c]; }); };
  var D, L = [], disc = 0;

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
        '<div class="pr"><input class="pi" type="number" min="0" inputmode="numeric" value="' + x.c + '" aria-label="Цена"' + ' style="width:96px;height:40px;border:1px solid #e3dccd;border-radius:8px;text-align:right;font-size:16px;padding:0 8px">' + (x.c !== x.b ? '<br><small><s>' + f(x.b) + "</s></small>" : "") + "</div>" +
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
  function missing() { return L.filter(function (x) { return x.q < x.q0; }); }
  function note() { return $("cm").value.trim(); }

  function clientText() {
    var r = totals(), mi = missing().filter(function (x) { return x.q === 0; }), ch = L.filter(function (x) { return x.q > 0 && x.q < x.q0; });
    var t = "Здравствуйте" + (D.c.fn ? ", " + D.c.fn : "") + "! Ваш заказ №" + D.n + " согласован.\n" +
      L.filter(function (x) { return x.q > 0; }).map(function (x, i) { return (i + 1) + ". " + x.p + " (" + x.t + ") — " + x.q + " шт × " + f(x.c) + " = " + f(x.q * x.c) + " ₸"; }).join("\n") +
      (r.t0 > r.t ? "\nСкидка: −" + f(r.t0 - r.t) + " ₸" : "") + "\nИтого к оплате: " + f(r.t) + " ₸ (" + VAT + ")";
    if (mi.length) t += "\nНет в наличии: " + mi.map(function (x) { return x.p + " (" + x.t + ")"; }).join(", ");
    if (ch.length) t += "\nУменьшено количество: " + ch.map(function (x) { return x.p + " (" + x.t + "): " + x.q + " из " + x.q0; }).join(", ");
    if (note()) t += "\n" + note();
    return t;
  }
  function sheet() {
    var r = totals(), u = 0, rows = "", k = 0;
    L.forEach(function (x) { if (x.q > 0) { k++; u += x.q; rows += "<tr><td>" + k + "</td><td>" + esc(x.p) + "</td><td>" + esc(x.t) + '</td><td class="c">' + x.q + '</td><td class="r">' + f(x.c) + '</td><td class="r">' + f(x.q * x.c) + '</td><td class="c">☐</td></tr>'; } });
    var mi = missing().filter(function (x) { return x.q === 0; });
    return "<h2>Лист подбора · заявка №" + esc(D.n) + "</h2><div class=\"shm\">Согласовано: " + fmtDate() + (D.m ? " · менеджер " + esc(D.m) : "") + "<br>Заказчик: <b>" + esc(D.c.fn) + "</b><br>Город: <b>" + esc(D.c.ct) + "</b><br>Телефон: <b>" + esc(D.c.ph) + "</b><br>Цены согласованы, " + VAT + "</div>" +
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
  $("on").textContent = "№" + D.n + " · " + (D.d || "");
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
    if (e.target.classList.contains("qi")) x.q = v; else if (e.target.classList.contains("pi")) x.c = v;
    render();
  });
  $("ds").oninput = function () {
    disc = Math.min(100, Math.max(0, parseFloat(this.value.replace(",", ".")) || 0));
    L.forEach(function (x) { x.c = Math.round(x.b * (1 - disc / 100)); });
    render();
  };
  $("reset").onclick = function () { disc = 0; $("ds").value = ""; L.forEach(function (x) { x.q = x.q0; x.c = x.b; }); render(); };
  $("pdf").onclick = function () { if (!totals().n) { alert("Нет позиций к сборке."); return; } $("os").innerHTML = sheet(); document.body.classList.add("po"); window.print(); };
  window.addEventListener("afterprint", function () { document.body.classList.remove("po"); });
  $("wa").onclick = function (e) {
    var p = waPhone(D.c.ph);
    if (!totals().n || p.length < 11) { e.preventDefault(); alert(p.length < 11 ? "Проверьте номер телефона клиента." : "Нет позиций."); return; }
    this.href = "https://wa.me/" + p + "?text=" + encodeURIComponent(clientText());
  };
  render();
})();
