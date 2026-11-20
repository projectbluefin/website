import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
/**
 * Generates the Wolves guardian character cards and share pages from
 * characters.json into public/wolves/characters/:
 *   <slug>.png        — 1200x630 Open Graph card (plate + scene still)
 *   <slug>/index.html — share page whose OG tags show the card and whose body
 *                       forwards to the official trailer at the scene time
 *   characters.json   — public manifest the lobby character gallery fetches
 *
 * Scene stills must exist in scenes/ first (run capture-scenes.mjs).
 * Usage: node scripts/guardian-cards/generate.mjs [slug ...]
 */
import { chromium } from 'playwright'

const here = path.dirname(fileURLToPath(import.meta.url))
const repo = path.resolve(here, '..', '..')
const outDir = path.join(repo, 'public', 'wolves', 'characters')
const { characters } = JSON.parse(fs.readFileSync(path.join(here, 'characters.json'), 'utf8'))
const only = process.argv.slice(2)
const selected = only.length
  ? characters.filter(character => only.includes(character.slug))
  : characters

fs.mkdirSync(outDir, { recursive: true })

const browser = await chromium.launch()
const page = await browser.newPage({
  viewport: { width: 1200, height: 630 },
  deviceScaleFactor: 1
})

for (const character of selected) {
  const scene = path.join(here, 'scenes', `${character.slug}.png`)
  if (!fs.existsSync(scene)) {
    console.error(`missing scenes/${character.slug}.png — run capture-scenes.mjs first`)
    process.exitCode = 1
    continue
  }
  const params = new URLSearchParams({
    label: character.label,
    class: character.class,
    name: character.name,
    title: character.title,
    still: `file://${scene}`,
  })
  if (character.trustee) {
    params.set('trustee', '1')
  }
  if (character.leader) {
    params.set('leader', '1')
  }
  if (character.dino) {
    params.set('dinoArt', `file://${path.join(repo, 'public', character.dino.artwork)}`)
    params.set('dinoId', character.dino.id)
    if (character.dino.name) {
      params.set('dinoName', character.dino.name)
    }
    params.set('dinoSpecies', character.dino.species)
  }
  await page.goto(`file://${here}/card.html?${params}`)
  await page.waitForLoadState('networkidle')
  await page.screenshot({
    path: path.join(outDir, `${character.slug}.png`)
  })

  const target = `https://youtu.be/${character.videoId}?t=${character.linkTime}`
  const heading = `${character.class} — ${character.name}`
  const description = `${character.title} — watch the Guardian reveal in the official ${character.videoTitle}.`
  const html = `<!DOCTYPE html>
<html lang="en">

<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${heading} | Seven Days to the Wolves</title>
  <meta name="description" content="${description}" />
  <meta name="robots" content="noindex" />

  <!-- Open Graph: social share card for this Guardian; the page itself forwards
       to the official Bungie trailer on YouTube at this Guardian's scene. -->
  <meta property="og:type" content="website" />
  <meta property="og:url" content="https://projectbluefin.io/wolves/characters/${character.slug}/" />
  <meta property="og:title" content="${heading} | Seven Days to the Wolves" />
  <meta property="og:description" content="${description}" />
  <meta property="og:image" content="https://projectbluefin.io/wolves/characters/${character.slug}.png" />
  <meta property="og:image:width" content="1200" />
  <meta property="og:image:height" content="630" />

  <!-- Twitter -->
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="${heading} | Seven Days to the Wolves" />
  <meta name="twitter:description" content="${description}" />
  <meta name="twitter:image" content="https://projectbluefin.io/wolves/characters/${character.slug}.png" />

  <meta http-equiv="refresh" content="0; url=${target}" />
  <link rel="icon" href="/favicons/favicon.ico" />
</head>

<body>
  <p>Redirecting to the official trailer — <a href="${target}">watch ${character.name}'s scene on YouTube</a>.</p>
  <p><small>Destiny 2 © Bungie, Inc. Fan-made, non-commercial community page — not affiliated with or endorsed by Bungie.</small></p>
  <script>location.replace(${JSON.stringify(target)})</script>
</body>

</html>
`
  fs.mkdirSync(path.join(outDir, character.slug), { recursive: true })
  fs.writeFileSync(path.join(outDir, character.slug, 'index.html'), html)
  console.info(`generated ${character.slug}.png and ${character.slug}/index.html`)
}

await browser.close()

// Public manifest for the lobby character gallery: card image, display copy,
// and the official trailer deep link per guardian.
const manifest = {
  characters: characters.map(character => ({
    slug: character.slug,
    shortName: character.slug.charAt(0).toUpperCase() + character.slug.slice(1),
    label: character.label,
    class: character.class,
    name: character.name,
    title: character.title,
    card: `wolves/characters/${character.slug}.png`,
    watchUrl: `https://youtu.be/${character.videoId}?t=${character.linkTime}`,
    videoTitle: character.videoTitle,
  })),
}
fs.writeFileSync(path.join(outDir, 'characters.json'), `${JSON.stringify(manifest, null, 2)}\n`)
console.info('generated characters.json manifest')
