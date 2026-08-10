/**
 * Track 0 handoff probe — does the Wolves cinematic ever start?
 *
 * The owner's report is "wolves doesn't even play": the prologue runs and the
 * Track 0 cinematic never arrives. `wolves-movie-flow.mjs` cannot see this,
 * because it enters Track 0 through the test-only progress helper with a mocked
 * player — it asserts what happens *after* the handoff, never the handoff
 * itself under a real embed.
 *
 * So this attaches to a real browser over CDP (Playwright's bundled Chromium
 * has no proprietary codecs) and samples the show's own published debug surface
 * — `window.__wolvesCinematic` — while the real soundtrack plays. It reports
 * where the transport stops rather than asserting a pass/fail, because the
 * question here is diagnostic.
 *
 *   flatpak run --command=chrome com.google.Chrome --headless=new \
 *     --remote-debugging-port=9333 --remote-allow-origins='*' about:blank &
 *   WOLVES_CDP=http://127.0.0.1:9333 node tests/wolves-trackzero-handoff-probe.mjs
 */
import process from 'node:process'
import { chromium } from 'playwright'

const BASE_URL = process.env.WOLVES_BASE_URL ?? 'http://127.0.0.1:5173'
const CDP_ENDPOINT = process.env.WOLVES_CDP ?? null
const SECONDS = Number(process.env.WOLVES_PROBE_SECONDS ?? 90)

const browser = CDP_ENDPOINT
  ? await chromium.connectOverCDP(CDP_ENDPOINT)
  : await chromium.launch({ headless: true, args: ['--mute-audio', '--no-sandbox'] })
const context = CDP_ENDPOINT
  ? (browser.contexts()[0] ?? await browser.newContext({ viewport: { width: 1600, height: 900 } }))
  : await browser.newContext({ viewport: { width: 1600, height: 900 } })
const page = await context.newPage()
const consoleErrors = []
page.on('pageerror', error => consoleErrors.push(`pageerror: ${error.message}`))
page.on('console', message => {
  if (message.type() === 'error') {
    consoleErrors.push(`console: ${message.text().slice(0, 160)}`)
  }
})

await page.goto(`${BASE_URL}/wolves/?directors-cut`, { waitUntil: 'domcontentloaded', timeout: 30_000 })
await page.waitForTimeout(2500)

const sample = () => page.evaluate(() => {
  const app = document.querySelector('#app')?.__vue_app__
  const store = app?.config?.globalProperties?.$pinia?.state?.value?.cinematic
  const players = [...document.querySelectorAll('iframe')].map(frame => frame.src.replace("https://www.youtube.com/embed/", "embed/").slice(0, 60))
  return {
    phase: store?.phase ?? null,
    segmentIndex: store?.segmentIndex ?? null,
    nativeTime: Math.round((store?.nativeTime ?? 0) * 10) / 10,
    finished: store?.finished ?? null,
    introActive: Boolean(document.querySelector('.wolves-intro-overlay')),
    trackZeroGrid: Boolean(document.querySelector('.wc-trackzero-grid')),
    iframes: players.length,
    allIframes: players,
  }
})

const button = page.getByRole('button', { name: /DIRECTOR'S CUT/i })
if (await button.count()) {
  await button.click()
  console.log('clicked the Director\'s Cut entrance')
}

console.log(`\nsampling ${SECONDS}s of real playback\n`)
let previous = null
for (let elapsed = 0; elapsed <= SECONDS; elapsed += 5) {
  const state = await sample()
  const line = JSON.stringify(state)
  if (line !== previous) {
    console.log(`  t+${String(elapsed).padStart(3)}s  ${line}`)
    previous = line
  }
  await page.waitForTimeout(5000)
}

console.log('\nconsole/page errors:', consoleErrors.length ? consoleErrors.slice(0, 10) : 'none')
if (!CDP_ENDPOINT) {
  await browser.close()
}
else {
  await page.close()
}
