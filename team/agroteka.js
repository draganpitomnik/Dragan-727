/* Кабинет менеджера → «9. Советы клиенту»: бесплатные издания AGROTEKA.
   Новое издание = одна запись в GIFTS. status: 'live' — опубликовано, 'soon' — готовится (кнопки неактивны).
   anchor — ярлык подарка на agroteka.kz/podarki/ (плагин делает его латиницей из названия). */
(function () {
  'use strict';
  var PAGE = 'https://agroteka.kz/podarki/';
  var UTM = '?utm_source=dragan_manager&utm_medium=messenger';

  var GIFTS = [
    {
      section: 'Укрытие на зиму',
      icon: '❄',
      title: 'Укрыть и не сгноить',
      about: 'Розы, виноград, гортензии: что укрывать, когда и чем, чтобы не вымерзло и не выпрело.',
      keys: 'укрытие укрыть зима зимовка мороз розы роза виноград гортензия гортензии выпревание спанбонд лапник',
      anchor: 'ukryt-i-ne-sgnoit',
      status: 'live'
    },
    {
      section: 'Голубика',
      icon: '●',
      title: 'Голубика',
      about: 'Какой саженец выбрать (P9, C2, C5, C50), посадка, кислая почва, уход, защита, укрытие и 20 сортов.',
      keys: 'голубика черника кислая почва торф посадка уход полив удобрение сорта блюкроп bluecrop denise blue',
      anchor: '',
      status: 'soon'
    }
  ];

  function link(g) { return PAGE + UTM + (g.anchor ? '#' + g.anchor : ''); }
  function msg(g) {
    return 'Здравствуйте! По вашему вопросу у нас есть бесплатное руководство «' + g.title + '» — ' +
      g.about.charAt(0).toLowerCase() + g.about.slice(1) + '\n\nСкачать можно здесь, без регистрации:\n' + link(g);
  }
  var ALL_MSG = 'Здравствуйте! Собрали для садоводов бесплатные руководства — по укрытию на зиму, уходу за ягодниками и другим темам. ' +
    'Скачать можно без регистрации:\n' + PAGE + UTM;

  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function copy(s) {
    if (typeof window.copyText === 'function') return window.copyText(s);
    try { navigator.clipboard.writeText(s); } catch (_) {}
  }
  function wa(s) { window.open('https://wa.me/?text=' + encodeURIComponent(s), '_blank', 'noopener'); }

  var css = '' +
    '.gf-search{width:100%;box-sizing:border-box;border:1px solid #8C9BAE;border-radius:10px;padding:12px 14px;font:16px system-ui,-apple-system,sans-serif;margin:6px 0 14px;color:#14283F}' +
    '.gf-search:focus{outline:2px solid #E4CC9E;border-color:#14283F}' +
    '.gf-sec{margin:16px 0 6px;font-size:13px;letter-spacing:.02em;color:#64758a;font-weight:650}' +
    '.gf-card{border:1px solid #dedad2;border-left:5px solid #2f6b3c;border-radius:12px;padding:14px;margin:8px 0;background:#fbfaf6}' +
    '.gf-card.soon{border-left-color:#c9b98f;opacity:.75}' +
    '.gf-card b{font-size:16px;color:#14283F}' +
    '.gf-card p{margin:5px 0 10px;font-size:14px;line-height:1.5;color:#33475c}' +
    '.gf-soon{display:inline-block;margin-left:8px;font-size:12px;background:#efe6cf;color:#7a5b22;border-radius:6px;padding:2px 7px;font-weight:600}' +
    '.gf-card .action.wa{background:#1f8f4e}' +
    '.gf-card .action[disabled]{opacity:.45;cursor:not-allowed}' +
    '.gf-all{border-top:1px solid #dedad2;margin-top:16px;padding-top:12px}' +
    '.gf-empty{color:#64758a;font-size:14px}';

  function card(g, i) {
    var off = g.status !== 'live';
    return '<div class="gf-card' + (off ? ' soon' : '') + '" data-i="' + i + '">' +
      '<b>' + esc(g.icon + ' ' + g.title) + '</b>' + (off ? '<span class="gf-soon">готовится — скоро</span>' : '') +
      '<p>' + esc(g.about) + '</p>' +
      '<div class="actions">' +
      '<button class="action wa" data-act="wa"' + (off ? ' disabled' : '') + '>💬 В WhatsApp</button>' +
      '<button class="action" data-act="msg"' + (off ? ' disabled' : '') + '>Скопировать сообщение</button>' +
      '<button class="action alt" data-act="link"' + (off ? ' disabled' : '') + '>Только ссылку</button>' +
      '</div></div>';
  }

  function render(q) {
    var box = document.getElementById('gifts-list');
    if (!box) return;
    q = (q || '').trim().toLowerCase();
    var html = '', last = null, n = 0;
    GIFTS.forEach(function (g, i) {
      var hay = (g.section + ' ' + g.title + ' ' + g.about + ' ' + g.keys).toLowerCase();
      if (q && hay.indexOf(q) < 0) return;
      if (g.section !== last) { html += '<div class="gf-sec">' + esc(g.section) + '</div>'; last = g.section; }
      html += card(g, i); n++;
    });
    box.innerHTML = n ? html : '<p class="gf-empty">Под этот вопрос бесплатного издания пока нет — ответьте сами или отправьте общую страницу ниже. Тему запишите в «Неучтённый спрос», чтобы Роман знал, что делать следующим.</p>';
  }

  function init() {
    var st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);
    render('');
    var s = document.getElementById('gifts-search');
    if (s) s.addEventListener('input', function () { render(s.value); });
    var box = document.getElementById('gifts-list');
    if (box) box.addEventListener('click', function (e) {
      var b = e.target.closest('button[data-act]'); if (!b || b.disabled) return;
      var g = GIFTS[+b.closest('.gf-card').getAttribute('data-i')];
      var a = b.getAttribute('data-act');
      if (a === 'wa') wa(msg(g)); else if (a === 'msg') copy(msg(g)); else copy(link(g));
    });
    var aw = document.getElementById('gifts-all-wa'), ac = document.getElementById('gifts-all-copy');
    if (aw) aw.addEventListener('click', function () { wa(ALL_MSG); });
    if (ac) ac.addEventListener('click', function () { copy(ALL_MSG); });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
