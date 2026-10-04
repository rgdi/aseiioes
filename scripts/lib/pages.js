/**
 * pages.js — plantillas de todas las páginas del sitio.
 * Cada función devuelve el HTML del <main>.
 */
import { layout, hydrateArt, avatar, icon } from './layout.js';
import { esc, escAttr, inline, classNames, slugify, parseDate } from './util.js';
import { renderBody, faqHtml } from './blocks.js';
import { digestiveArt, bagArt, peopleArt } from './art.js';
import { imgTag, anchoYAlto } from './imagen.js';

const ART = { digestive: digestiveArt, bag: bagArt, people: peopleArt };

/** Convierte el título del hero: "a *b*\nc" -> "a <em>b</em><br>c" */
function heroTitle(t = '') {
  return t
    .split('\n')
    .map((line) => `<span class="hero__tline">${inline(line).replace(/\*([^*]+)\*/g, '<em>$1</em>')}</span>`)
    .join('');
}

const coverArt = (p, extra = '') => {
  const kind = ART[p.art] ? p.art : 'digestive';
  return `<span class="post__art post__art--${kind}">%%ART:${ART[kind].name}:${p.slug}${extra}%%</span>`;
};


/** Encabezado de sección sólo para lectores de pantalla: nombra el grupo de
 *  tarjetas y evita que la jerarquía salte de <h1> a <h3>. */
const h2sr = (text) => `<h2 class="sr-only">${esc(text)}</h2>`;

/** WebPage genérica: describe cualquier página interna que no tenga uno propio.
 *  Sin esto, /servicios/, /derechos/, /recursos/ y /legal/ se quedaban sin
 *  datos estructurados. */
const webPageLd = (site, { url, name, desc, type = 'WebPage' }) => ({
  '@context': 'https://schema.org',
  '@type': type,
  name,
  headline: name,
  description: desc,
  url: `${site.url}${url}`,
  inLanguage: 'es-ES',
  isPartOf: { '@type': 'WebSite', name: site.name, url: site.url },
  about: { '@type': 'NGO', name: site.shortName || site.name, url: site.url },
});


const btn = (b, kind = '') =>
  b ? `<a class="btn ${kind}" href="${escAttr(b.url || '#')}">${esc(b.label || '')}</a>` : '';

/* ── Tarjeta de artículo ─────────────────────────────────────────────────── */
export function postCard(p, { feature = false } = {}) {
  return `<article class="${classNames('post', feature && 'post--feature')}" data-reveal
    data-cat="${escAttr(p.category)}" data-date="${escAttr(p.dateISO)}"
    data-title="${escAttr(p.title.toLowerCase())}" data-tags="${escAttr((p.tags || []).join(' ').toLowerCase())}">
    <div class="post__cover cover--${escAttr(p.cover)}">
      <span class="post__cat">${esc(p.category)}</span>
      ${coverArt(p)}
    </div>
    <div class="post__body">
      <div class="post__meta"><b>${esc(p.dateShort)}</b><span>${esc(p.reading)} min de lectura</span></div>
      <h3><a href="${escAttr(p.url)}">${esc(p.title)}</a></h3>
      <p class="post__ex">${esc(p.excerpt)}</p>
      ${(p.tags || []).length ? `<div class="post__tags">${p.tags.slice(0, 3).map((t) => `<span class="post__tag">${esc(t)}</span>`).join('')}</div>` : ''}
    </div>
  </article>`;
}

/* ── Piezas reutilizables ─────────────────────────────────────────────────── */

/** Bloque "a quién acompañamos": deja claro el alcance de la asociación para
 *  que nadie llegue a una web de EII pensando que es sólo de Crohn. */
const alcance = (site) => {
  const a = site.alcance;
  if (!a) return '';
  return `
<section class="section wash" id="alcance">
  <div class="wrap">
    <div class="section-head" data-reveal>
      <span class="eyebrow is-blue">${esc(a.eyebrow || '')}</span>
      <h2>${inline(a.h2 || '')}</h2>
      <p class="lead">${inline(a.lead || '')}</p>
    </div>
    <div class="alcance" data-reveal>
      ${(a.eii || []).map((x) => `
      <div class="alcance__i">
        <h3>${esc(x.name || '')}</h3>
        <p>${esc(x.text || '')}</p>
      </div>`).join('')}
    </div>
    ${a.ostomia ? `
    <div class="alcance__ostomia" data-reveal>
      <h3>${esc(a.ostomia.title || '')}</h3>
      <p>${inline(a.ostomia.text || '')}</p>
    </div>` : ''}
  </div>
</section>`;
};

const ctaBand = (site, { title, text, cta } = {}) => `
<section class="section-sm">
  <div class="wrap">
    <div class="cta-band" data-reveal>
      <div>
        <h2>${esc(title || '¿Necesitas que te echemos una mano?')}</h2>
        <p>${inline(text || 'Escríbenos y te contamos qué podemos hacer por tu caso. La primera consulta es gratuita.')}</p>
      </div>
      <div class="btn-row">
        ${btn(cta || site.cta, 'btn--white')}
        <a class="btn btn--ghost" href="mailto:${escAttr(site.email || '')}">${icon('mail', { size: 18 })} ${esc(site.email || 'Escríbenos')}</a>
      </div>
    </div>
  </div>
</section>`;

/** Preguntas frecuentes del sitio, en formato schema.org/FAQPage. */
const faqLd = (site) => (site.faq || []).map((f) => ({ q: f.q, a: f.a }));

const faqSection = (site) => `
<section class="section wash" id="faq">
  <div class="wrap wrap-narrow">
    <div class="section-head center" data-reveal>
      <span class="eyebrow">Preguntas frecuentes</span>
      <h2>lo que más nos preguntáis</h2>
      <p class="lead">Si tu duda no está aquí, escríbenos. Contestamos en persona y sin plantillas.</p>
    </div>
    ${faqHtml(site.faq || [], 'home-faq')}
  </div>
</section>`;

