// Builds the test site into dist/ from the PUBLISHED help articles in Storyblok.
//
//   node build.mjs            reads Storyblok (needs STORYBLOK_PUBLIC_TOKEN)
//   node build.mjs --sample   reads sample/stories.json instead: no network, no token
//
// Only published articles are read, with Storyblok's public token. Drafts never reach the site.
import { mkdirSync, writeFileSync, readFileSync, rmSync, cpSync } from 'node:fs'
import { marked } from 'marked'
import { esc, FORMAT_LABELS, renderBody as render } from './src/render.js'
import { BUILT_FROM, COMPONENT, fingerprint, hasToken, readStoryblok, siteUrl } from './storyblok.mjs'

const SAMPLE = process.argv.includes('--sample')
const OUT = 'dist'

// --- reading ------------------------------------------------------------------------
// The articles are read by storyblok.mjs.

function readSample() {
  return JSON.parse(readFileSync('sample/stories.json', 'utf8'))
}

// --- rendering ----------------------------------------------------------------------

// How the text becomes HTML is in src/render.js, shared with the preview of drafts.
const renderBody = (markdown) => render(markdown, marked.parse)

// The Spiris help is set in Inter. The font comes from Google Fonts; the page falls back to the
// reader's own font when it cannot be fetched.
const FONT = `<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap">`

function page({ root, title, crumbs = [], body, builtAt, count, head = '', wide = false }) {
  const trail = [{ href: root, label: 'Start' }, ...crumbs]
    .map((c, i, all) => (i === all.length - 1 ? `<span aria-current="page">${esc(c.label)}</span>` : `<a href="${c.href}">${esc(c.label)}</a>`))
    .join('<span class="sep" aria-hidden="true">/</span>')
  return `<!doctype html>
<html lang="sv">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<title>${esc(title)} · Hjälp, testsida</title>
${FONT}
<link rel="stylesheet" href="${root}assets/style.css">
<link rel="stylesheet" href="${root}pagefind/pagefind-ui.css">
${head}</head>
<body${wide ? ' class="wide"' : ''}>
<p class="banner">Testsida. Innehållet är under utvärdering och är inte den riktiga hjälpen.</p>
<header class="top">
  <div class="top-in">
    <a class="home" href="${root}">Hjälp <span>testsida</span></a>
    <div id="search" class="search"></div>
  </div>
</header>
<nav class="crumbs" aria-label="Brödsmulor">${trail}</nav>
<main>
${body}
</main>
<footer>Byggd ${esc(builtAt)} från Storyblok · ${count} ${count === 1 ? 'publicerad artikel' : 'publicerade artiklar'}</footer>
<script src="${root}pagefind/pagefind-ui.js"></script>
<script>
  // The site may live under a path (GitHub Pages: /repository-name/), so results are linked from
  // the site's own root, worked out from this page's place in it.
  if (window.PagefindUI) new PagefindUI({ element: '#search', showSubResults: true, showImages: false, resetStyles: false, baseUrl: new URL('${root}', location.href).pathname })
</script>
</body>
</html>
`
}

function write(path, html) {
  mkdirSync(path.slice(0, path.lastIndexOf('/')), { recursive: true })
  writeFileSync(path, html, 'utf8')
}

// --- build --------------------------------------------------------------------------

let source = { stories: [], folders: {} }
let notice = ''
if (SAMPLE) {
  source = readSample()
} else if (!hasToken()) {
  notice = 'STORYBLOK_PUBLIC_TOKEN is not set, so the site is built without articles.'
  console.log(`::notice::${notice}`)
} else {
  source = await readStoryblok()
}

const articles = source.stories
  .filter((s) => s.content && (!s.content.component || s.content.component === COMPONENT))
  .map((s) => {
    const productSlug = String(s.full_slug || '').split('/')[0] || s.content.product || 'ovrigt'
    return {
      productSlug,
      productName: source.folders[productSlug] || productSlug,
      slug: s.slug,
      title: s.content.title || s.name,
      format: s.content.format || '',
      html: renderBody(s.content.body),
      markdown: String(s.content.body || ''),
      publishedAt: s.published_at || s.first_published_at || '',
      published:(s.published_at || s.first_published_at || '').slice(0, 10),
    }
  })
  .sort((a, b) => a.title.localeCompare(b.title, 'sv'))

const products = [...new Map(articles.map((a) => [a.productSlug, { slug: a.productSlug, name: a.productName }])).values()].sort((a, b) =>
  a.name.localeCompare(b.name, 'sv'),
)

const builtAt = new Date().toLocaleString('sv-SE', { timeZone: 'Europe/Stockholm', dateStyle: 'short', timeStyle: 'short' })
const shared = { builtAt, count: articles.length }

rmSync(OUT, { recursive: true, force: true })
mkdirSync(`${OUT}/assets`, { recursive: true })
cpSync('src/style.css', `${OUT}/assets/style.css`)
// The preview of drafts for Storyblok's Visual Editor: a page that reads one draft in the
// writer's browser. It carries no token and no article; see src/preview.js.
for (const [from, to] of [
  ['src/preview.js', 'preview.js'],
  ['src/render.js', 'render.js'],
  ['node_modules/marked/lib/marked.esm.js', 'marked.esm.js'],
]) {
  cpSync(from, `${OUT}/assets/${to}`)
}
write(
  `${OUT}/preview/index.html`,
  `<!doctype html>
<html lang="sv">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<meta name="referrer" content="no-referrer">
<title>Förhandsvisning · Hjälp, testsida</title>
${FONT}
<link rel="stylesheet" href="../assets/style.css">
</head>
<body>
<p class="banner">Förhandsvisning av ett utkast. Sidan är inte publicerad.</p>
<header class="top">
  <div class="top-in">
    <span class="home">Hjälp <span>testsida</span></span>
  </div>
</header>
<main></main>
<script src="https://app.storyblok.com/f/storyblok-v2-latest.js"></script>
<script type="module" src="../assets/preview.js"></script>
</body>
</html>
`,
)
writeFileSync(`${OUT}/.nojekyll`, '')
// What the site was built from: the scheduled check (changed.mjs) compares this with what is
// published now, and rebuilds only when they differ.
writeFileSync(`${OUT}/${BUILT_FROM}`, `${JSON.stringify({ fingerprint: fingerprint(source), articles: articles.length, builtAt: new Date().toISOString() })}\n`)

