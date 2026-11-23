# CLAUDE.md

A test site that shows the published help articles from a Storyblok space, and a preview page
for drafts that Storyblok's Visual Editor opens. The README says how both work.

## Keep the CMS document up to date

After every change here that alters how the test site or the preview is set up, or what has been
tested, update the document "CMS setups: what is set up and what is tested" in the same piece of
work: https://claude.ai/artifact/XWpghZ8VL56gtmzaZwepuH (the Storyblok section). Write a result
you did not see yourself as reported.

## Working here

- A push to `main` builds and publishes the site on GitHub Pages. Run `npm run build:sample`
  first; `npm run preview` serves `dist/` on http://localhost:4173.
- The repository and the site are public. No token goes into a file here, and no draft into the
  build: the build reads published articles only.
- `src/render.js` is used both by the build (Node) and by the preview page (the browser). Keep it
  free of anything only one of them has.
- The preview page can be tried without Storyblok: open `preview/` locally and call `show(story)`
  from `assets/preview.js` in the browser's console.