const blogRow = (posts, { title = 'últimos artículos', link = '/blog/', sub = '' } = {}) => `
<section class="section">
  <div class="wrap">
    <div class="section-head" data-reveal>
      <span class="eyebrow">Blog</span>
      <h2>${esc(title)}</h2>
      ${sub ? `<p class="lead">${inline(sub)}</p>` : ''}
    </div>
    <div class="post-grid">${posts.map((p) => postCard(p)).join('')}</div>
    <div class="btn-row" style="margin-top:34px;justify-content:center">
      <a class="btn btn--ghost" href="${link}">Ver todos los artículos ${icon('arrow', { size: 18 })}</a>
    </div>
  </div>
</section>`;

const pageHero = ({ eyebrow, h1, lead, breadcrumb = [] }) => `
<section class="article-hero wash">
  <div class="wrap">
    <nav class="breadcrumb" aria-label="Migas de pan">
      <a href="/">Inicio</a>
      ${breadcrumb.map((b) => `<span><a href="${escAttr(b.url)}">${esc(b.label)}</a></span>`).join('')}
    </nav>
    ${eyebrow ? `<span class="eyebrow is-blue">${esc(eyebrow)}</span>` : ''}
    <h1>${inline(h1)}</h1>
    ${lead ? `<p class="lead">${inline(lead)}</p>` : ''}
  </div>
</section>`;

/* ── Portada ─────────────────────────────────────────────────────────────── */
export function homePage({ site, posts }) {
  const h = site.hero || {};
  // El artículo más reciente se destaca abajo, en grande.
  const [featured, ...rest] = posts;
  const rights = posts.filter((p) => p.category === 'Derechos').slice(0, 3);
  // "Lo último" debe ser lo último de verdad y además equilibrado: se coge el
  // más reciente de cada categoría, para que no salgan tres de Salud seguidos.
  const porCategoria = [];
  for (const p of rest) {
    if (!porCategoria.some((x) => x.category === p.category)) porCategoria.push(p);
    if (porCategoria.length === 3) break;
  }
  const news = (porCategoria.length ? porCategoria : rest).slice(0, 3);
  const s = site.story || {};

  const body = `
<section class="hero wash">
  <div class="wrap hero__grid">
    <div>
      <span class="eyebrow is-blue">${esc(h.eyebrow || '')}</span>
      <h1>${heroTitle(h.title || '')}</h1>
      <p class="hero__lead lead">${inline(h.lead || '')}</p>
      <div class="btn-row">
        ${btn(h.ctaPrimary, '')}
        ${btn(h.ctaSecondary, 'btn--ghost')}
      </div>
      <div class="hero__badges">
        ${(h.badges || []).map((b) => `<span class="pill pill--dot">${esc(b)}</span>`).join('')}
      </div>
      <div class="hero__stats">
        ${(h.stats || []).map((x) => `<div class="hero__stat"><b>${esc(x.value)}</b><span>${esc(x.label)}</span></div>`).join('')}
      </div>
    </div>
    <div class="hero__art" data-reveal>%%ART:digestiveArt:hero-home%%</div>
  </div>
</section>

<div class="marquee" aria-hidden="true">
  <div class="marquee__track">
    ${[...(site.marquee || []), ...(site.marquee || [])].map((t) => `<span class="pill pill--outline">${esc(t)}</span>`).join('')}
  </div>
</div>

<section class="section" id="servicios">
  <div class="wrap">
    <div class="section-head" data-reveal>
      <span class="eyebrow">Qué hacemos</span>
      <h2>seis cosas que hacemos por ti</h2>
      <p class="lead">No somos una oficina de trámites. Somos un grupo de personas que lleva veinte años ayudándose entre sí, y que ha decidido ayudar a hacerlo también por ti.</p>
    </div>
    <div class="grid g3">
      ${(site.services || []).map((sv) => `
      <article class="card card--hover svc" data-reveal>
        <span class="svc__n">${esc(sv.n || '')}</span>
        <span class="card__ico">${icon(sv.icon || 'heart', { size: 24 })}</span>
        <h3>${esc(sv.title || '')}</h3>
        <p>${esc(sv.text || '')}</p>
        <ul class="svc__list">
          ${(sv.items || []).map((i) => `<li>${esc(i)}</li>`).join('')}
        </ul>
      </article>`).join('')}
    </div>
  </div>
</section>

<section class="section-sm">
  <div class="wrap">
    <div class="proof" data-reveal>
      ${(site.proof || []).map((p) => `<div class="proof__item"><b>${esc(p.value)}</b><span>${esc(p.label)}</span></div>`).join('')}
    </div>
  </div>
</section>

<section class="section wash">
  <div class="wrap">
    <div class="section-head" data-reveal>
      <span class="eyebrow is-blue">Cómo trabajamos</span>
      <h2>del problema a la solución, en cuatro pasos</h2>
      <p class="lead">Te contamos exactamente qué va a pasar cuando nos escribas, para que no te lleves sorpresas.</p>
    </div>
    <div class="steps" data-reveal>
      ${(site.steps || []).map((st) => `
      <div class="step">
        <h3>${esc(st.title || '')}</h3>
        <p class="small muted">${esc(st.text || '')}</p>
      </div>`).join('')}
    </div>
    <div class="btn-row" style="margin-top:34px;justify-content:center">
      <a class="btn" href="/servicios/">Ver todos los servicios</a>
    </div>
  </div>
</section>

${rights.length ? `
<section class="section">
  <div class="wrap">
    <div class="section-head" data-reveal>
      <span class="eyebrow">Derechos</span>
      <h2>lo que puedes reclamar, y cómo</h2>
      <p class="lead">Tu enfermedad no puede costarte el sueldo, el acceso al tratamiento ni la dignidad. Estas son las vías que usamos cada semana.</p>
    </div>
    <div class="post-grid post-grid--${rights.length === 2 ? '2' : rights.length === 1 ? '1' : '3'}">${rights.map((p) => postCard(p)).join('')}</div>
    <div class="btn-row" style="margin-top:34px;justify-content:center">
      <a class="btn btn--ghost" href="/derechos/">Todos tus derechos</a>
    </div>
  </div>
</section>` : ''}

<section class="section wash-sand">
  <div class="wrap story">
    <div class="story__art" data-reveal>%%ART:peopleArt:story-home%%</div>
    <div data-reveal>
      <span class="eyebrow is-blue">Historias</span>
      <blockquote class="story__quote">“${esc(s.quote || '')}”</blockquote>
      <div class="story__by">
        <span class="story__ava">AS</span>
        <div><b>${esc(s.author || '')}</b><span>${esc(s.role || '')}</span></div>
      </div>
      <p class="lead" style="margin-top:22px">${inline(s.text || '')}</p>
      <div class="btn-row" style="margin-top:24px">${btn(s.cta, 'btn--ghost')}</div>
    </div>
  </div>
</section>

${blogRow(news.length ? news : posts.slice(0, 3), { sub: 'Información útil, novedades y lo que más nos preguntáis, escrito por el equipo y por quienes nos cuentan su experiencia.' })}

${featured ? `
<section class="section-sm">
  <div class="wrap">
    <div class="section-head" data-reveal>
      <span class="eyebrow is-blue">Recién publicado</span>
      <h2>lo último que hay en el blog</h2>
    </div>
    <div class="post-grid post-grid--feature">${postCard(featured, { feature: true })}</div>
  </div>
</section>` : ''}

${faqSection(site)}

${ctaBand(site)}`;

  return layout({
    site,
    title: '',
    desc: site.description,
    body,
    url: '/',
    faq: faqLd(site),
    breadcrumbs: [{ label: 'Inicio', url: '/' }],
    // NGO, WebSite y SearchAction los añade layout() de forma centralizada.
  });
}

