// The preview of a draft inside Storyblok's Visual Editor.
//
// Storyblok opens this page in a frame beside the form, with the article's id in the address.
// The page reads the draft from Storyblok, shows it as the published page will look, and follows
// the writer as they type.
//
// Reading a draft needs Storyblok's preview token. This page holds none: the token is part of
// the address saved under Settings → Visual Editor in Storyblok, after a "#", so it is never sent
// to this site's server and is in no file here. Without it, the page shows no article.
import { marked } from './marked.esm.js'
import { FORMAT_LABELS, renderBody } from './render.js'

const API = 'https://api.storyblok.com/v2/cdn'
const main = document.querySelector('main')

// Storyblok adds the article's path and its own values to the saved address. Where exactly they
// land (before or after the "#") is Storyblok's business, so the whole address is searched.
const address = location.href
const param = (name) => {
  const found = address.match(new RegExp(`[#?&]${name}=([^&#?]*)`))
  return found ? decodeURIComponent(found[1]) : ''
}
const token = param('t')
const storyId = param('_storyblok')

let story = null

const message = (text) => {
  main.innerHTML = '<p class="empty"></p>'
  main.firstChild.textContent = text
}

/** What Storyblok needs on an element to open the right form when the writer clicks it. */
function editable(content) {
  const found = /^<!--#storyblok#(.*)-->$/.exec(content?._editable || '')
  if (!found) return null
  try {
    const blok = JSON.parse(found[1])
    return { 'data-blok-c': JSON.stringify(blok), 'data-blok-uid': `${blok.id}-${blok.uid}` }
  } catch {
    return null
  }
}

/** Shows an article. Exported so the page can be tried without Storyblok. */
export function show(next) {
  // While the writer types, Storyblok may send the text alone: the rest is kept from before.
  story = { ...story, ...next, content: { ...story?.content, ...next?.content } }
  const c = story.content
  const marks = editable(c)

  const article = document.createElement('article')
  const h1 = document.createElement('h1')
  h1.textContent = c.title || story.name || ''
  const meta = document.createElement('p')
  meta.className = 'meta'
  meta.textContent = [FORMAT_LABELS[c.format], story.published_at ? 'utkast med ändringar' : 'utkast'].filter(Boolean).join(' · ')
  const body = document.createElement('div')
  body.innerHTML = renderBody(c.body, marked.parse)

  if (marks) {
    for (const el of [article, h1]) for (const [name, value] of Object.entries(marks)) el.setAttribute(name, value)
    article.classList.add('storyblok__outline')
    // The title can be typed straight into the preview.
    h1.setAttribute('data-blok-f', 'title')
  }
  article.append(h1, meta, ...body.childNodes)
  main.replaceChildren(article)
  document.title = `${h1.textContent} · Förhandsvisning`
}

async function load() {
  // "cv" asks for the newest version, past Storyblok's cache.
  const response = await fetch(`${API}/stories/${encodeURIComponent(storyId)}?version=draft&token=${encodeURIComponent(token)}&cv=${Date.now()}`)
  if (response.status === 401) return message('Åtkomstnyckeln i förhandsvisningens adress gäller inte. Byt den under Settings → Visual Editor i Storyblok.')
  if (response.status === 404) return message('Artikeln hittades inte.')
  if (!response.ok) return message(`Storyblok svarade ${response.status}. Försök igen om en stund.`)
  story = null
  show((await response.json()).story)
}

function follow() {
  if (!window.StoryblokBridge) return
  const bridge = new window.StoryblokBridge({ preventClicks: true })
  // Each change in the form, as it is typed.
  bridge.on('input', (event) => event.story && show(event.story))
  // Saved or published: read it again, as it now is in Storyblok.
  bridge.on(['change', 'published'], () => load().catch(() => {}))
}

if (!storyId) {
  message('Här visas ett utkast när en artikel öppnas i Storyblok.')
} else if (!token) {
  message('Förhandsvisningen saknar åtkomstnyckel. Lägg till den i adressen under Settings → Visual Editor i Storyblok.')
} else {
  load()
    .catch(() => message('Storyblok gick inte att nå. Försök igen om en stund.'))
    .finally(follow)
}
