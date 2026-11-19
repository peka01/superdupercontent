# Test site for help articles

A small website that shows the **published** help articles from a Storyblok space, so finished
pages can be read and searched as a reader would. It is a test site, not the real help.

Published at https://peka01.github.io/superdupercontent/

## How it works

1. A GitHub Actions workflow runs [build.mjs](build.mjs).
2. The build reads the published articles from Storyblok and writes one page per article into
   `dist/`, with a page per product and a start page.
3. [Pagefind](https://pagefind.app/) adds search over the pages.
4. The workflow puts `dist/` on GitHub Pages.

This repository holds the site's code only. The articles live in Storyblok.

## What is and is not public

- **Everything on the site is public.** Anyone with the address can read it. Each page asks
  search engines not to list it, and carries a banner saying it is a test.
- **Drafts never reach the site.** The build uses Storyblok's public token, which can read
  published articles only.
- **No secrets are in this repository.** The token is a secret in the repository's settings.

## Set up

In Storyblok: Settings → Access Tokens → create a token with access level **Public**.

In this repository: Settings → Secrets and variables → Actions → New repository secret, named
`STORYBLOK_PUBLIC_TOKEN`, with that token as its value.

Without the secret the site still builds, with no articles.

## Publish again

The site is rebuilt on every push to `main`. After publishing an article in Storyblok, start a
rebuild by hand: Actions → Publish test site → Run workflow. Nothing rebuilds it on its own yet.

## Run it on your own machine

Needs Node 22 or later.

```
npm install
npm run build:sample
npm run preview
```

`build:sample` builds from the made-up articles in [sample/stories.json](sample/stories.json):
no network and no token. `preview` serves the result on http://localhost:4173.

To build from Storyblok instead, set `STORYBLOK_PUBLIC_TOKEN` in your shell and run
`npm run build`.

## What an article needs

The build reads stories of the content type `help_article` with these fields: `title`, `body`
(Markdown), `format`, `product`. The folder a story is in becomes its product.

Two things from the article templates are handled here:

- `{target=_blank}` after a link opens it in a new tab.
- A note left for the writer, such as `[KONTROLLERA: …]`, is highlighted so it is not missed.

## Not done yet

- Old help addresses do not lead to these pages. GitHub Pages has no redirect rules.
- Storyblok's on-page editing does not work here: it needs a site that can show drafts.
- English pages. Only one language per article is built.