/* ── Listado del blog ────────────────────────────────────────────────────── */
export function blogPage({ site, posts }) {
  const cats = [...new Set(posts.map((p) => p.category))];

  const body = `
${pageHero({
  eyebrow: 'Blog',
  h1: 'artículos, guías y lo que más nos preguntáis',
  lead: 'Todo lo que publicamos, ordenado por fecha. Usa los filtros para ir directamente al tema que te interesa.',
  breadcrumb: [{ label: 'Blog', url: '/blog/' }],
})}

<section class="section-sm" style="padding-top:0">
  <div class="wrap">
    <div class="filters" data-filter-bar>
      <button class="filter" type="button" data-filter="all" aria-pressed="true">Todos</button>
      ${cats.map((c) => `<button class="filter" type="button" data-filter="${escAttr(c)}" aria-pressed="false">${esc(c)}</button>`).join('')}
      <label class="search">
        <span class="ico">${icon('search', { size: 18 })}</span>
        <input type="search" id="blog-search" placeholder="Buscar en el blog…" aria-label="Buscar artículos" autocomplete="off">
      </label>
    </div>

    ${h2sr('Listado de artículos')}
    <div class="post-grid" id="blog-grid">
      ${posts.map((p) => postCard(p)).join('')}
    </div>
    <p class="empty" id="blog-empty">No encontramos artículos con ese criterio. Prueba con otro término o quita los filtros.</p>
  </div>
</section>

${ctaBand(site, { title: '¿No encuentras lo que buscas?', text: 'Cada caso es distinto. Cuéntanos el tuyo y lo orientamos sin compromiso.' })}`;

  return layout({
    site,
    title: 'Blog de artículos y guías',
    desc: 'Artículos y noticias sobre enfermedad inflamatoria intestinal, ostomía, derechos y calidad de vida en Asturias.',
    body,
    url: '/blog/',
    active: '/blog/',
    breadcrumbs: [{ label: 'Inicio', url: '/' }, { label: 'Blog', url: '/blog/' }],
    jsonLd: [{
      '@type': 'Blog',
      name: `Blog de ${site.shortName}`,
      url: `${site.url}/blog/`,
      blogPost: posts.slice(0, 10).map((p) => ({
        '@type': 'BlogPosting',
        headline: p.title,
        url: `${site.url}${p.url}`,
        datePublished: p.dateISO,
        author: { '@type': 'Organization', name: site.name },
      })),
    }],
  });
}

