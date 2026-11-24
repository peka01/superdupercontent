// Tells whether anything was published in Storyblok since the site was built.
//
//   node changed.mjs
//
// Compares what is published now with what the live site says it was built from
// (built-from.json, written by build.mjs). The workflow runs this on a schedule and builds
// only when the answer is yes, so the site follows Storyblok without being rebuilt for nothing.
//
// When the live site cannot be read the answer is yes: a rebuild too many does no harm. When
// Storyblok cannot be read the answer is no, with a warning: a build would fail on the same
// read, and the next check tries again.
import { appendFileSync } from 'node:fs'
import { BUILT_FROM, fingerprint, hasToken, readStoryblok, siteUrl } from './storyblok.mjs'

async function liveFingerprint() {
  const site = siteUrl()
  if (!site) return null
  try {
    // The time in the address keeps a stored copy of the file from being answered with.
    const response = await fetch(`${site}${BUILT_FROM}?t=${Date.now()}`, { signal: AbortSignal.timeout(15000) })
    if (!response.ok) return null
    return (await response.json()).fingerprint || null
  } catch {
    return null
  }
}

let changed = true
let why = ''
try {
  // Without the token the site is built with no articles, and that is what it is compared with.
  const [now, live] = await Promise.all([hasToken() ? readStoryblok().then(fingerprint) : fingerprint({}), liveFingerprint()])
  if (!live) why = 'The live site does not say what it was built from.'
  else if (now === live) {
    changed = false
    why = 'Nothing was published since the site was built.'
  } else why = 'Something was published, moved or unpublished since the site was built.'
} catch (error) {
  changed = false
  why = `Storyblok could not be read, so the site stays as it is until the next check. ${error.message}`
  console.log(`::warning::${why}`)
}

console.log(`${changed ? 'Build' : 'No build'}: ${why}`)
if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, `changed=${changed}\n`)
