/**
 * layout.js — estructura HTML:<head>, cabecera, pie y utilidades de página.
 */
import { esc, escAttr, inline, initials } from './util.js';
import { icon, digestiveArt, bagArt, peopleArt, miniMark } from './art.js';

const ART_FNS = { digestiveArt, bagArt, peopleArt };

/** Sustituye los marcadores %%ART:fn:id%% por el SVG correspondiente. */
export function hydrateArt(html) {
  const out = html.replace(/%%ART:(\w+):([\w-]+)%%/g, (_, fn, id) => {
    const make = ART_FNS[fn];
    // El prefijo de los identificadores de gradiente es el tipo de dibujo, no
    // el id: así dos ilustraciones del mismo tipo comparten definición y el
    // HTML no repite 8 gradientes idénticos por tarjeta.
    return make ? make({ id: `a${fn[0].toUpperCase()}${fn.slice(1)}` }) : '';
  });
  return dedupeDefs(out);
}

/**
 * Una portada lleva 26 ilustraciones y, antes de compartir definiciones, 47
 * gradientes repetidos: 94 KB de HTML que noidlaban a nada. Cuando dos bloques
 * <defs> son idénticos se conserva el primero y se borran los demás.
 */
function dedupeDefs(html) {
  const vistos = new Set();
  return html.replace(/<defs>[\s\S]*?<\/defs>/g, (bloque) => {
    if (vistos.has(bloque)) return '';
    vistos.add(bloque);
    return bloque;
  });
}

const SOCIAL_ICONS = {
  instagram: '<path d="M7 3h10a4 4 0 0 1 4 4v10a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4V7a4 4 0 0 1 4-4z"/><circle cx="12" cy="12" r="3.6"/><circle cx="17.2" cy="6.8" r="1" fill="currentColor" stroke="none"/>',
  facebook: '<path d="M14.5 8.5h2.2V5.4h-2.4c-2.3 0-3.6 1.4-3.6 3.7v1.5H8.4v3.1h2.3V20h3.2v-6.3h2.3l.4-3.1h-2.7V9.6c0-.7.3-1.1 1.1-1.1z"/>',
  twitter: '<path d="M4 4l7.2 9.1L4.3 20h2.1l5.7-5.6 4.4 5.6H20l-7.4-9.4L19 4h-2.1l-5.2 5.2L7.6 4z"/>',
  mail: '<path d="M3 6h18v12H3z"/><path d="m3.5 7 8.5 6 8.5-6"/>',
  youtube: '<path d="M10 9l5 3-5 3z"/><rect x="3" y="5" width="18" height="14" rx="4"/>',
};
// El enlace ya lleva aria-label, así que el SVG es decorativo y se marca.
const socialIcon = (n) => `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${SOCIAL_ICONS[n] || SOCIAL_ICONS.mail}</svg>`;

/**
 * Envoltorio de página.
 * @param {object} o
 * @param {string} o.title      título de la pestaña
 * @param {string} o.desc       meta description
 * @param {string} o.body       contenido principal
 */
/**
 * Marca del sitio. Por defecto usa el isotipo oficial (`assets/brand/isotipo.png`);
 * con "brand": { "mark": "svg" } en site.json vuelve al dibujo vectorial.
 */
const brandMark = (site = {}) => {
  if ((site.brand || {}).mark === 'svg') {
    return `<span class="brand__mark">${miniMark()}</span>`;
  }
  // 128 px es suficiente para un icono de 42 CSS px en pantallas 2x, y pesa
  // 5 KB en vez de los 94 KB de la versión grande.
  return `<span class="brand__mark brand__mark--img">
    <img src="/assets/brand/isotipo-128.png" width="44" height="44" alt="" decoding="async" fetchpriority="high">
  </span>`;
};