/* ── Artículo ────────────────────────────────────────────────────────────── */
export function postPage({ site, post, prev, next, related = [] }) {
  const { html, toc } = renderBody(post.blocks);

  const body = `
<article>
<section class="article-hero" style="padding-top:0">
  <div class="wrap">
    <nav class="breadcrumb" aria-label="Migas de pan">
      <a href="/">Inicio</a>
      <span><a href="/blog/">Blog</a></span>
      <span><a href="/blog/?cat=${escAttr(post.category)}">${esc(post.category)}</a></span>
    </nav>
    <div class="split" style="align-items:end">
      <div>
        <h1>${inline(post.title)}</h1>
        <div class="article-meta">
          <span><b>${esc(post.dateShort)}</b></span>
          <span>${esc(post.reading)} min de lectura</span>
          <span>${esc(post.author)}</span>
        </div>
      </div>
      <div class="post__cover cover--${escAttr(post.cover)}" data-reveal>${coverArt(post, '-hero')}</div>
    </div>
  </div>
</section>

<section class="wrap article-layout">
  <div class="prose" data-prose>
    ${html}
    <footer class="article-foot">
      <div class="author-box">
        ${avatar(post.author)}
        <div>
          <b>${esc(post.author)}</b>
          <span>${esc(post.category)} · ${esc(post.dateShort)}${post.updatedDate ? ` · actualizado el ${esc(post.updatedDate.short)}` : ''}</span>
        </div>
      </div>
      ${(post.tags || []).length ? `<div class="post__tags" style="margin-top:22px">${post.tags.map((t) => `<span class="post__tag">${esc(t)}</span>`).join('')}</div>` : ''}
      <nav class="post-nav" aria-label="Artículo anterior y siguiente">
        ${prev ? `<a class="prev" href="${escAttr(prev.url)}"><small>Artículo anterior</small><b>${esc(prev.title)}</b></a>` : '<span></span>'}
        ${next ? `<a class="next" href="${escAttr(next.url)}"><small>Artículo siguiente</small><b>${esc(next.title)}</b></a>` : '<span></span>'}
      </nav>
    </footer>
  </div>

  <aside class="aside">
    ${toc.length ? `
    <div class="aside__box">
      <h2>En este artículo</h2>
      <nav class="toc" data-toc>
        ${toc.map((t) => `<a href="#${escAttr(t.id)}" data-toc-link="${escAttr(t.id)}">${esc(t.text)}</a>`).join('')}
      </nav>
    </div>` : ''}
    <div class="aside__box aside__cta">
      <h2>¿Te pasa esto a ti?</h2>
      <p>La primera revisión de tu caso es gratuita y sin compromiso. Escríbenos y te contamos qué podemos hacer.</p>
      <a class="btn btn--white btn--sm" href="mailto:${escAttr(site.email || '')}">${icon('mail', { size: 18 })} Escríbenos</a>
    </div>
    ${related.length ? `
    <div class="aside__box">
      <h2>Seguir leyendo</h2>
      <div class="toc">
        ${related.map((r) => `<a href="${escAttr(r.url)}">${esc(r.title)}</a>`).join('')}
      </div>
    </div>` : ''}
  </aside>
</section>
</article>

${related.length ? blogRow(related, { title: 'te puede interesar', link: '/blog/' }) : ''}`;

  return layout({
    site,
    title: post.title,
    desc: post.metaDescription,
    body,
    url: post.url,
    type: 'article',
    published: post.dateISO,
    updated: post.updated ? post.updatedDate.iso : post.dateISO,
    author: post.author,
    section: post.category,
    tags: post.tags || [],
    keywords: (post.tags || []).join(', '),
    wordCount: (post.text || '').split(/\s+/).filter(Boolean).length,
    breadcrumbs: [
      { label: 'Inicio', url: '/' },
      { label: 'Blog', url: '/blog/' },
      { label: post.category, url: `/blog/?cat=${post.category}` },
    ],
    faq: (post.blocks || []).filter((b) => b.type === 'faq')
      .flatMap((b) => (b.items || []).map((i) => ({ q: i.q, a: i.a }))),
    jsonLd: [{
      '@type': 'BlogPosting',
      headline: post.title,
      description: post.excerpt,
      url: `${site.url}${post.url}`,
      datePublished: post.dateISO,
      dateModified: post.updated || post.dateISO,
      inLanguage: 'es',
      articleSection: post.category,
      keywords: (post.tags || []).join(', '),
      author: { '@type': 'Organization', name: site.name },
      publisher: {
        '@type': 'Organization',
        name: site.name,
        url: site.url,
        logo: { '@type': 'ImageObject', url: `${site.url}/favicon.svg` },
      },
    }],
  });
}

/* ── Servicios ───────────────────────────────────────────────────────────── */
export function servicesPage({ site, posts }) {
  const body = `
${pageHero({
  eyebrow: 'Qué hacemos',
  h1: 'todo lo que hacemos por ti, sin letra pequeña',
  lead: 'Acompañamiento, asesoría jurídica, formación y visibilidad. Cada uno de estos seis programas existe porque alguien lo pidió y porque otra persona lo necesitaba.',
  breadcrumb: [{ label: 'Qué hacemos', url: '/servicios/' }],
})}

<section class="section" style="padding-top:0">
  ${h2sr('Los seis programas de la asociación')}
  <div class="wrap">
    <div class="grid g2" style="gap:clamp(18px,2vw,28px)">
      ${(site.services || []).map((sv) => `
      <article class="card svc" data-reveal>
        <span class="svc__n">${esc(sv.n || '')}</span>
        <span class="card__ico">${icon(sv.icon || 'heart', { size: 24 })}</span>
        <h3>${esc(sv.title || '')}</h3>
        <p>${esc(sv.text || '')}</p>
        <ul class="svc__list">
          ${(sv.items || []).map((i) => `<li>${esc(i)}</li>`).join('')}
        </ul>
      </article>`).join('')}
    </div>
  </div>
</section>

<section class="section wash">
  <div class="wrap">
    <div class="section-head" data-reveal>
      <span class="eyebrow is-blue">Cómo trabajamos</span>
      <h2>cuatro pasos, sin sorpresas</h2>
      <p class="lead">Desde que nos escribes hasta que el caso se resuelve. Y después seguimos contigo.</p>
    </div>
    <div class="steps" data-reveal>
      ${(site.steps || []).map((st) => `
      <div class="step"><h3>${esc(st.title || '')}</h3><p class="small muted">${esc(st.text || '')}</p></div>`).join('')}
    </div>
  </div>
</section>

<section class="section">
  <div class="wrap">
    <div class="section-head" data-reveal>
      <span class="eyebrow">Formación</span>
      <h2>formamos también a profesionales</h2>
      <p class="lead">Cada año organizamos jornadas para enfermería, medicina, farmacia y atención primaria, porque muchas de las personas que atendéis a una persona ostomizada no habéis visto nunca una bolsa.</p>
    </div>
    <div class="grid g3">
      <div class="card" data-reveal><span class="card__ico card__ico--blue">${icon('heart', { size: 24 })}</span><h3>Jornadas para profesionales</h3><p>Unos contenidos claros sobre cuidados, producto, legislación y todo lo que necesita saber quien atiende a una persona con EII.</p></div>
      <div class="card" data-reveal><span class="card__ico card__ico--blue">${icon('people', { size: 24 })}</span><h3>Prácticas en unidades de ostomizados</h3><p>Acompañamos al personal durante sus primeras semanas, con un plan de integración hecho a medida.</p></div>
      <div class="card" data-reveal><span class="card__ico card__ico--blue">${icon('doc', { size: 24 })}</span><h3>Material para consultas</h3><p>Material descargable para explicar a un recién diagnosticado qué es una ostomía, qué cambia y qué puede pedir.</p></div>
    </div>
  </div>
</section>

${faqSection(site)}
${ctaBand(site)}`;

  return layout({
    site,
    title: 'Qué hacemos',
    desc: 'Los seis programas de la asociación: asesoría jurídica, acompañamiento clínico, ostomía, derechos, investigación y comunidad.',
    body,
    url: '/servicios/',
    active: '/servicios/',
    breadcrumbs: [{ label: 'Inicio', url: '/' }, { label: 'Qué hacemos', url: '/servicios/' }],
    faq: faqLd(site),
    jsonLd: [webPageLd(site, {
      url: '/servicios/',
      name: 'Qué hacemos · ASEIIO',
      desc: 'Los seis programas de la asociación: asesoría jurídica, acompañamiento clínico, ostomía, derechos, investigación y comunidad.',
      type: 'CollectionPage',
    })],
  });
}

