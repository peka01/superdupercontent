// How an article's text becomes a page. Shared by the build (build.mjs, in Node) and the preview
// of drafts (preview.js, in the browser), so a draft looks in the preview as it will when published.

export const FORMAT_LABELS = {
  instruction: 'Instruktion',
  faq: 'Vanliga frågor',
  getting_started: 'Kom igång',
  concept: 'Förklaring',
  news: 'Nyhet',
}

export const esc = (s) =>
  String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')

/** Markdown → HTML. `parse` is marked's own function: each side brings its copy of marked. */
export function renderBody(markdown, parse) {
  let html = parse(String(markdown || ''), { gfm: true })
  // "{target=_blank}" after a link is how the templates mark an external link.
  html = html.replace(/<a href="([^"]+)">((?:(?!<\/a>)[\s\S])*)<\/a>\{target=_blank\}/g, '<a href="$1" target="_blank" rel="noopener">$2</a>')
  // Notes a writer was meant to resolve before publishing: make them impossible to miss.
  html = html.replace(/\[(KONTROLLERA|LÄNK|CHECK UI TEXT): [^\]<]+\]/g, (note) => `<mark class="note">${note}</mark>`)
  return html
}