export function layout({
  site,
  title,
  desc,
  body,
  url = '/',
  type = 'website',
  published,
  updated,
  image,
  noindex = false,
  jsonLd = [],
  active = '',
  bodyClass = '',
  headExtra = '',
  keywords = '',
  author = '',
  section = '',
  tags = [],
  wordCount = 0,
  breadcrumbs = [],
  faq = [],
  logo = '/assets/brand/aseiio-logo.png',
}) {
  const fullTitle = title ? `${title} · ${site.shortName || site.name}` : site.name;
  const canonical = `${site.url}${url}`;
  const ogImg = image || site.ogImage || '/assets/og.png';

  const navLinks = site.nav || [];
  const nav = navLinks
    .map((l) => `<a href="${escAttr(l.url)}"${l.url === active ? ' aria-current="page"' : ''}>${esc(l.label)}</a>`)
    .join('');

  /* ── Datos estructurados ─────────────────────────────────────────────────
   * Se agrupan en un único <script> con @graph: menos peticiones, y se
   * añaden los tipos que faltaban (migas de pan, preguntas frecuentes,
   * caja de búsqueda del sitio). */
  const S = 'https://schema.org';
  const abs = (u) => (u.startsWith('http') ? u : `${site.url}${u}`);
  const org = {
    '@type': 'NGO',
    '@id': `${site.url}/#org`,
    name: site.name,
    alternateName: site.shortName,
    url: `${site.url}/`,
    description: site.description,
    email: site.email ? `mailto:${site.email}` : undefined,
    telephone: site.phone || undefined,
    logo: { '@type': 'ImageObject', url: abs(logo) },
    image: abs(site.ogImage || '/assets/og.png'),
    areaServed: { '@type': 'AdministrativeArea', name: site.region },
    knowsAbout: [
      'Enfermedad de Crohn', 'Colitis ulcerosa', 'Colitis indeterminada',
      'Colitis indeterminada', 'Enfermedad inflamatoria intestinal', 'Ostomía',
      'Derechos de las personas con discapacidad',
    ],
  };

  const graph = [...jsonLd];
  const crumb = (breadcrumbs || []).filter((b) => b.url);
  if (crumb.length) {
    graph.push({
      '@type': 'BreadcrumbList',
      '@id': `${canonical}#migas`,
      itemListElement: crumb.map((b, i) => ({
        '@type': 'ListItem',
        position: i + 1,
        name: b.label,
        item: abs(b.url),
      })),
    });
  }
  if (faq && faq.length) {
    graph.push({
      '@type': 'FAQPage',
      '@id': `${canonical}#faq`,
      mainEntity: faq.map((f) => ({
        '@type': 'Question',
        name: f.q,
        acceptedAnswer: { '@type': 'Answer', text: String(f.a || '').replace(/<[^>]+>/g, '') },
      })),
    });
  }
  {
    graph.push({
      '@type': 'WebSite',
      '@id': `${site.url}/#web`,
      url: `${site.url}/`,
      name: site.name,
      inLanguage: 'es-ES',
      publisher: { '@id': `${site.url}/#org` },
      potentialAction: {
        '@type': 'SearchAction',
        target: { '@type': 'EntryPoint', urlTemplate: `${site.url}/blog/?q={search_term_string}` },
        'query-input': 'required name=search_term_string',
      },
    });
  }
  const withRefs = graph.map((n) => {
    if (n['@type'] === 'BlogPosting') {
      return {
        ...n,
        author: { '@type': 'Organization', name: author || site.name, url: `${site.url}/` },
        publisher: { '@id': `${site.url}/#org` },
        mainEntityOfPage: { '@type': 'WebPage', '@id': canonical },
        isPartOf: { '@id': `${site.url}/#web` },
        image: { '@type': 'ImageObject', url: abs(ogImg.startsWith('/') ? ogImg : site.url + ogImg), width: 1200, height: 630 },
        ...(wordCount ? { wordCount } : {}),
      };
    }
    if (n['@type'] === 'AboutPage' || n['@type'] === 'CollectionPage' || n['@type'] === 'WebPage') {
      return { ...n, isPartOf: { '@id': `${site.url}/#web` }, publisher: { '@id': `${site.url}/#org` } };
    }
    return n;
  });

  const ld = withRefs.length
    ? `<script type="application/ld+json">${JSON.stringify({
      '@context': S,
      '@graph': [org, ...withRefs],
    }, null, 0)}</script>`
    : '';

  return `<!doctype html>
<html lang="es" class="no-js">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(fullTitle)}</title>
<meta name="description" content="${escAttr(desc || site.description)}">
<link rel="canonical" href="${escAttr(canonical)}">
${noindex ? '<meta name="robots" content="noindex, follow">' : '<meta name="robots" content="index, follow, max-image-preview:large">'}
<meta name="theme-color" content="#12447F">
<meta property="og:site_name" content="${escAttr(site.name)}">
<meta property="og:type" content="${type}">
<meta property="og:title" content="${escAttr(fullTitle)}">
<meta property="og:description" content="${escAttr(desc || site.description)}">
<meta property="og:url" content="${escAttr(canonical)}">
<meta property="og:image" content="${escAttr(ogImg.startsWith('http') ? ogImg : site.url + ogImg)}">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:image:type" content="image/png">
<meta property="og:image:alt" content="${escAttr(`${site.shortName || site.name}${title ? ` — ${title}` : ''}. Asociación de personas con enfermedad inflamatoria intestinal y ostomizadas de Asturias.`)}">
<meta property="og:locale" content="es_ES">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${escAttr(fullTitle)}">
<meta name="twitter:description" content="${escAttr(desc || site.description)}">
<meta name="twitter:image" content="${escAttr(ogImg.startsWith('http') ? ogImg : site.url + ogImg)}">
<meta name="twitter:image:alt" content="${escAttr(fullTitle)}">
${published ? `<meta property="article:published_time" content="${escAttr(published)}">` : ''}
${updated ? `<meta property="article:modified_time" content="${escAttr(updated)}">` : ''}
${section ? `<meta property="article:section" content="${escAttr(section)}">` : ''}
${author ? `<meta name="author" content="${escAttr(author)}"><meta property="article:author" content="${escAttr(author)}">` : ''}
${keywords ? `<meta name="keywords" content="${escAttr(keywords)}">` : ''}
${tags.map((t) => `<meta property="article:tag" content="${escAttr(t)}">`).join('\n')}${tags.length ? '\n' : ''}
${published ? `<meta property="article:published_time" content="${escAttr(published)}">` : ''}
${updated ? `<meta property="article:modified_time" content="${escAttr(updated)}">` : ''}
<link rel="icon" href="/favicon-32.png" sizes="32x32" type="image/png">
<link rel="icon" href="/favicon-48.png" sizes="48x48" type="image/png">
<link rel="apple-touch-icon" href="/favicon-180.png">
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<link rel="alternate" type="application/rss+xml" title="${escAttr(site.name)}" href="/feed.xml">
<link rel="preload" href="/assets/fonts/sora-var.woff2" as="font" type="font/woff2" crossorigin>
<link rel="preload" href="/assets/fonts/inter-var.woff2" as="font" type="font/woff2" crossorigin>
<link rel="stylesheet" href="/assets/styles.css?v=1">
${ld}
${headExtra}
</head>
<body class="${bodyClass}">
<a class="skip" href="#main" style="position:absolute;left:-999px;top:0;background:#fff;padding:12px 20px;border-radius:0 0 12px 0;z-index:100">Saltar al contenido</a>

<header class="header" id="header">
  <div class="wrap header__in">
    <a class="brand" href="/" aria-label="${escAttr(site.name)} — inicio">
      ${brandMark(site)}
      <span>
        <span class="brand__name">${esc(site.shortName || site.name)}</span>
        <span class="brand__sub">${esc(site.region || 'Asturias')}</span>
      </span>
    </a>
    <nav class="nav" id="nav" aria-label="Principal">${nav}</nav>
    <a class="btn btn--sm header__cta" href="${escAttr(site.cta?.url || '/asociacion/')}">${esc(site.cta?.label || 'Hazte socia/o')}</a>
    <button class="burger" id="burger" type="button" aria-label="Abrir menú" aria-expanded="false" aria-controls="nav">
      <span></span><span></span><span></span>
    </button>
  </div>
</header>

<main id="main">
${body}
</main>

<footer class="footer">
  <div class="wrap">
    <div class="footer__top">
      <div class="footer__brand">
        <div class="brand">
          ${brandMark(site)}
          <span>
            <span class="brand__name">${esc(site.shortName || site.name)}</span>
            <span class="brand__sub">${esc(site.region || 'Asturias')}</span>
          </span>
        </div>
        <p>${inline(site.footerBlurb || site.description)}</p>
        <div class="socials">
          ${(site.social || []).map((s) => `<a href="${escAttr(s.url)}" aria-label="${escAttr(s.label)}" title="${escAttr(s.label)}"${s.url.startsWith('http') ? ' rel="noopener" target="_blank"' : ''}>${socialIcon(s.icon)}</a>`).join('')}
        </div>
      </div>
      <div>
        <h2>La asociación</h2>
        <ul>
          <li><a href="/servicios/">Qué hacemos</a></li>
          <li><a href="/derechos/">Derechos</a></li>
          <li><a href="/asociacion/">Quiénes somos</a></li>
          <li><a href="/asociacion/#contacto">Contacto</a></li>
        </ul>
      </div>
      <div>
        <h2>Recursos</h2>
        <ul>
          <li><a href="/recursos/">Guías y descargas</a></li>
          <li><a href="/blog/">Blog y noticias</a></li>
          <li><a href="/temas/">Artículos por tema</a></li>
          <li><a href="/galeria/">Galería</a></li>
          <li><a href="/feed.xml">RSS</a></li>
        </ul>
      </div>
      <div>
        <h2>Contacto</h2>
        <ul>
          ${site.email ? `<li><a href="mailto:${escAttr(site.email)}">${esc(site.email)}</a></li>` : ''}
          ${site.phone ? `<li><a href="tel:${escAttr(site.phone.replace(/\s/g, ''))}">${esc(site.phone)}</a></li>` : ''}
          ${site.address ? `<li>${esc(site.address)}</li>` : ''}
          ${site.hours ? `<li>${esc(site.hours)}</li>` : ''}
        </ul>
      </div>
    </div>
    <div class="footer__bot">
      <span>© ${new Date().getFullYear()} ${esc(site.name)} · ${esc(site.legal || 'Entidad sin ánimo de lucro')}</span>
      <span>${(site.legalLinks || []).map((l) => `<a href="${escAttr(l.url)}">${esc(l.label)}</a>`).join(' · ')}</span>
    </div>
  </div>
</footer>

<script src="/assets/app.js?v=1" defer></script>
</body>
</html>`;
}

/** Avatar circular con iniciales. */
export const avatar = (name, size = 62) =>
  `<span class="author-box__ava" style="width:${size}px;height:${size}px">${esc(initials(name))}</span>`;

export { esc, escAttr, inline, icon, initials, digestiveArt, peopleArt, bagArt, miniMark };
