/* Dragan — клиентский прайс. Настройки — в этом блоке. */
var CFG = {
  // Ссылка на опубликованный лист «Каталог» (Google Таблица → Файл → Поделиться → Опубликовать в интернете → CSV).
  // Пока пусто — прайс берётся из файла catalog.json.
  SHEET_CSV: "",
  PRICE_NOTE: "цены в тенге, указаны с НДС 16%", // пустая строка — подпись скрывается
  PACK: "Упаковка: коробка (6–8 шт С3 или 20–25 шт Р9) — 300 ₸; деревянный короб (100+ С3 или 400–500 Р9) — 25 000 ₸.",
  MGR_PAGE: "z-pi1s0iv4ao.html", // страница менеджера для обработки заявки
  SECTIONS: ["Декоративные кустарники", "Декоративные деревья", "Ягодные кустарники", "Плодовые деревья"]
};
var LEG = {"С1":{l:1,d:12,h:12},"С1,5":{l:1.5,d:13,h:14},"С2":{l:2,d:15,h:15},"С3":{l:3,d:18,h:17},"С3,6":{l:3.6,d:19,h:18},"С5":{l:5,d:21,h:20},"С7,5":{l:7.5,d:24,h:22},"С10":{l:10,d:27,h:24},"С12":{l:12,d:29,h:26},"С20":{l:20,d:35,h:30},"Р9":{sq:[9,9,10]},"ОКС":{}};

