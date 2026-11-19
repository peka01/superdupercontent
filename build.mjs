// Builds the test site into dist/ from the PUBLISHED help articles in Storyblok.
//
//   node build.mjs            reads Storyblok (needs STORYBLOK_PUBLIC_TOKEN)
//   node build.mjs --sample   reads sample/stories.json instead: no network, no token
//
// Only published articles are read, with Storyblok's public token. Drafts never reach the site.
import { mkdirSync, writeFileSync, readFileSync, rmSync, cpSync } from 'node:fs'
import { marked } from 'marked'

const SAMPLE = process.argv.includes('--sample')
const TOKEN = process.env.STORYBLOK_PUBLIC_TOKEN || ''
const API = (process.env.STORYBLOK_CDN_BASE || 'https://api.storyblok.com/v2/cdn').replace(/\/+$/, '')
const COMPONENT = process.env.STORYBLOK_COMPONENT || 'help_article'
const OUT = 'dist'

const FORMAT_LABELS = {
  instruction: 'Instruktion',
  faq: 'Vanliga frågor',
  getting_started: 'Kom igång',
  concept: 'Förklaring',
  news: 'Nyhet',
}

// --- reading ------------------------------------------------------------------------

/** One call to Storyblok's delivery API. The token is never part of an error message. */
async function cdn(path, params) {
  const query = new URLSearchParams({ ...params, token: TOKEN, version: 'published' })
  const response = await fetch(`${API}/${path}?${query}`)
  if (!response.ok) {
    throw new Error(`Storyblok answered ${response.status} on ${path}. Check STORYBLOK_PUBLIC_TOKEN and that it is a public token of the right space.`)
  }
  return response.json()
}

async function readStoryblok() {
  const stories = []
  for (let page = 1; page <= 50; page++) {
    const data = await cdn('stories', { content_type: COMPONENT, per_page: '100', page: String(page) })
    stories.push(...(data.stories || []))
    if ((data.stories || []).length < 100) break
  }
  // Folder names, for the product headings. Without them the folder's slug is shown.
  const folders = {}
  try {
    const data = await cdn('links', {})
    for (const link of Object.values(data.links || {})) {
      if (link.is_folder) folders[link.slug] = link.name
    }
  } catch {
    // the site still builds; products are named by their slug
  }
  return { stories, folders }
}

function readSample() {
  return JSON.parse(readFileSync('sample/stories.json', 'utf8'))
}

// --- rendering ----------------------------------------------------------------------

const esc = (s) =>
  String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')

function renderBody(markdown) {
  let html = marked.parse(String(markdown || ''), { gfm: true })
  // "{target=_blank}" after a link is how the templates mark an external link.
  html = html.replace(/<a href="([^"]+)">((?:(?!<\/a>)[\s\S])*)<\/a>\{target=_blank\}/g, '<a href="$1" target="_blank" rel="noopener">$2</a>')
  // Notes a writer was meant to resolve before publishing: make them impossible to miss.
  html = html.replace(/\[(KONTROLLERA|LÄNK|CHECK UI TEXT): [^\]<]+\]/g, (note) => `<mark class="note">${note}</mark>`)
  return html
}

function page({ root, title, crumbs = [], body, builtAt, count }) {
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
<link rel="stylesheet" href="${root}assets/style.css">
<link rel="stylesheet" href="${root}pagefind/pagefind-ui.css">
</head>
<body>
<p class="banner">Testsida. Innehållet är under utvärdering och är inte den riktiga hjälpen.</p>
<header class="top">
  <a class="home" href="${root}">Hjälp <span>testsida</span></a>
  <div id="search" class="search"></div>
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
} else if (!TOKEN) {
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
      published: (s.published_at || s.first_published_at || '').slice(0, 10),
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
writeFileSync(`${OUT}/.nojekyll`, '')

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
  for (const a of own) {
    write(
      `${OUT}/${p.slug}/${a.slug}/index.html`,
      page({
        ...shared,
        root: '../../',
        title: a.title,
        crumbs: [
          { href: '../', label: p.name },
          { href: './', label: a.title },
        ],
        body: `<article data-pagefind-body>
<h1>${esc(a.title)}</h1>
<p class="meta" data-pagefind-ignore>${[FORMAT_LABELS[a.format], p.name, a.published ? `publicerad ${a.published}` : ''].filter(Boolean).map(esc).join(' · ')}</p>
${a.html}
</article>`,
      }),
    )
  }
}

console.log(`Built ${articles.length} article(s) in ${products.length} product(s) into ${OUT}/${notice ? ` (${notice})` : ''}`)
