/**
 * app.js — interacciones del cliente (sin dependencias).
 *
 *  1. Menú móvil
 *  2. Cabecera compacta al hacer scroll
 *  3. Acordeón FAQ accesible
 *  4. Filtros y búsqueda del blog
 *  5. Índice de contenido del artículo
 *  6. Animación de entrada al hacer scroll
 *  7. Salida a SVG real si el JavaScript está activo
 */
(function () {
  'use strict';

  document.documentElement.classList.remove('no-js');
  document.documentElement.classList.add('js');

  var $ = function (s, c) { return (c || document).querySelector(s); };
  var $$ = function (s, c) { return Array.prototype.slice.call((c || document).querySelectorAll(s)); };

  /* ── 1. Menú móvil ──────────────────────────────────────────────────── */
  var burger = $('#burger');
  var nav = $('#nav');
  if (burger && nav) {
    burger.addEventListener('click', function () {
      var open = document.body.classList.toggle('menu-open');
      burger.setAttribute('aria-expanded', open ? 'true' : 'false');
      burger.setAttribute('aria-label', open ? 'Cerrar menú' : 'Abrir menú');
    });
    $$('#nav a').forEach(function (a) {
      a.addEventListener('click', function () {
        document.body.classList.remove('menu-open');
        burger.setAttribute('aria-expanded', 'false');
      });
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && document.body.classList.contains('menu-open')) {
        document.body.classList.remove('menu-open');
        burger.setAttribute('aria-expanded', 'false');
        burger.focus();
      }
    });
  }

  /* ── 2. Cabecera al hacer scroll ───────────────────────────────────── */
  var header = $('#header');
  if (header) {
    var onScroll = function () {
      header.classList.toggle('is-stuck', window.scrollY > 12);
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
  }

  /* ── 3. FAQ accesible ──────────────────────────────────────────────── */
  $$('[data-faq]').forEach(function (item) {
    var btn = $('.faq-q', item);
    if (!btn) return;
    btn.addEventListener('click', function () {
      var open = item.classList.toggle('is-open');
      btn.setAttribute('aria-expanded', open ? 'true' : 'false');
    });
  });
  // Abre la primera pregunta de cada lista (mejor descubrimiento).
  $$('.faq-list').forEach(function (list) {
    var first = $('[data-faq]', list);
    if (!first) return;
    first.classList.add('is-open');
    var b = $('.faq-q', first);
    if (b) b.setAttribute('aria-expanded', 'true');
  });

  /* ── 4. Filtros y búsqueda del blog ────────────────────────────────── */
  var bar = $('[data-filter-bar]');
  var grid = $('#blog-grid');
  if (bar && grid) {
    var cards = $$('[data-cat]', grid);
    var empty = $('#blog-empty');
    var input = $('#blog-search');
    var activeCat = 'all';
    var term = '';

    var normalize = function (s) {
      return (s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    };

    var apply = function () {
      var shown = 0;
      var q = normalize(term);
      cards.forEach(function (c) {
        var okCat = activeCat === 'all' || c.getAttribute('data-cat') === activeCat;
        var hay = normalize([c.getAttribute('data-title'), c.getAttribute('data-tags'), c.getAttribute('data-cat')].join(' '));
        var okTerm = !q || hay.indexOf(q) !== -1;
        var vis = okCat && okTerm;
        c.style.display = vis ? '' : 'none';
        if (vis) shown++;
      });
      if (empty) empty.style.display = shown ? 'none' : 'block';
    };

    // Mantiene la URL sincronizada para poder compartir o guardar la vista.
    var syncUrl = function () {
      var p = new URLSearchParams();
      if (activeCat !== 'all') p.set('cat', activeCat);
      if (term) p.set('q', term);
      var qs = p.toString();
      history.replaceState(null, '', qs ? location.pathname + '?' + qs : location.pathname);
    };

    $$('[data-filter]', bar).forEach(function (b) {
      b.addEventListener('click', function () {
        activeCat = b.getAttribute('data-filter');
        $$('[data-filter]', bar).forEach(function (x) {
          x.setAttribute('aria-pressed', x === b ? 'true' : 'false');
        });
        apply();
        syncUrl();
      });
    });

    if (input) {
      input.addEventListener('input', function () { term = input.value.trim(); apply(); syncUrl(); });
      input.addEventListener('keydown', function (e) { if (e.key === 'Escape') { input.value = ''; term = ''; apply(); syncUrl(); } });
    }

    // Parámetros de la URL: /blog/?cat=Derechos&q=discapacidad
    var params = new URLSearchParams(location.search);
    var cat = params.get('cat');
    if (cat) {
      var btn = $$('[data-filter]', bar).filter(function (x) { return x.getAttribute('data-filter') === cat; })[0];
      if (btn) btn.click();
    }
    var q0 = params.get('q');
    if (q0 && input) { input.value = q0; term = q0.trim(); apply(); }
  }

  /* ── 5. Índice de contenido ───────────────────────────────────────── */
  var toc = $('[data-toc]');
  if (toc) {
    var links = $$('[data-toc-link]');
    var targets = links.map(function (l) { return document.getElementById(l.getAttribute('data-toc-link')); });
    if ('IntersectionObserver' in window && targets.filter(Boolean).length) {
      var io = new IntersectionObserver(function (entries) {
        entries.forEach(function (en) {
          if (!en.isIntersecting) return;
          links.forEach(function (l) { l.classList.remove('is-active'); });
          var active = links[targets.indexOf(en.target)];
          if (active) active.classList.add('is-active');
        });
      }, { rootMargin: '-20% 0px -70% 0px' });
      targets.filter(Boolean).forEach(function (t) { io.observe(t); });
    }
  }

  /* ── 6. Animación de entrada ──────────────────────────────────────── */
  var reveal = $$('[data-reveal]');
  if (reveal.length) {
    var showAll = function () { reveal.forEach(function (el) { el.classList.add('is-in'); }); };
    if ('IntersectionObserver' in window && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      var ro = new IntersectionObserver(function (entries, obs) {
        entries.forEach(function (en) {
          if (en.isIntersecting) { en.target.classList.add('is-in'); obs.unobserve(en.target); }
        });
      }, { rootMargin: '0px 0px -8% 0px', threshold: 0.05 });
      reveal.forEach(function (el) { ro.observe(el); });
      // Red de seguridad: nada se queda invisible por un fallo del observador.
      window.setTimeout(showAll, 2500);
      window.addEventListener('beforeprint', showAll);
    } else {
      showAll();
    }
  }

  /* ── 7. Enlace externo seguro ──────────────────────────────────────── */
  $$('a[href^="http"]').forEach(function (a) {
    if (a.hostname && a.hostname !== location.hostname) {
      a.rel = a.rel || 'noopener';
      a.target = a.target || '_blank';
    }
  });
})();