/* ── Derechos ────────────────────────────────────────────────────────────── */
export function rightsPage({ site, posts }) {
  const rights = posts.filter((p) => p.category === 'Derechos').slice(0, 3);
  const body = `
${pageHero({
  eyebrow: 'Derechos',
  h1: 'lo que te corresponde, y cómo conseguirlo',
  lead: 'Tener una enfermedad inflamatoria intestinal o una ostomía no te hace menos capaz de trabajar, estudiar, viajar o tener una vida normal. Solo te hace falta saber qué papel te toca.',
  breadcrumb: [{ label: 'Derechos', url: '/derechos/' }],
})}

<section class="section" style="padding-top:0">
  ${h2sr('Vías para reclamar')}
  <div class="wrap grid g3">
    ${(site.rights || []).map((r) => `
    <article class="card card--hover" data-reveal>
      <span class="card__ico">${icon(r.icon || 'scales', { size: 24 })}</span>
      <h3>${esc(r.title || '')}</h3>
      <p>${esc(r.text || '')}</p>
    </article>`).join('')}
  </div>
</section>

<section class="section wash">
  <div class="wrap split">
    <div data-reveal>%%ART:bagArt:rights-hero%%</div>
    <div data-reveal>
      <span class="eyebrow is-blue">Asesoría gratuita</span>
      <h2>no tienes que saber de leyes. Para eso estamos nosotros</h2>
      <p class="lead">Cuéntanos qué te pasa y lo revisamos. Si no hay nada que reclamar, te lo decimos. Si lo hay, te decimos exactamente qué hacer y cuándo.</p>
      <div class="btn-row" style="margin-top:26px">
        <a class="btn" href="mailto:${escAttr(site.email || '')}">${icon('mail', { size: 18 })} Escríbenos</a>
        <a class="btn btn--ghost" href="/recursos/">Ver guías</a>
      </div>
    </div>
  </div>
</section>

${rights.length ? blogRow(rights, { title: 'guías paso a paso', sub: 'Instrucciones completas para hacer los trámites más solicitados.' }) : ''}

<section class="section wash-sand">
  <div class="wrap wrap-narrow">
    <div class="section-head center" data-reveal>
      <span class="eyebrow">Aviso legal</span>
      <h2>una advertencia honesta</h2>
    </div>
    <aside class="callout callout--legal" data-reveal>
      <span class="callout__ico">${icon('scales', { size: 22 })}</span>
      <div>
        <h2>Esto es orientación, no asesoramiento individual</h2>
        <p>La información de esta página tiene carácter orientativo y general. La legislación y los procedimientos cambian, y hay variables según la situación de cada persona. Si tu caso es concreto, escríbenos y lo revisamos contigo de forma personalizada, o consulta con un profesional del ámbito jurídico o de la salud.</p>
      </div>
    </aside>
  </div>
</section>

${ctaBand(site, { title: '¿Crees que te están discriminando?', text: 'Cuéntanoslo. El primer análisis de tu caso es gratuito y confidencial.' })}`;

  return layout({
    site,
    title: 'Derechos',
    desc: 'Certificado de discapacidad, tarjeta de ostomizado, derechos laborales y sanidad: tus derechos con enfermedad inflamatoria intestinal u ostomía.',
    body,
    url: '/derechos/',
    active: '/derechos/',
    breadcrumbs: [{ label: 'Inicio', url: '/' }, { label: 'Derechos', url: '/derechos/' }],
    jsonLd: [webPageLd(site, {
      url: '/derechos/',
      name: 'Derechos · ASEIIO',
      desc: 'Certificado de discapacidad, tarjeta de ostomizado, derechos laborales y sanidad con enfermedad inflamatoria intestinal u ostomía.',
    })],
  });
}

