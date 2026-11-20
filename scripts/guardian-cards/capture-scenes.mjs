import fs from 'node:fs'
import http from 'node:http'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
/**
 * Captures a scene still per guardian from the official YouTube embed of the
 * character's trailer, using the same real-player Playwright method the repo's
 * tests use for frame verification. Non-commercial fan use per Bungie's IP
 * policy (help.bungie.net article 360049201911): "use our stuff to make your
 * own stuff" — stills feed the transformative guardian cards, never raw
 * re-uploads.
 *
 * Usage: node scripts/guardian-cards/capture-scenes.mjs [slug ...]
 * Writes scenes/<slug>.png next to this script (gitignored intermediates).
 */
import { chromium } from 'playwright'

const here = path.dirname(fileURLToPath(import.meta.url))
const { characters } = JSON.parse(fs.readFileSync(path.join(here, 'characters.json'), 'utf8'))
const only = process.argv.slice(2)
const selected = only.length
  ? characters.filter(character => only.includes(character.slug))
  : characters

fs.mkdirSync(path.join(here, 'scenes'), { recursive: true })

// The YouTube IFrame API requires an http origin, not file://.
const server = http.createServer((req, res) => {
  res.setHeader('content-type', 'text/html')
  res.end(fs.readFileSync(path.join(here, 'capture.html')))
})
await new Promise(resolve => server.listen(4175, resolve))

const browser = await chromium.launch()
const page = await browser.newPage({
  viewport: { width: 1280, height: 720 }
})

let currentVideo = ''
for (const character of selected) {
  if (character.videoId !== currentVideo) {
    await page.goto(`http://localhost:4175/?v=${character.videoId}`)
    await page.waitForFunction('window.playerReady === true', null, { timeout: 30000 })
    currentVideo = character.videoId
  }
  // Lead in several seconds early so YouTube's title/tap overlays fade out
  // before the target frame, then grab the frame live while playing.
  await page.evaluate(t => window.seekAndPlay(t), Math.max(0, character.sceneTime - 6))
  await page.waitForFunction(
    t => window.playerState() === 1 && window.currentTime() >= t,
    character.sceneTime,
    { timeout: 30000 },
  )
  // Crop to the letterboxed footage region inside the 16:9 player.
  await page.screenshot({
    path: path.join(here, 'scenes', `${character.slug}.png`),
    clip: {
      x: 0,
      y: 96,
      width: 1280,
      height: 530
    },
  })
  console.info(`captured scenes/${character.slug}.png at ~${character.sceneTime}s of ${character.videoId}`)
}

await browser.close()
server.close()