(function () {
  var MG = window.DRAGAN || {name: "Менеджер", phone: ""};
  var $ = function (i) { return document.getElementById(i); };
  var f = function (n) { return Math.round(n).toLocaleString("ru-RU"); };
  var esc = function (s) { return String(s).replace(/[&<>"]/g, function (c) { return {"&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;"}[c]; }); };
  var store = {
    get: function (k) { try { return JSON.parse(localStorage.getItem(k)); } catch (e) { return null; } },
    set: function (k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
  };
  var items = [], updated = "", Q = store.get("dg_cart") || {}, section = "", query = "", NN = 0;
  var key = function (x) { return x.s + "|" + x.p + "|" + x.t; };
  var now = new Date(), p2 = function (x) { return String(x).padStart(2, "0"); };
  var ON = p2(now.getDate()) + p2(now.getMonth() + 1) + String(now.getFullYear()).slice(2) + "-" + p2(now.getHours()) + p2(now.getMinutes());

  function fmtDate(iso) {
    var d = iso && /^\d{4}-\d{2}-\d{2}/.test(iso) ? new Date(iso + "T12:00:00") : /^\d{2}\.\d{2}\.\d{4}$/.test(iso || "") ? new Date(iso.slice(6) + "-" + iso.slice(3, 5) + "-" + iso.slice(0, 2) + "T12:00:00") : new Date();
    return d.toLocaleDateString("ru-RU", {day: "numeric", month: "long", year: "numeric"});
  }
  function tp(t) { return String(t).toUpperCase().replace(/\s/g, "").replace(/C/g, "С").replace(/P/g, "Р").replace(/O/g, "О").replace(/K/g, "К"); }
  function phone(p) { return p.length === 11 ? "+7 " + p.slice(1, 4) + " " + p.slice(4, 7) + "-" + p.slice(7, 9) + "-" + p.slice(9) : p; }

  /* ---------- данные ---------- */
  function parseCSV(t) {
    var rows = [], r = [], c = "", q = false;
    for (var i = 0; i < t.length; i++) {
      var ch = t[i];
      if (q) { if (ch === '"') { if (t[i + 1] === '"') { c += '"'; i++; } else q = false; } else c += ch; }
      else if (ch === '"') q = true;
      else if (ch === ",") { r.push(c); c = ""; }
      else if (ch === "\n") { r.push(c); rows.push(r); r = []; c = ""; }
      else if (ch !== "\r") c += ch;
    }
    if (c || r.length) { r.push(c); rows.push(r); }
    return rows;
  }
  // Колонки листа «Каталог»: Раздел, Позиция, Тип, Цена, Показывать (да/нет), Обновлено (только в 2-й строке)
  function fromCSV(t) {
    var rows = parseCSV(t).slice(1), out = [], upd = "";
    rows.forEach(function (r, i) {
      if (i === 0 && r[5]) upd = r[5].trim();
      if (!r[1] || String(r[4] || "").trim().toLowerCase() === "нет") return;
      var c = parseInt(String(r[3]).replace(/[^\d]/g, ""), 10);
      if (!(c > 0)) return;
      out.push({s: r[0].trim(), p: r[1].trim(), t: tp(r[2] || ""), c: c});
    });
    return {updated: upd, items: out};
  }
  function setData(d) {
    items = d.items.map(function (x) { return {s: x.s, p: x.p, t: tp(x.t), c: x.c}; });
    updated = d.updated || "";
    $("upd").textContent = fmtDate(updated);
    render(); legend();
  }
  function load() {
    fetch("catalog.json", {cache: "no-cache"}).then(function (r) { return r.json(); }).then(function (d) {
      setData(d);
      if (!CFG.SHEET_CSV) return;
      var ctl = window.AbortController ? new AbortController() : null, tm = setTimeout(function () { ctl && ctl.abort(); }, 6000);
      fetch(CFG.SHEET_CSV, {signal: ctl ? ctl.signal : undefined}).then(function (r) { if (!r.ok) throw 0; return r.text(); }).then(function (t) {
        clearTimeout(tm);
        var live = fromCSV(t);
        if (live.items.length >= 5) setData(live);
      }).catch(function () {});
    }).catch(function () {
      $("list").innerHTML = '<div class="empty">Не удалось загрузить прайс. Проверьте интернет и обновите страницу.</div>';
    });
  }

  /* ---------- список ---------- */
  function secs() {
    var o = [];
    CFG.SECTIONS.forEach(function (s) { if (items.some(function (x) { return x.s === s; })) o.push(s); });
    items.forEach(function (x) { if (o.indexOf(x.s) < 0) o.push(x.s); });
    return o;
  }
  function chips() {
    var s = secs();
    $("chips").innerHTML = ['<button class="chip' + (section ? "" : " on") + '" data-s="">Все</button>'].concat(s.map(function (n) {
      return '<button class="chip' + (section === n ? " on" : "") + '" data-s="' + esc(n) + '">' + esc(n) + "</button>";
    })).join("");
  }
  function render() {
    chips();
    var h = "", total = 0;
    secs().forEach(function (sec) {
      if (section && section !== sec) return;
      var k = 0, t = "";
      items.forEach(function (x) {
        if (x.s !== sec || (query && x.p.toLowerCase().indexOf(query) < 0)) return;
        k++; total++;
        var id = esc(key(x)), q = Q[key(x)] || 0;
        t += '<article class="row' + (q ? " has" : "") + '" data-k="' + id + '"><div class="n">' + k + '</div><div class="nm">' + esc(x.p) + '<span class="tp">' + esc(x.t) + '</span></div><div class="ty">' + esc(x.t) + '</div><div class="pr">' + f(x.c) + '<i> ₸</i></div>' +
          '<div class="qt"><button type="button" data-d="-1" aria-label="Меньше">−</button><input type="number" min="0" max="99999" inputmode="numeric" placeholder="0" value="' + (q || "") + '" aria-label="Количество: ' + esc(x.p) + '"><button type="button" data-d="1" aria-label="Больше">+</button></div><div class="sm"></div></article>';
      });
      if (k) h += '<h2 class="sec">' + esc(sec) + '</h2><div class="hd"><span>№</span><span>Позиция</span><span>Тип</span><span>Цена, ₸</span><span>Кол-во</span><span>Сумма, ₸</span></div>' + t;
    });
    $("list").innerHTML = h || '<div class="empty">' + (items.length ? "Ничего не найдено. Попробуйте другое слово." : "Загрузка…") + "</div>";
    calc();
  }
  function byKey(k) { for (var i = 0; i < items.length; i++) if (key(items[i]) === k) return items[i]; }

  /* ---------- расчёт ---------- */
  function lines() {
    var out = [], tot = 0;
    items.forEach(function (x) {
      var q = Q[key(x)] || 0;
      if (q) { out.push({p: x.p, t: x.t, q: q, c: x.c, s: q * x.c}); tot += q * x.c; }
    });
    return {l: out, tot: tot};
  }
  function calc() {
    var r = lines(); NN = r.l.length;
    document.querySelectorAll(".row").forEach(function (row) {
      var x = byKey(row.getAttribute("data-k")), q = x ? Q[key(x)] || 0 : 0;
      row.classList.toggle("has", !!q);
      row.querySelector(".sm").textContent = q ? f(q * x.c) + " ₸" : "";
    });
    $("bar").classList.toggle("on", NN > 0);
    $("bn").textContent = "Выбрано позиций: " + NN;
    $("bt").textContent = f(r.tot) + " ₸";
    $("tt").textContent = f(r.tot) + " ₸";
    $("co").style.display = NN ? "" : "none";
    $("sl").innerHTML = r.l.map(function (z, i) { return (i + 1) + ". " + esc(z.p) + " (" + esc(z.t) + ") — " + z.q + " шт × " + f(z.c) + " = " + f(z.s) + " ₸"; }).join("<br>");
    store.set("dg_cart", Q);
  }
  function mlink(r) {
    if (!CFG.MGR_PAGE) return "";
    try {
      var o = {n: ON, d: fmtDate(""), m: MG.name, c: {fn: $("fn").value.trim(), ct: $("ct").value.trim(), ph: $("ph").value.trim()}, i: r.l.map(function (z) { return [z.p, z.t, z.q, z.c]; })};
      var b = btoa(unescape(encodeURIComponent(JSON.stringify(o)))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
      return "\n\nДля менеджера (обработка заявки): " + new URL(CFG.MGR_PAGE, location.href).href + "#o=" + b;
    } catch (e) { return ""; }
  }
  function msg() {
    var r = lines(), d = fmtDate("");
    return "Здравствуйте! Хочу оформить заказ.\nЗаявка №" + ON + " от " + d + "\nЗаказчик: " + $("fn").value.trim() + "\nГород: " + $("ct").value.trim() + "\nТелефон: " + $("ph").value.trim() + "\nМенеджер: " + MG.name + "\n" +
      r.l.map(function (z, i) { return (i + 1) + ". " + z.p + " (" + z.t + ") — " + z.q + " шт × " + f(z.c) + " = " + f(z.s) + " ₸"; }).join("\n") +
      "\nИтого: " + f(r.tot) + " ₸" + (CFG.PRICE_NOTE ? " (" + CFG.PRICE_NOTE.replace(/^цены в тенге,\s*(указаны\s*)?/, "") + ")" : "") + "\nЦены по прайсу от " + fmtDate(updated) + mlink(r);
  }
  function setErr(t) { $("ce").textContent = t; if (t) $("co").scrollIntoView({behavior: "smooth", block: "start"}); }
  function need() {
    var a = $("fn").value.trim(), b = $("ct").value.trim(), c = $("ph").value.replace(/\D/g, "").length >= 10;
    $("fn").classList.toggle("bad", !a); $("ct").classList.toggle("bad", !b); $("ph").classList.toggle("bad", !c);
    if (!a || !b || !c) { setErr("Укажите имя или компанию, город и телефон — без этого заявку отправить нельзя."); return false; }
    setErr(""); return true;
  }
  function save() { store.set("dg_cust", {fn: $("fn").value, ct: $("ct").value, ph: $("ph").value}); }

  /* ---------- обозначения контейнеров ---------- */
  function ic(k) {
    var o = LEG[k], s = '<svg viewBox="0 0 130 100" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round" stroke-linecap="round" aria-hidden="true">';
    if (!o.l && !o.sq) s += '<path d="M65 8v52M65 24l-15-12M65 34l17-14M65 46l-13-9"/><path d="M65 60c-4 9-16 14-28 16M65 60c-2 11-5 18-8 26M65 60c2 11 7 18 13 24M65 60c4 9 17 14 29 14M65 60v26"/>';
    else {
      var q = o.sq, w = q ? q[0] : o.d, h = q ? q[2] : o.h, sc = q ? 4.2 : Math.min(2.6, 66 / w), pw = w * sc, ph = Math.min(62, h * sc), bw = pw * (q ? .86 : .76), cx = 72, y = 26, l = cx - pw / 2, r = cx + pw / 2;
      s += '<path d="M' + l + " " + y + "H" + r + "L" + (cx + bw / 2) + " " + (y + ph) + "H" + (cx - bw / 2) + 'Z"/><path d="M' + (l + 2) + " " + (y + 6) + "H" + (r - 2) + '"/>';
      s += '<path stroke-width="1" d="M' + l + " " + (y - 8) + "H" + r + "M" + l + " " + (y - 11) + "v6M" + r + " " + (y - 11) + "v6M" + (l - 9) + " " + y + "V" + (y + ph) + "M" + (l - 12) + " " + y + "h6M" + (l - 12) + " " + (y + ph) + 'h6"/>';
      s += '<g fill="currentColor" stroke="none" font-size="9" text-anchor="middle"><text x="' + cx + '" y="' + (y - 13) + '">' + (q ? q[0] + "×" + q[1] : "⌀" + w) + '</text><text x="' + (l - 12) + '" y="' + (y + ph / 2 + 3) + '" text-anchor="end">h' + h + "</text></g>";
    }
    return s + "</svg>";
  }
  function legend() {
    var seen = {}; items.forEach(function (x) { seen[x.t] = 1; });
    $("lg").innerHTML = Object.keys(LEG).filter(function (k) { return seen[k]; }).map(function (k) {
      var o = LEG[k];
      return '<div class="lc">' + ic(k) + "<b>" + k + "</b>" + (o.l ? String(o.l).replace(".", ",") + " л · ⌀" + o.d + " × h" + o.h + " см" : o.sq ? o.sq.join("×") + " см" : "Саженец с голым корнем") + "</div>";
    }).join("");
  }

  /* ---------- запуск ---------- */
  $("mn").textContent = MG.name;
  var wa = "https://wa.me/" + MG.phone;
  $("mw").href = wa + "?text=" + encodeURIComponent("Здравствуйте! Я ознакомился с прайсом, хочу уточнить несколько вопросов");
  $("mw").textContent = "Написать в WhatsApp";
  $("mp").textContent = phone(MG.phone);
  $("note").textContent = CFG.PRICE_NOTE ? ", " + CFG.PRICE_NOTE : "";
  $("pack").textContent = CFG.PACK;
  var cu = store.get("dg_cust"); if (cu) { $("fn").value = cu.fn || ""; $("ct").value = cu.ct || ""; $("ph").value = cu.ph || ""; }

  $("q").oninput = function () { query = this.value.trim().toLowerCase(); render(); };
  $("chips").onclick = function (e) { var b = e.target.closest(".chip"); if (b) { section = b.getAttribute("data-s"); render(); window.scrollTo({top: 0}); } };
  var list = $("list");
  list.addEventListener("click", function (e) {
    var b = e.target.closest("button[data-d]"); if (!b) return;
    var row = b.closest(".row"), k = row.getAttribute("data-k"), v = Math.max(0, (Q[k] || 0) + parseInt(b.getAttribute("data-d"), 10));
    Q[k] = v; row.querySelector("input").value = v || ""; calc();
  });
  list.addEventListener("input", function (e) {
    if (e.target.tagName !== "INPUT") return;
    var k = e.target.closest(".row").getAttribute("data-k"), v = Math.min(99999, Math.max(0, parseInt(e.target.value, 10) || 0));
    Q[k] = v; calc();
  });
  ["fn", "ct", "ph"].forEach(function (i) { $(i).oninput = function () { this.classList.remove("bad"); save(); }; });
  $("go").onclick = function () { $("co").scrollIntoView({behavior: "smooth", block: "start"}); };
  $("sw").onclick = function (e) {
    if (!NN || !need()) { e.preventDefault(); return; }
    var m = msg();
    this.href = wa + "?text=" + encodeURIComponent(m);
    $("cpt").value = m; $("cp").style.display = "block"; $("hint").style.display = "block";
  };
  $("cpy").onclick = function () { var t = $("cpt"); t.select(); try { document.execCommand("copy"); } catch (e) {} };
  $("clr").onclick = function () { if (confirm("Очистить выбранные позиции?")) { Q = {}; render(); } };
  $("prn").onclick = function () { window.print(); };
  if (window.IntersectionObserver) new IntersectionObserver(function (e) { $("bar").style.visibility = e[0].isIntersecting ? "hidden" : ""; }, {threshold: .25}).observe($("co"));
  load();
})();