/* ── Asociación ──────────────────────────────────────────────────────────── */
export function aboutPage({ site, posts }) {
  const t = site.team || [];
  const body = `
${pageHero({
  eyebrow: 'La asociación',
  h1: 'somos personas con una etiqueta común y experiencias muy distintas',
  lead: 'ASEIIO nació de un grupo de personas que llevaba años ayudándose en un despacho demasiado pequeño. Seguimos haciendo exactamente lo mismo, pero con más gente.',
  breadcrumb: [{ label: 'Asociación', url: '/asociacion/' }],
})}

${alcance(site)}

<section class="section" style="padding-top:0">
  <div class="wrap split">
    <div data-reveal>
      <span class="eyebrow is-blue">Qué nos guía</span>
      <h2>cuatro cosas en las que creemos</h2>
      <div class="grid g2" style="margin-top:26px">
        ${(site.valores || []).map((v) => `
        <div class="card" style="padding:20px 22px">
          <p style="font-family:var(--ff-display);font-size:1.02rem;color:var(--ink)">${esc(v)}</p>
        </div>`).join('')}
      </div>
    </div>
    <div data-reveal>%%ART:peopleArt:about-hero%%</div>
  </div>
</section>

<section class="section wash">
  <div class="wrap">
    <div class="section-head" data-reveal>
      <span class="eyebrow">Junta directiva</span>
      <h2>quiénes mantienen esto en pie</h2>
      <p class="lead">Todas las personas de la junta son socias voluntarias. Nadie cobra por estar aquí.</p>
    </div>
    <div class="grid g4">
      ${t.map((x) => `
      <div class="card team-card" data-reveal>
        ${avatar(x.name, 54)}
        <h3 class="team-card__name">${esc(x.name || '')}</h3>
        <p class="small muted">${esc(x.role || '')}</p>
      </div>`).join('')}
    </div>
  </div>
</section>

<section class="section" id="hazte">
  <div class="wrap split">
    <div data-reveal>%%ART:digestiveArt:about-join%%</div>
    <div data-reveal>
      <span class="eyebrow is-blue">Hazte socia/o</span>
      <h2>asociarse cuesta poco y cambia mucho</h2>
      <p class="lead">Con la cuota anual sostienes la asesoría jurídica gratuita, las jornadas de formación y las campañas de visibilización. Y de paso tienes un sitio donde ir cuando lo necesites.</p>
      <ul class="svc__list" style="margin-top:20px">
        <li>Asesoría jurídica sin coste para personas socias</li>
        <li>Grupos de ayuda entre pares y acompañamiento en consultas</li>
        <li>Boletín y actividades periódicas</li>
        <li>Formación gratuita para ti y para tu entorno laboral</li>
      </ul>
      <div class="btn-row" style="margin-top:28px">
        <a class="btn" href="mailto:${escAttr(site.email || '')}?subject=Hazerme%20socia%2Fo">Quiero asociarme</a>
        <a class="btn btn--ghost" href="mailto:${escAttr(site.email || '')}?subject=Cuota%20de%20sociedad">Preguntar por la cuota</a>
      </div>
    </div>
  </div>
</section>

<section class="section wash-sand" id="contacto">
  <div class="wrap">
    <div class="section-head center" data-reveal>
      <span class="eyebrow">Contacto</span>
      <h2>escríbenos, de verdad</h2>
      <p class="lead">Contesta una persona, no un robot. Si es urgente, marca el teléfono y te cogemos.</p>
    </div>
    <div class="grid g3">
      <a class="card card--hover" data-reveal href="mailto:${escAttr(site.email || '')}">
        <span class="card__ico">${icon('mail', { size: 24 })}</span>
        <h3>Correo electrónico</h3><p>${esc(site.email || '')}</p>
      </a>
      <a class="card card--hover" data-reveal href="tel:${escAttr((site.phone || '').replace(/\s/g, ''))}">
        <span class="card__ico card__ico--blue">${icon('phone', { size: 24 })}</span>
        <h3>Teléfono</h3><p>${esc(site.phone || '')}</p>
      </a>
      <div class="card" data-reveal>
        <span class="card__ico card__ico--sand">${icon('pin', { size: 24 })}</span>
        <h3>${esc(site.address || 'Asturias')}</h3>
        <p>${esc(site.hours || '')}<br>El resto, cita previa.</p>
      </div>
    </div>
  </div>
</section>

${posts.length ? blogRow(posts.slice(0, 3), { title: 'lo último que hemos publicado' }) : ''}
${ctaBand(site, { title: '¿Quieres que hablemos?', text: 'Podemos ir a tu centro, a tu empresa o a tu asociación. Solo hay que organizarlo.', cta: { label: 'Ver servicios', url: '/servicios/' } })}`;

  return layout({
    site,
    title: 'La asociación',
    desc: 'Quiénes somos, a quién acompañamos —Crohn, colitis y toda EII, y toda persona ostomizada—, y cómo asociarte.',
    body,
    url: '/asociacion/',
    active: '/asociacion/',
    breadcrumbs: [{ label: 'Inicio', url: '/' }, { label: 'Asociación', url: '/asociacion/' }],
    jsonLd: [{
      '@type': 'AboutPage',
      name: `Sobre ${site.shortName}`,
      url: `${site.url}/asociacion/`,
    }],
  });
}

/* ── Recursos ────────────────────────────────────────────────────────────── */
export function resourcesPage({ site }) {
  const body = `
${pageHero({
  eyebrow: 'Recursos',
  h1: 'guías, modelos y descargas',
  lead: 'Documentos practicales que puedes usar hoy mismo. Si necesitas alguno adaptado a tu caso, pídenoslo por correo.',
  breadcrumb: [{ label: 'Recursos', url: '/recursos/' }],
})}

<section class="section" style="padding-top:0">
  ${h2sr('Documentos disponibles')}
  <div class="wrap grid g2" style="gap:clamp(14px,1.6vw,20px)">
    ${(site.resources || []).map((r) => `
    <div class="res-item" data-reveal>
      <span class="res-item__ico">${icon(r.icon || 'doc', { size: 24 })}</span>
      <div>
        <h3>${esc(r.title || '')}</h3>
        <p>${esc(r.text || '')}</p>
        <div class="res-item__meta">
          <span>${esc(r.meta || '')}</span>
          <a href="mailto:${escAttr(site.email || '')}?subject=${encodeURIComponent('Solicitud: ' + (r.title || ''))}">Solicitar ${icon('arrow', { size: 15 })}</a>
        </div>
      </div>
    </div>`).join('')}
  </div>
</section>

<section class="section wash">
  <div class="wrap split">
    <div data-reveal>
      <span class="eyebrow is-blue">Plantillas</span>
      <h2>escribe bien, y escribe a tiempo</h2>
      <p class="lead">La diferencia entre un rechazo y una concesión suele estar en cómo se redacta la solicitud y en la fecha en la que se presenta. Tenemos modelos que funcionan.</p>
      <div class="btn-row" style="margin-top:26px">
        <a class="btn" href="mailto:${escAttr(site.email || '')}?subject=Plantillas%20y%20modelos">Pedir plantillas</a>
      </div>
    </div>
    <div class="grid g2">
      <div class="card" data-reveal><span class="card__ico">${icon('doc', { size: 22 })}</span><h3>Solicitud de discapacidad</h3><p>Modelo con los apartados que el evaluador mira de verdad.</p></div>
      <div class="card" data-reveal><span class="card__ico card__ico--blue">${icon('chat', { size: 22 })}</span><h3>Carta a la empresa</h3><p>Cómo pedir una adaptación sin arriesgar tu puesto.</p></div>
      <div class="card" data-reveal><span class="card__ico card__ico--blue">${icon('scales', { size: 22 })}</span><h3>Reclamación administrativa</h3><p>Estructura para reclamar un rechazo de prestación.</p></div>
      <div class="card" data-reveal><span class="card__ico card__ico--sand">${icon('card', { size: 22 })}</span><h3>Solicitud de tarjeta</h3><p>Documentación que hay que aportar y dónde presentarla.</p></div>
    </div>
  </div>
</section>

${faqSection(site)}
${ctaBand(site, { title: '¿Falta algún documento?', text: 'Dinos cuál necesitas y lo hacemos, aunque haya que escribirlo desde cero.', cta: { label: 'Escríbenos', url: `mailto:${site.email || ''}` } })}`;

  return layout({
    site,
    title: 'Recursos',
    desc: 'Guías, plantillas y modelos de escritos para Defender tus derechos con enfermedad inflamatoria intestinal u ostomía.',
    body,
    url: '/recursos/',
    active: '/recursos/',
    breadcrumbs: [{ label: 'Inicio', url: '/' }, { label: 'Recursos', url: '/recursos/' }],
    faq: faqLd(site),
    jsonLd: [webPageLd(site, {
      url: '/recursos/',
      name: 'Recursos · ASEIIO',
      desc: 'Guías, modelos escritos y documentos para personas con enfermedad inflamatoria intestinal u ostomía.',
      type: 'CollectionPage',
    })],
  });
}

