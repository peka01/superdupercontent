// Reads the PUBLISHED help articles from Storyblok, for the build (build.mjs) and for the check
// that tells whether anything was published since the site was built (changed.mjs).
//
// Only published articles are read, with Storyblok's public token. Drafts never reach the site.
// Needs nothing but Node itself, so the check can run without installing anything.
import { createHash } from 'node:crypto'

const TOKEN = process.env.STORYBLOK_PUBLIC_TOKEN || ''
const API = (process.env.STORYBLOK_CDN_BASE || 'https://api.storyblok.com/v2/cdn').replace(/\/+$/, '')
export const COMPONENT = process.env.STORYBLOK_COMPONENT || 'help_article'
export const hasToken = () => !!TOKEN

/**
 * The site's address, ending in a slash: SITE_URL, else where GitHub Pages serves this
 * repository. The build needs it for the list of pages; the check needs it to read the live site.
 */
export function siteUrl() {
  if (process.env.SITE_URL) return `${process.env.SITE_URL.replace(/\/+$/, '')}/`
  const [owner, name] = String(process.env.GITHUB_REPOSITORY || 'peka01/superdupercontent').split('/')
  return `https://${owner}.github.io/${name}/`
}

/** The file on the built site that says what it was built from. */
export const BUILT_FROM = 'built-from.json'

/** One call to Storyblok's delivery API. The token is never part of an error message. */
async function cdn(path, params) {
  const query = new URLSearchParams({ ...params, token: TOKEN, version: 'published' })
  const response = await fetch(`${API}/${path}?${query}`)
  if (!response.ok) {
    throw new Error(`Storyblok answered ${response.status} on ${path}. Check STORYBLOK_PUBLIC_TOKEN and that it is a public token of the right space.`)
  }
  return response.json()
}

/** → { stories, folders }: the published articles, and the folders' names by their slug. */
export async function readStoryblok() {
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

/**
 * A short mark of what is published: which articles, where, and when each was published last.
 * It changes when an article is published, published again, moved or unpublished, or a product
 * folder is renamed, and stays the same otherwise.
 */
export function fingerprint({ stories = [], folders = {} }) {
  const articles = stories.map((s) => [String(s.id ?? s.uuid ?? s.full_slug), s.full_slug || '', s.published_at || '']).sort()
  const names = Object.entries(folders).sort()
  return createHash('sha256').update(JSON.stringify([articles, names])).digest('hex').slice(0, 16)
}