// Start page
write(
  `${OUT}/index.html`,
  page({
    ...shared,
    root: './',
    title: 'Start',
    body:
      articles.length === 0
        ? `<h1>Hjälp</h1>
<p class="empty">Det finns inga publicerade artiklar ännu.</p>
<p>Publicera en artikel i Storyblok och kör om bygget, så visas den här.</p>`
        : `<h1>Hjälp</h1>
<ul class="cards">
${products
  .map((p) => {
    const n = articles.filter((a) => a.productSlug === p.slug).length
    return `  <li><a href="${esc(p.slug)}/"><strong>${esc(p.name)}</strong><span>${n} ${n === 1 ? 'artikel' : 'artiklar'}</span></a></li>`
  })
  .join('\n')}
</ul>`,
  }),
)

// One page per product, one per article
for (const p of products) {
  const own = articles.filter((a) => a.productSlug === p.slug)
  write(
    `${OUT}/${p.slug}/index.html`,
    page({
      ...shared,
      root: '../',
      title: p.name,
      crumbs: [{ href: './', label: p.name }],
      body: `<h1>${esc(p.name)}</h1>
<ul class="list">
${own
  .map(
    (a) =>
      `  <li><a href="${esc(a.slug)}/">${esc(a.title)}</a>${FORMAT_LABELS[a.format] ? `<span class="tag">${FORMAT_LABELS[a.format]}</span>` : ''}</li>`,
  )
  .join('\n')}
</ul>`,
    }),
  )
  // The menu beside an article: the product's articles, with the open one marked.
  const menu = (open) => `<nav class="menu" aria-label="${esc(p.name)}">
<p><a href="../">${esc(p.name)}</a></p>
<ul>
${own.map((a) => `  <li><a href="../${esc(a.slug)}/"${a === open ? ' aria-current="page"' : ''}>${esc(a.title)}</a></li>`).join('\n')}
</ul>
</nav>`
  for (const a of own) {
    write(
      `${OUT}/${p.slug}/${a.slug}/index.html`,
      page({
        ...shared,
        root: '../../',
        title: a.title,
        wide: true,
        // The same article as plain Markdown, for AI tools: see "For machines" below.
        head: '<link rel="alternate" type="text/markdown" href="index.md">\n',
        crumbs: [
          { href: '../', label: p.name },
          { href: './', label: a.title },
        ],
        body: `<div class="with-menu">
${menu(a)}
<article data-pagefind-body>
<h1>${esc(a.title)}</h1>
<p class="meta" data-pagefind-ignore>${[FORMAT_LABELS[a.format], p.name, a.published ? `publicerad ${a.published}` : ''].filter(Boolean).map(esc).join(' · ')}</p>
${a.html}
</article>
</div>`,
      }),
    )
  }
}

// --- for machines -------------------------------------------------------------------
// What an AI assistant needs to index the help without an export of its own: a list of every
// published page with the time it was published (sitemap.xml), each article as plain Markdown
// beside its page (index.md), and a short map of it all (llms.txt). Only published articles are
// here, as on the pages, and an article that is unpublished is gone from all three at the next
// build.
const SITE = siteUrl()
const LANG = 'sv'
const pageUrl = (a) => `${SITE}${a.productSlug}/${a.slug}/`
const quoted = (s) => JSON.stringify(String(s ?? ''))

for (const a of articles) {
  const text = a.markdown.split('{target=_blank}').join('').trim()
  writeFileSync(
    `${OUT}/${a.productSlug}/${a.slug}/index.md`,
    `---
title: ${quoted(a.title)}
product: ${quoted(a.productName)}
product_id: ${quoted(a.productSlug)}
language: ${quoted(LANG)}
url: ${quoted(pageUrl(a))}
published: ${quoted(a.publishedAt)}
---

# ${a.title}

${text}
`,
    'utf8',
  )
}

writeFileSync(
  `${OUT}/sitemap.xml`,
  `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${articles
  .map((a) => `  <url><loc>${esc(pageUrl(a))}</loc>${a.publishedAt ? `<lastmod>${esc(a.publishedAt)}</lastmod>` : ''}</url>`)
  .join('\n')}
</urlset>
`,
  'utf8',
)

writeFileSync(
  `${OUT}/llms.txt`,
  `# Hjälp, testsida

> Testsida med publicerade hjälpartiklar på svenska. Varje artikel finns som Markdown på sidans adress plus index.md, och alla sidor listas i ${SITE}sitemap.xml.

${products
  .map(
    (p) => `## ${p.name}

${articles
  .filter((a) => a.productSlug === p.slug)
  .map((a) => `- [${a.title}](${pageUrl(a)}index.md)`)
  .join('\n')}`,
  )
  .join('\n\n')}
`,
  'utf8',
)

console.log(`Built ${articles.length} article(s) in ${products.length} product(s) into ${OUT}/${notice ? ` (${notice})` : ''}`)
