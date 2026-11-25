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

## For machines

An AI assistant can index the help from the site itself, with no export of its own. The build
writes, from the same published articles as the pages:

- `sitemap.xml`: every article page, with the time it was published.
- `index.md` beside each article page: the article as plain Markdown, with its title, product,
  language, address and publish time on top.
- `llms.txt`: a short map of the products and their articles, linking to the Markdown pages.

An article that is unpublished is gone from all three at the next build.

## Old addresses

[redirects.json](redirects.json) lists addresses from the old help that should lead to a page
here: the old path, and the new one. The build writes a small page at each old address that
sends the reader on at once. GitHub Pages cannot answer with a real redirect; where the site is
served by something that can (Azure), the same list can be used for real redirects.

## Look

The pages follow the Spiris help: Inter, a warm grey header bar, purple links, bold titles, and
the product's menu beside an article ([src/style.css](src/style.css)). The Spiris logo is not
here: this is a public test site on a personal account.

## What is and is not public

- **Everything on the site is public.** Anyone with the address can read it. Each page asks
  search engines not to list it, and carries a banner saying it is a test.
- **Drafts never reach the site.** The build uses Storyblok's public token, which can read
  published articles only. The preview of drafts reads a draft in the writer's browser
  only, with a token that is not on the site (see below).
- **No secrets are in this repository.** The token is a secret in the repository's settings.

## Preview of drafts in Storyblok

Storyblok's Visual Editor shows the article beside the form while it is written. The page it
shows is `preview/` on this site ([src/preview.js](src/preview.js)): it reads the one draft that
is open, in the writer's own browser, and shows it as the published page will look. It follows
the writer as they type, and a click on the article opens its form.

- **The page holds no token and no article.** Opened by itself it shows a line of text.
- **The token is part of the address saved in Storyblok**, after a `#`. What comes after a `#`
  stays in the browser: it is not sent to this site's server, and it is in no file here. Only
  people who can open the space see it, and they can read the drafts anyway.
- The text is turned into a page by the same code as the build
  ([src/render.js](src/render.js)), so the preview and the published page look alike.

To set it up, in Storyblok:

1. Settings → Access Tokens → create a token with access level **Preview**.
2. Settings → Visual Editor → Location (default environment):
   `https://peka01.github.io/superdupercontent/preview/#t=<the preview token>&p=`
   The address must end with `&p=`: Storyblok adds the article's path after it.

To take the preview away, delete that token in Storyblok.

## Set up

In Storyblok: Settings → Access Tokens → create a token with access level **Public**.

In this repository: Settings → Secrets and variables → Actions → New repository secret, named
`STORYBLOK_PUBLIC_TOKEN`, with that token as its value.

Without the secret the site still builds, with no articles.

## Publish again

The site publishes by itself. Every ten minutes the workflow asks Storyblok what is published
([changed.mjs](changed.mjs)) and rebuilds the site only when that differs from what the live
site was built from (`built-from.json` on the site). An article shows on the site some minutes
after it is published in Storyblok, usually within a quarter of an hour: GitHub starts
scheduled runs when it has room, not on the minute. Unpublishing an article takes it off the
site the same way.

To not wait: Actions → Publish test site → Run workflow. The site is also rebuilt on every push
to `main`.

GitHub stops scheduled runs in a repository that has had no change for 60 days, and sends a
mail about it. Enabling the workflow again under Actions starts them anew.

For a rebuild the moment an article is published, something must receive Storyblok's webhook
and ask GitHub for a `content-published` build. The workflow is ready for that; nothing sends
it yet.

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