/* ── Aviso legal y privacidad ────────────────────────────────────────────── */
export function legalPage({ site }) {
  const body = `
${pageHero({
  eyebrow: 'Legal',
  h1: 'aviso legal y política de privacidad',
  lead: 'Texto de ejemplo. Antes de publicar, revísalo y sustitúyelo por el de tu asesoría jurídica.',
  breadcrumb: [{ label: 'Aviso legal', url: '/legal/' }],
})}

<section class="section" style="padding-top:0">
  <div class="wrap wrap-narrow prose">
    <aside class="callout callout--warn">
      <span class="callout__ico">${icon('clock', { size: 22 })}</span>
      <div>
        <h2>Contenido de ejemplo</h2>
        <p>Este apartado está pensado para que la asociación lo adapte con ayuda de su asesoría. No publiques estos textos tal cual.</p>
      </div>
    </aside>
    <h2>1. Titularidad</h2>
    <p>${esc(site.name)}, con domicilio en ${esc(site.address || 'Asturias')} y correo de contacto ${esc(site.email || '')}.</p>
    <h2>2. Objeto del sitio</h2>
    <p>Este sitio tiene fines informativos y de divulgación. La información publicada tiene carácter orientativo y no sustituye el asesoramiento jurídico, médico o sanitario individual.</p>
    <h2>3. Datos personales</h2>
    <p>Este sitio no utiliza cookies publicitarias ni herramientas de seguimiento. Los datos que nos envías por correo se utilizan únicamente para atender tu consulta.</p>
    <h2>4. Propiedad intelectual</h2>
    <p>Los textos y elementos gráficos de este sitio pertenecen a la asociación. Puedes citar y enlazar nuestros contenidos citando la fuente.</p>
    <h2>5. Enlaces externos</h2>
    <p>No somos responsables de los contenidos de terceros. Si detectas un enlace roto o un contenido que vulnere derechos, avísanos.</p>
    <h2>6. Accesoibilidad</h2>
    <p>Trabajamos para que este sitio sea utilizable con teclado, lectores de pantalla y distintos tamaños de pantalla. Si encuentras una barrera, cuéntanosla.</p>
  </div>
</section>`;

  return layout({
    site,
    title: 'Aviso legal',
    desc: 'Aviso legal, política de privacidad y tratamiento de datos personales del sitio web de ASEIIO. Cómo ejercer tus derechos de acceso, rectificación y supresión.',
    body,
    url: '/legal/',
    breadcrumbs: [{ label: 'Inicio', url: '/' }, { label: 'Aviso legal', url: '/legal/' }],
    jsonLd: [webPageLd(site, {
      url: '/legal/',
      name: 'Aviso legal y política de privacidad · ASEIIO',
      desc: 'Aviso legal, política de privacidad y datos personales del sitio de ASEIIO.',
    })],
  });
}


/* ── Temas ────────────────────────────────────────────────────────────────── */

const TEMA_ICON = {
  Derechos: 'scales', Salud: 'heart', Actualidad: 'spark', Testimonios: 'quote',
};

const TEMA_LEAD = {
  Derechos: 'Cómo pedir lo que te corresponde, con plazos y paperwork.',
  Salud: 'Lo que pasa en el cuerpo y en la consulta, sin jerga.',
  Actualidad: 'Lo que ha cambiado y lo que está entrando.',
  Testimonios: 'Lo que cuentan quienes pasan por lo mismo que tú.',
};

/**
 * Índice por temas. Antes el pie tenía un enlace "Artículos por tema" que
 * llevaba al blog, duplicando el enlace de al lado. Con esta página cada
 * bloque de artículos tiene su propia dirección, que es lo que se indexa.
 */
