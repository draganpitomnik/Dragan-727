/* Dragan — коммерческое предложение (КП). Настройки — в этом блоке. */
var KP_CFG = {
  // Та же ссылка на опубликованный лист «Каталог», что и в app.js (SHEET_CSV). Пусто — цены из catalog.json.
  SHEET_CSV: "",
  VAT_NOTE: "Цены в теңге, указаны с НДС 16%.",
  ROWS_START: 5, // сколько пустых строк в новом КП
  TERMS: "Цены действительны 14 дней с даты КП.\n" +
    "Наличие подтверждается при оформлении счёта.\n" +
    "Отгрузка со склада питомника рядом с Алматы. Доставка до транспортной компании в Алматы, далее — по тарифу ТК за счёт покупателя.\n" +
    "Оплата: по счёту, условия согласуйте с менеджером."
};

(function () {
  var MG = window.DRAGAN || {name: "Менеджер", phone: "", letter: "M"};
  var L = MG.letter || "M", KEY = "dg_kp_" + L, HIST = "dg_kp_hist_" + L, SEQ = "dg_kp_seq_" + L;
  var $ = function (i) { return document.getElementById(i); };
  var p2 = function (x) { return String(x).padStart(2, "0"); };
  var f = function (n) { return Math.round(n).toLocaleString("ru-RU"); };
  var esc = function (s) { return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) { return {"&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;"}[c]; }); };
  var store = {
    get: function (k) { try { return JSON.parse(localStorage.getItem(k)); } catch (e) { return null; } },
    set: function (k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
  };
  var cat = [], byKey = {}, D;

  /* ---------- дата и номер ---------- */
  function today() { var d = new Date(); return p2(d.getDate()) + "." + p2(d.getMonth() + 1) + "." + d.getFullYear(); }
  function dstamp() { var d = new Date(); return p2(d.getDate()) + p2(d.getMonth() + 1) + String(d.getFullYear()).slice(2); }
  // Номер: буква менеджера − ДДММГГ − порядковый за день. Пример: N-021126-01
  function nextNo() {
    var ds = dstamp(), s = store.get(SEQ) || {};
    var k = s.d === ds ? (s.k || 0) + 1 : 1;
    store.set(SEQ, {d: ds, k: k});
    return L + "-" + ds + "-" + p2(k);
  }
  function blank() {
    var r = []; for (var i = 0; i < KP_CFG.ROWS_START; i++) r.push({n: "", t: "", q: "", c: ""});
    return {no: nextNo(), date: today(), to: "", ct: "", ph: "", terms: KP_CFG.TERMS, rows: r};
  }
  function fresh(d) {
    // черновик со вчера — получает сегодняшнюю дату и свежий номер
    if (d.date !== today()) { d.date = today(); d.no = nextNo(); }
    return d;
  }

  /* ---------- каталог ---------- */
  function tp(t) { return String(t || "").toUpperCase().replace(/\s/g, "").replace(/C/g, "С").replace(/P/g, "Р").replace(/O/g, "О").replace(/K/g, "К"); }
  function ck(n, t) { return String(n).trim().toLowerCase() + "|" + tp(t); }
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
  function setCat(items) {
    cat = items.map(function (x) { return {p: String(x.p).trim(), t: tp(x.t), c: +x.c || 0}; });
    byKey = {}; cat.forEach(function (x) { byKey[ck(x.p, x.t)] = x; byKey[(x.p + " · " + x.t).toLowerCase()] = x; });
    $("dl").innerHTML = cat.map(function (x) { return '<option value="' + esc(x.p + " · " + x.t) + '">' + esc(f(x.c) + " ₸") + "</option>"; }).join("");
  }
  function loadCat() {
    fetch("catalog.json", {cache: "no-cache"}).then(function (r) { return r.json(); }).then(function (d) {
      setCat(d.items || []);
      if (!KP_CFG.SHEET_CSV) return;
      fetch(KP_CFG.SHEET_CSV).then(function (r) { if (!r.ok) throw 0; return r.text(); }).then(function (t) {
        var out = [];
        parseCSV(t).slice(1).forEach(function (r) {
          if (!r[1] || String(r[4] || "").trim().toLowerCase() === "нет") return;
          var c = parseInt(String(r[3]).replace(/[^\d]/g, ""), 10);
          if (c > 0) out.push({p: r[1], t: r[2], c: c});
        });
        if (out.length >= 5) setCat(out);
      }).catch(function () {});
    }).catch(function () {});
  }

  /* ---------- сумма прописью ---------- */
  function words(n) {
    n = Math.floor(n);
    if (!n) return "ноль";
    var u = ["", "один", "два", "три", "четыре", "пять", "шесть", "семь", "восемь", "девять"],
      uf = ["", "одна", "две", "три", "четыре", "пять", "шесть", "семь", "восемь", "девять"],
      t = ["десять", "одиннадцать", "двенадцать", "тринадцать", "четырнадцать", "пятнадцать", "шестнадцать", "семнадцать", "восемнадцать", "девятнадцать"],
      d = ["", "", "двадцать", "тридцать", "сорок", "пятьдесят", "шестьдесят", "семьдесят", "восемьдесят", "девяносто"],
      h = ["", "сто", "двести", "триста", "четыреста", "пятьсот", "шестьсот", "семьсот", "восемьсот", "девятьсот"],
      g = [["", "", ""], ["тысяча", "тысячи", "тысяч"], ["миллион", "миллиона", "миллионов"], ["миллиард", "миллиарда", "миллиардов"]];
    function form(x, w) { var a = x % 100, b = x % 10; if (a > 10 && a < 20) return w[2]; if (b === 1) return w[0]; if (b > 1 && b < 5) return w[1]; return w[2]; }
    var out = [], i = 0;
    while (n > 0) {
      var x = n % 1000;
      if (x) {
        var p = [], fem = i === 1;
        p.push(h[Math.floor(x / 100)]);
        var y = x % 100;
        if (y >= 10 && y < 20) p.push(t[y - 10]); else { p.push(d[Math.floor(y / 10)]); p.push((fem ? uf : u)[y % 10]); }
        if (i) p.push(form(x, g[i]));
        out.unshift(p.filter(Boolean).join(" "));
      }
      n = Math.floor(n / 1000); i++;
    }
    var s = out.join(" ");
    return s.charAt(0).toUpperCase() + s.slice(1);
  }

  /* ---------- отрисовка ---------- */
  function num(v) { var x = parseFloat(String(v).replace(/\s/g, "").replace(",", ".")); return isFinite(x) ? x : 0; }
  function rowHTML(r, i) {
    var miss = r.n && r.miss ? '<div class="miss">Нет в прайсе — проверьте название и впишите цену вручную</div>' : "";
    return '<div class="it' + (r.n || r.q || r.c ? "" : " empty") + '" data-i="' + i + '">' +
      '<span class="n">' + (i + 1) + "</span>" +
      '<label class="c nm" data-l="Наименование"><input list="dl" data-k="n" value="' + esc(r.n) + '" placeholder="Начните вводить название" autocomplete="off"></label>' +
      '<label class="c tp" data-l="Тара"><input data-k="t" value="' + esc(r.t) + '" placeholder="С3"></label>' +
      '<label class="c r qt" data-l="Кол-во, шт"><input data-k="q" inputmode="numeric" value="' + esc(r.q) + '" placeholder="0"></label>' +
      '<label class="c r pr" data-l="Цена, ₸"><input data-k="c" inputmode="numeric" value="' + esc(r.c) + '" placeholder="0"></label>' +
      '<span class="sm" data-s="' + i + '"></span>' +
      '<button type="button" class="x" data-x="' + i + '" aria-label="Удалить строку">×</button>' + miss + "</div>";
  }
  function render() {
    $("no").value = D.no; $("dt").textContent = D.date;
    $("to").value = D.to; $("ct").value = D.ct; $("ph").value = D.ph;
    $("terms").innerText = D.terms;
    $("rows").innerHTML = D.rows.map(rowHTML).join("");
    totals();
  }
  function totals() {
    var sum = 0, pos = 0, pcs = 0;
    D.rows.forEach(function (r, i) {
      var s = num(r.q) * num(r.c), el = document.querySelector('[data-s="' + i + '"]');
      if (el) el.textContent = s > 0 ? f(s) : "";
      if (s > 0) { sum += s; pos++; pcs += num(r.q); }
    });
    $("cnt").textContent = pos ? "Позиций: " + pos + " · растений: " + f(pcs) + " шт" : "Добавьте позиции — сумма посчитается сама";
    $("sum").innerHTML = f(sum) + "<i>теңге</i>";
    $("wd").textContent = sum > 0 ? "Сумма прописью: " + words(sum) + " теңге 00 тиын" : "";
    $("bsum").textContent = f(sum) + " ₸";
    store.set(KEY, D);
  }
  function rowEl(el) { var p = el.closest(".it"); return p ? +p.getAttribute("data-i") : -1; }

  /* ---------- события ---------- */
  $("rows").addEventListener("input", function (e) {
    var k = e.target.getAttribute("data-k"), i = rowEl(e.target);
    if (!k || i < 0) return;
    var r = D.rows[i], v = e.target.value;
    if (k === "q" || k === "c") v = v.replace(/[^\d]/g, "");
    if (v !== e.target.value) e.target.value = v;
    r[k] = v;
    e.target.closest(".it").classList.toggle("empty", !(r.n || r.q || r.c));
    totals();
  });
  // выбрали из подсказки «Название · Тара» → тара и цена подставляются (их можно исправить)
  $("rows").addEventListener("change", function (e) {
    var k = e.target.getAttribute("data-k"), i = rowEl(e.target);
    if (i < 0 || (k !== "n" && k !== "t")) return;
    var r = D.rows[i], hit = byKey[String(r.n).trim().toLowerCase()];
    if (hit) { r.n = hit.p; r.t = hit.t; r.c = String(hit.c); r.miss = false; }
    else if (r.n) {
      var h2 = byKey[ck(r.n, r.t)];
      if (h2) { if (!r.c) r.c = String(h2.c); r.miss = false; } else r.miss = cat.length > 0;
    }
    var el = e.target.closest(".it");
    ["n", "t", "c"].forEach(function (kk) { var inp = el.querySelector('[data-k="' + kk + '"]'); if (inp && inp.value !== r[kk]) inp.value = r[kk]; });
    var ms = el.querySelector(".miss");
    if (r.n && r.miss && !ms) el.insertAdjacentHTML("beforeend", '<div class="miss">Нет в прайсе — проверьте название и впишите цену вручную</div>');
    if (!(r.n && r.miss) && ms) ms.remove();
    totals();
  });
  $("rows").addEventListener("click", function (e) {
    var x = e.target.getAttribute("data-x");
    if (x == null) return;
    D.rows.splice(+x, 1);
    if (!D.rows.length) D.rows.push({n: "", t: "", q: "", c: ""});
    render();
  });
  $("add").onclick = function () {
    D.rows.push({n: "", t: "", q: "", c: ""}); render();
    var ins = $("rows").querySelectorAll('[data-k="n"]'); ins[ins.length - 1].focus();
  };
  ["to", "ct", "ph"].forEach(function (id) { $(id).addEventListener("input", function () { D[id] = this.value; store.set(KEY, D); }); });
  $("no").addEventListener("input", function () { D.no = this.value.trim(); store.set(KEY, D); });
  $("terms").addEventListener("input", function () { D.terms = this.innerText; store.set(KEY, D); });

  function toast(t) { var el = $("toast"); el.textContent = t; el.classList.add("on"); setTimeout(function () { el.classList.remove("on"); }, 2200); }
  function filled() { return D.rows.filter(function (r) { return num(r.q) * num(r.c) > 0; }); }
  function remember() {
    var h = store.get(HIST) || [], sum = filled().reduce(function (a, r) { return a + num(r.q) * num(r.c); }, 0);
    h = h.filter(function (x) { return x.no !== D.no; });
    h.unshift({no: D.no, date: D.date, to: D.to, sum: sum, d: JSON.parse(JSON.stringify(D))});
    store.set(HIST, h.slice(0, 30)); hist();
  }
  $("pdf").onclick = function () {
    if (!filled().length) { toast("Добавьте хотя бы одну позицию с количеством и ценой"); return; }
    if (document.activeElement) document.activeElement.blur();
    remember();
    var t = document.title; document.title = "КП " + D.no + (D.to ? " — " + D.to : "");
    setTimeout(function () { window.print(); document.title = t; }, 50);
  };
  $("new").onclick = function () {
    if (filled().length) remember();
    D = blank(); render(); toast("Новое КП № " + D.no); window.scrollTo(0, 0);
  };
  $("copy").onclick = function () {
    var lines = ["Коммерческое предложение № " + D.no + " от " + D.date, "Питомник Dragan" + (D.to ? " — для " + D.to : ""), ""];
    filled().forEach(function (r, i) { lines.push((i + 1) + ". " + r.n + (r.t ? " (" + r.t + ")" : "") + " — " + r.q + " шт × " + f(num(r.c)) + " ₸ = " + f(num(r.q) * num(r.c)) + " ₸"); });
    var s = filled().reduce(function (a, r) { return a + num(r.q) * num(r.c); }, 0);
    lines.push("", "Итого: " + f(s) + " теңге (с НДС 16%)", "", "Менеджер: " + MG.name + (MG.phone ? ", WhatsApp +" + MG.phone : ""));
    var txt = lines.join("\n");
    (navigator.clipboard ? navigator.clipboard.writeText(txt) : Promise.reject()).then(function () { toast("Текст КП скопирован — вставьте в WhatsApp"); }, function () {
      var ta = document.createElement("textarea"); ta.value = txt; document.body.appendChild(ta); ta.select();
      try { document.execCommand("copy"); toast("Текст КП скопирован"); } catch (e) { toast("Не удалось скопировать"); } ta.remove();
    });
  };

  function hist() {
    var h = store.get(HIST) || [];
    $("hist").style.display = h.length ? "" : "none";
    $("htb").innerHTML = h.map(function (x, i) {
      return "<tr><td><b>" + esc(x.no) + "</b></td><td>" + esc(x.date) + "</td><td>" + esc(x.to || "—") + "</td><td>" + f(x.sum) + ' ₸</td><td><button type="button" data-h="' + i + '">открыть</button></td></tr>';
    }).join("");
  }
  $("htb").addEventListener("click", function (e) {
    var i = e.target.getAttribute("data-h"); if (i == null) return;
    var x = (store.get(HIST) || [])[+i]; if (!x) return;
    D = x.d; render(); window.scrollTo(0, 0);
    toast("Открыто КП № " + D.no + " от " + D.date + " (дата и номер сохранены)");
  });

  /* ---------- старт ---------- */
  $("mn").textContent = MG.name; $("mn2").textContent = MG.name;
  var ph = MG.phone ? "+" + MG.phone.replace(/^(\d)(\d{3})(\d{3})(\d{2})(\d{2})$/, "$1 $2 $3 $4 $5") : "";
  $("mp").textContent = ph; $("mp2").textContent = ph ? "WhatsApp " + ph : "";
  $("vat").textContent = KP_CFG.VAT_NOTE;
  D = store.get(KEY); D = D && D.rows ? fresh(D) : blank();
  render(); hist(); loadCat();
})();
