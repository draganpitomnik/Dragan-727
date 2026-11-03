/* DRAGAN Manager — общая навигация для внутренних страниц.
   Логотип → кабинет, кнопка «Назад», хлебные крошки, быстрые разделы.
   На клиентских страницах (прайс, заявка, КП) панель видна только сотрудникам:
   кабинет ставит отметку dg_staff после входа. Клиенты её не видят. */
(function () {
  'use strict';

  // iPhone/iPad: не увеличивать страницу при нажатии в поле ввода (зум пальцами остаётся).
  var ios = /iP(hone|ad|od)/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  if (ios) {
    var vp = document.querySelector('meta[name=viewport]');
    if (vp && !/maximum-scale/.test(vp.content)) vp.content += ',maximum-scale=1';
  }

  function get(k) { try { return localStorage.getItem(k); } catch (_) { return null; } }

  var path = location.pathname;
  var file = path.split('/').pop() || 'index.html';
  var inTeam = /\/team\/[^\/]*$/.test(path);
  var ROOT = inTeam ? '../' : '';
  var CAB = ROOT + 'team/index.html';
  var ROUTES = {
    n: { price: 'n-cf56mb93ut.html', kp: 'kn-ufmo9qwfep.html' },
    v: { price: 'v-azsei6mqr7.html', kp: 'kv-0x7qiymt36.html' }
  };
  var NAMES = { n: 'Наталья', v: 'Василина' };
  var PAGES = {
    'index.html': { key: 'home', title: 'Кабинет' },
    'contracts.html': { key: 'contracts', title: 'Договоры' },
    'n-cf56mb93ut.html': { key: 'price', title: 'Прайс', m: 'n', ownSticky: true },
    'v-azsei6mqr7.html': { key: 'price', title: 'Прайс', m: 'v', ownSticky: true },
    'kn-ufmo9qwfep.html': { key: 'kp', title: 'КП', m: 'n' },
    'kv-0x7qiymt36.html': { key: 'kp', title: 'КП', m: 'v' },
    'z-pi1s0iv4ao.html': { key: 'orders', title: 'Заявка' }
  };
  var page = PAGES[file];
  if (!page) return;
  if (!inTeam && get('dg_staff') !== '1') return; // клиент — ничего не показываем

  var isHome = page.key === 'home';
  var m = page.m || get('dg_mgr');
  if (m !== 'n' && m !== 'v') m = null;

  function href(k) {
    if (k === 'contracts') return ROOT + 'team/contracts.html';
    if (k === 'orders') return ROOT + 'z-pi1s0iv4ao.html';
    if (k === 'price' || k === 'kp') return m ? ROOT + ROUTES[m][k] : CAB;
    return CAB + '#' + k;
  }

  var css = '' +
    '.dgnav{position:sticky;top:0;z-index:40;background:#14283F;color:#F5F0E7;box-shadow:0 2px 10px rgba(20,40,63,.18);font:15px/1.3 "Golos Text",system-ui,-apple-system,"Segoe UI",Roboto,sans-serif}' +
    '.dgnav.static{position:relative}' +
    '.dgnav-row{max-width:980px;margin:0 auto;display:flex;align-items:center;gap:10px;padding:8px 12px;min-height:44px;box-sizing:border-box}' +
    '.dgnav-logo{display:flex;align-items:center;flex:0 0 auto;padding:2px;border-radius:8px}' +
    '.dgnav-logo img{height:34px;width:auto;display:block}' +
    '.dgnav-back{flex:0 0 auto;border:1px solid rgba(245,240,231,.35);background:transparent;color:#F5F0E7;border-radius:9px;padding:8px 11px;font:inherit;font-weight:600;cursor:pointer;min-height:38px}' +
    '.dgnav-back[hidden]{display:none}' +
    '.dgnav-crumbs{display:flex;align-items:center;flex-wrap:nowrap;gap:6px;min-width:0;margin:0;padding:0;list-style:none;font-size:14px;overflow:hidden}' +
    '.dgnav-crumbs li{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}' +
    '.dgnav-crumbs li:first-child{flex:0 0 auto}.dgnav-crumbs li{min-width:0}' +
    '.dgnav-crumbs li+li:before{content:"›";margin-right:6px;opacity:.6}' +
    '.dgnav-crumbs a{color:#E4CC9E;text-decoration:none;font-weight:600}' +
    '.dgnav-crumbs [aria-current]{color:#fff;font-weight:600;overflow:hidden;text-overflow:ellipsis}' +
    '.dgnav-chips{max-width:980px;margin:0 auto;display:flex;gap:8px;overflow-x:auto;padding:10px 12px;-webkit-overflow-scrolling:touch;scrollbar-width:none;box-sizing:border-box}' +
    '.dgnav-chips::-webkit-scrollbar{display:none}' +
    '.dgnav-chips a{flex:0 0 auto;padding:8px 12px;border-radius:999px;background:#fff;border:1px solid #e3dccd;color:#14283F;text-decoration:none;font:600 14px/1.2 "Golos Text",system-ui,sans-serif;white-space:nowrap}' +
    '.dgnav-chips a[aria-current]{background:#14283F;color:#F5F0E7;border-color:#14283F}' +
    '.dg-logo-link{cursor:pointer}' +
    '@media print{.dgnav,.dgnav-chips{display:none!important}}';
  var st = document.createElement('style');
  st.textContent = css;
  document.head.appendChild(st);

  var nav = document.createElement('nav');
  nav.className = 'dgnav' + (page.ownSticky ? ' static' : '');
  nav.setAttribute('aria-label', 'Навигация кабинета');
  nav.innerHTML =
    '<div class="dgnav-row">' +
    '<a class="dgnav-logo" href="' + CAB + '" title="В кабинет"><img src="' + ROOT + 'logo.png" alt="Dragan — в кабинет"></a>' +
    '<button type="button" class="dgnav-back"' + (isHome ? ' hidden' : '') + '>← Назад</button>' +
    '<ol class="dgnav-crumbs"></ol>' +
    '</div>';
  var crumbs = nav.querySelector('.dgnav-crumbs');
  var back = nav.querySelector('.dgnav-back');

  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function setCrumbs(sub) {
    if (isHome && !sub) { crumbs.innerHTML = '<li aria-current="page">Кабинет</li>'; return; }
    var t = sub || (page.title + (page.m ? ' · ' + NAMES[page.m] : ''));
    crumbs.innerHTML = '<li><a href="' + CAB + '">Кабинет</a></li><li aria-current="page">' + esc(t) + '</li>';
  }
  setCrumbs();

  back.addEventListener('click', function () {
    if (isHome) { if (window.dgClosePanel) window.dgClosePanel(); return; }
    var r = document.referrer;
    if (history.length > 1 && r && r.indexOf(location.origin) === 0) history.back();
    else location.href = CAB;
  });

  // Кабинет сообщает об открытой/закрытой вкладке (Реквизиты, Доставка и т. д.)
  window.dgNavPanel = function (title) {
    if (!isHome) return;
    back.hidden = !title;
    setCrumbs(title || null);
  };

  var nodes = [nav];
  if (!isHome) {
    var items = [
      ['home', '⌂ Кабинет'], ['price', 'Прайс'], ['kp', 'КП'], ['contracts', 'Договоры'], ['orders', 'Заявки'],
      ['delivery', 'Адрес и доставка'], ['requisites', 'Реквизиты'], ['messages', 'Шаблоны'], ['knowledge', 'База знаний']
    ];
    var chips = document.createElement('div');
    chips.className = 'dgnav-chips';
    chips.setAttribute('aria-label', 'Разделы');
    chips.innerHTML = items.map(function (it) {
      var u = it[0] === 'home' ? CAB : href(it[0]);
      return '<a href="' + u + '"' + (it[0] === page.key ? ' aria-current="page"' : '') + '>' + it[1] + '</a>';
    }).join('');
    nodes.push(chips);
  }

  function mount() {
    var first = document.body.firstChild;
    nodes.forEach(function (n) { document.body.insertBefore(n, first); });
    // Логотип на самой странице тоже ведёт в кабинет (только для сотрудников)
    var logos = document.querySelectorAll('img.logo, .band > img');
    Array.prototype.forEach.call(logos, function (img) {
      img.classList.add('dg-logo-link');
      img.title = 'В кабинет';
      img.addEventListener('click', function () { location.href = CAB; });
    });
  }
  if (document.body) mount(); else document.addEventListener('DOMContentLoaded', mount);
})();