export function topicsPage({ site, posts }) {
  const cats = [...new Set(posts.map((p) => p.category))];
  const body = `
${pageHero({
  eyebrow: 'Temas',
  h1: 'artículos por tema',
  lead: 'Todo lo que hemos publicado, agrupado por el motivo por el que probablemente lo estás buscando.',
  breadcrumb: [{ label: 'Temas', url: '/temas/' }],
})}

${cats.map((c) => {
  const ps = posts.filter((p) => p.category === c);
  return `
<section class="section" id="tema-${slugify(c)}" data-tema="${escAttr(c)}">
  <div class="wrap">
    <div class="section-head" data-reveal>
      <span class="eyebrow is-blue">${ps.length} ${ps.length === 1 ? 'artículo' : 'artículos'}</span>
      <h2>${esc(c.toLowerCase())}</h2>
      ${TEMA_LEAD[c] ? `<p class="lead">${esc(TEMA_LEAD[c])}</p>` : ''}
    </div>
    <div class="post-grid" data-reveal>
      ${ps.map((p) => postCard(p)).join('')}
    </div>
  </div>
</section>`;
}).join('')}

${ctaBand(site)}`;

  return layout({
    site,
    title: 'Artículos por tema',
    desc: 'Guías y artículos sobre derechos, salud, ostomía y novedades terapéuticas, agrupados por tema para encontrar rápido lo que buscas.',
    body,
    url: '/temas/',
    active: '/blog/',
    breadcrumbs: [{ label: 'Inicio', url: '/' }, { label: 'Temas', url: '/temas/' }],
    jsonLd: [{
      '@type': 'CollectionPage',
      name: 'Artículos por tema',
      description: 'Artículos de ASEIIO agrupados por tema: derechos, salud, ostomía y novedades terapéuticas.',
      mainEntity: {
        '@type': 'ItemList',
        itemListElement: posts.map((p, i) => ({
          '@type': 'ListItem',
          position: i + 1,
          name: p.title,
          url: `${site.url}${p.url}`,
        })),
      },
    }],
  });
}


/* ── Galería ──────────────────────────────────────────────────────────────── */

/** "2026-05-16" → "16 de mayo de 2026". Si la fecha no es válida, devuelve ''. */
const fechaLegible = (iso) => {
  if (!iso || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) return '';
  try {
    return parseDate(iso).long;
  } catch {
    return '';
  }
};

/**
 * Página de galería. El contenido vive en content/galeria.json, aparte del
 * resto, porque lo edita otra persona y no tiene por qué tocar site.json.
 *
 * Cada foto necesita alt (obligatorio) y, si puede, caption. El ancho y el
 * alto los lee el propio fichero: no hace falta escribirlos.
 */
export function galleryPage({ site, galeria }) {
  const g = galeria || {};
  const albums = g.albums || [];
  const total = albums.reduce((n, a) => n + (a.photos || []).length, 0);

  const cuerpo = albums.length ? albums.map((a) => `
<section class="section" style="padding-top:0">
  <div class="wrap">
    <div class="section-head" data-reveal>
      <span class="eyebrow is-blue">${esc(fechaLegible(a.date) || `${(a.photos || []).length} fotos`)}</span>
      <h2>${esc(a.title || '')}</h2>
      ${a.intro ? `<p class="lead">${inline(a.intro)}</p>` : ''}
    </div>
    <figure class="gal gal--${a.columns === 2 ? '2' : a.columns === 4 ? '4' : '3'}" data-reveal>
      <div class="gal__grid">
        ${(a.photos || []).filter((f) => f && f.src).map((f) => `<a class="gal__i" href="${escAttr(f.src)}" target="_blank" rel="noopener">
          ${imgTag({ src: f.src, alt: f.alt || '', caption: f.caption ? inline(f.caption) : '',
                    sizes: '(min-width: 900px) 33vw, (min-width: 560px) 50vw, 100vw' })}
        </a>`).join('')}
      </div>
    </figure>
  </div>
</section>`).join('') : `
<section class="section">
  <div class="wrap wrap-narrow prose" data-reveal>
    <p>Todavía no hay fotografías publicadas. En cuanto quieras añadir la primera,
    crea <code>content/galeria.json</code> con un álbum y una foto.</p>
  </div>
</section>`;

  const body = `
${pageHero({
  eyebrow: g.eyebrow || 'Galería',
  h1: g.h1 || 'galería',
  lead: g.lead || 'Fotos de las jornadas y los encuentros.',
  breadcrumb: [{ label: 'Galería', url: '/galeria/' }],
})}

${cuerpo}

${g.note ? `<section class="section-sm"><div class="wrap"><div class="callout callout--legal" data-reveal>
  <div><p class="callout__t">Derechos de imagen</p>${inline(g.note)}</div>
</div></div></section>` : ''}

${ctaBand(site)}`;

  return layout({
    site,
    title: g.title || 'Galería',
    desc: g.desc || 'Fotografías de las jornadas, grupos y encuentros de ASEIIO, con autorización de las personas que aparecen.',
    body,
    url: '/galeria/',
    breadcrumbs: [{ label: 'Inicio', url: '/' }, { label: 'Galería', url: '/galeria/' }],
    jsonLd: albums.length ? [{
      '@type': 'ImageGallery',
      name: g.h1 || 'Galería de ASEIIO',
      description: g.lead || '',
      numberOfItems: total,
      associatedMedia: albums.flatMap((a) => (a.photos || []).map((f) => ({
        '@type': 'ImageObject',
        contentUrl: `${site.url}${f.src}`,
        ...(f.caption ? { caption: f.caption } : {}),
        ...(anchoYAlto(f.src) ? { width: anchoYAlto(f.src).width, height: anchoYAlto(f.src).height } : {}),
      }))),
    }] : [],
  });
}

/* ── 404 ─────────────────────────────────────────────────────────────────── */
export function notFoundPage({ site, posts = [] }) {
  const body = `
<section class="section wash" style="min-height:62vh;display:grid;place-items:center">
  <div class="wrap wrap-narrow" style="text-align:center">
    <span class="eyebrow is-blue" style="justify-content:center">Error 404</span>
    <h1 style="max-width:18ch;margin-inline:auto">esta página no existe o cambió de sitio</h1>
    <p class="lead">Puede que el enlace estuviera mal escrito o que el artículo se haya movido. Vuelve al inicio y sigue desde ahí.</p>
    <div class="btn-row" style="justify-content:center;margin-top:28px">
      <a class="btn" href="/">Ir al inicio</a>
      <a class="btn btn--ghost" href="/blog/">Ver el blog</a>
    </div>
  </div>
</section>
${posts.length ? blogRow(posts.slice(0, 3), { title: 'mientras tanto, léenos esto' }) : ''}`;

  return layout({
    site,
    title: 'Página no encontrada',
    desc: 'La página que buscas no existe o ha cambiado de sitio. Desde aquí puedes volver a la portada, al blog o pedir ayuda a la asociación.',
    body,
    url: '/404.html',
    noindex: true,
  });
}
