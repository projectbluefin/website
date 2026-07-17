/**
 * Navbar visual regression test — standalone Playwright script
 * Checks TopNavbar matches docs.projectbluefin.io styling
 *
 * Prerequisites: dev server must be running at http://localhost:5173
 *   just serve   (from repo root)
 *
 * Run:
 *   node src/tests/navbar-visual.mjs
 */

import { chromium } from 'playwright'

const URL = (process.env.WOLVES_BASE_URL ?? 'http://localhost:5173/').replace(/\/+$/, '') + '/'
const SCREENSHOT = '/tmp/nav-test-result.png'
const VIEWPORT = { width: 1440, height: 900 }

// ── Expected values ────────────────────────────────────────────────────────────
// Pixel-accurate measurements from docs.projectbluefin.io @ 1440×900 dark-mode
// Captured 2026-05-11 via getBoundingClientRect()
const EXPECTED_LOGO_HEIGHT = '32px'
const EXPECTED_BRAND_MARGIN_RIGHT = '16px'
const EXPECTED_BRAND_GAP = '8px'              // explicit; docs renders same 8px visually
const EXPECTED_LINK_PADDING_TOP = '4px'
const EXPECTED_LINK_PADDING_BOTTOM = '4px'
const EXPECTED_LINK_PADDING_LEFT = '12px'
const EXPECTED_LINK_PADDING_RIGHT = '12px'
const EXPECTED_LOGO_TO_TITLE_GAP_MIN = 7      // px — allow ±1px for sub-pixel
const EXPECTED_LOGO_TO_TITLE_GAP_MAX = 9
const EXPECTED_WITHIN_GROUP_GAP_MAX = 1       // px — links in same group touch (0px)
const EXPECTED_INNER_PADDING_VERTICAL = '0px' // matches docs; align-items:center handles centering
const EXPECTED_NAVBAR_HEIGHT = '60px'

const EXPECTED_LINKS = [
  'Documentation',
  'Ask Bluefin',
  'Blog',
  'Changelogs',
  'Reports',
  'Discussions',
  'Feedback',
  'Store (US Only)',
]

const EXPECTED_LINK_FONT_SIZE = '16px'
const EXPECTED_LINK_FONT_WEIGHT = '500'
const EXPECTED_TITLE_FONT_SIZE = '16px'
const EXPECTED_TITLE_FONT_WEIGHT = '700'

// ── Helpers ────────────────────────────────────────────────────────────────────
let passed = 0
let failed = 0

function assert(label, actual, expected) {
  const ok = actual === expected
  const status = ok ? '✅ PASS' : '❌ FAIL'
  if (ok) {
    passed++
    console.log(`  ${status}  ${label}`)
    console.log(`           got: ${actual}`)
  }
  else {
    failed++
    console.log(`  ${status}  ${label}`)
    console.log(`           expected: ${expected}`)
    console.log(`           got:      ${actual}`)
  }
  return ok
}

function assertRange(label, actual, min, max) {
  const ok = actual >= min && actual <= max
  const status = ok ? '✅ PASS' : '❌ FAIL'
  if (ok) {
    passed++
    console.log(`  ${status}  ${label}`)
    console.log(`           got: ${actual} (range ${min}–${max})`)
  }
  else {
    failed++
    console.log(`  ${status}  ${label}`)
    console.log(`           expected range: ${min}–${max}`)
    console.log(`           got:            ${actual}`)
  }
  return ok
}

function assertFuzzy(label, actual, expected, tolerance = 1) {
  const diff = Math.abs(actual - expected)
  const ok = diff <= tolerance
  const status = ok ? '✅ PASS' : '❌ FAIL'
  if (ok) {
    passed++
    console.log(`  ${status}  ${label}`)
    console.log(`           got: ${actual} (expected ${expected} ±${tolerance})`)
  }
  else {
    failed++
    console.log(`  ${status}  ${label}`)
    console.log(`           expected: ${expected} ±${tolerance}`)
    console.log(`           got:      ${actual}  (diff: ${diff.toFixed(2)})`)
  }
  return ok
}

function parsePx(value) {
  return parseFloat(value ?? '0')
}

function assertContains(label, list, item) {
  const ok = list.includes(item)
  const status = ok ? '✅ PASS' : '❌ FAIL'
  if (ok) {
    passed++
    console.log(`  ${status}  ${label}`)
  }
  else {
    failed++
    console.log(`  ${status}  ${label}`)
    console.log(`           "${item}" not found in [${list.join(', ')}]`)
  }
  return ok
}

// ── Main ───────────────────────────────────────────────────────────────────────
const browser = await chromium.launch({ headless: true })
const page = await browser.newPage()
await page.setViewportSize(VIEWPORT)

console.log(`\n🔵  Bluefin TopNavbar visual test`)
console.log(`    URL:        ${URL}`)
console.log(`    Viewport:   ${VIEWPORT.width}×${VIEWPORT.height}`)
console.log(`    Screenshot: ${SCREENSHOT}\n`)

// ── Console error capture (must be wired before goto) ───────────────────────
const consoleErrors = []
page.on('console', (msg) => {
  if (msg.type() === 'error') {
    consoleErrors.push(msg.text())
  }
})
page.on('pageerror', (err) => {
  consoleErrors.push(err.message)
})

// ── Load page ──────────────────────────────────────────────────────────────────
try {
  await page.goto(URL, { waitUntil: 'networkidle', timeout: 30_000 })
}
catch {
  // networkidle sometimes times out on animation-heavy pages — that's fine
}
await page.waitForTimeout(2000)

// ── Section 1: .navbar__link computed CSS ─────────────────────────────────────
console.log('── Section 1: .navbar__link computed CSS ──')

const linkHandle = await page.$('.navbar__link:not(.navbar__link--active)')
if (!linkHandle) {
  console.log('  ❌ FAIL  .navbar__link not found in DOM — is the server running?\n')
  failed++
}
else {
  const linkStyles = await page.evaluate((el) => {
    const cs = window.getComputedStyle(el)
    return {
      fontSize: cs.fontSize,
      fontWeight: cs.fontWeight,
    }
  }, linkHandle)

  assert('.navbar__link  fontSize', linkStyles.fontSize, EXPECTED_LINK_FONT_SIZE)
  assert('.navbar__link  fontWeight', linkStyles.fontWeight, EXPECTED_LINK_FONT_WEIGHT)
}

// ── Section 2: .navbar__title computed CSS ────────────────────────────────────
console.log('\n── Section 2: .navbar__title computed CSS ──')

const titleHandle = await page.$('.navbar__title')
if (!titleHandle) {
  console.log('  ❌ FAIL  .navbar__title not found in DOM\n')
  failed++
}
else {
  const titleStyles = await page.evaluate((el) => {
    const cs = window.getComputedStyle(el)
    return {
      fontSize: cs.fontSize,
      fontWeight: cs.fontWeight,
    }
  }, titleHandle)

  assert('.navbar__title  fontSize', titleStyles.fontSize, EXPECTED_TITLE_FONT_SIZE)
  assert('.navbar__title  fontWeight', titleStyles.fontWeight, EXPECTED_TITLE_FONT_WEIGHT)
}

// ── Section 3: nav link text presence ─────────────────────────────────────────
console.log('\n── Section 3: nav link text presence ──')

const linkTexts = await page.$$eval('.navbar__link', els =>
  els.map(el => el.textContent?.trim()).filter(Boolean))
console.log(`  Found links: [${linkTexts.join(', ')}]`)

for (const expected of EXPECTED_LINKS) {
  assertContains(`link text "${expected}"`, linkTexts, expected)
}

// ── Section 4: spacing and sizing ───────────────────────────────────────────
console.log('\n── Section 4: spacing and sizing ──')

const brandHandle = await page.$('.navbar__brand')
if (!brandHandle) {
  console.log('  ❌ FAIL  .navbar__brand not found in DOM')
  failed++
}
else {
  const brandStyles = await page.evaluate((el) => {
    const cs = window.getComputedStyle(el)
    return { marginRight: cs.marginRight, gap: cs.gap }
  }, brandHandle)
  assert('.navbar__brand  marginRight', brandStyles.marginRight, EXPECTED_BRAND_MARGIN_RIGHT)
  assert('.navbar__brand  gap', brandStyles.gap, EXPECTED_BRAND_GAP)
}

const logoImgHandle = await page.$('.navbar__logo img')
if (!logoImgHandle) {
  console.log('  ❌ FAIL  .navbar__logo img not found in DOM')
  failed++
}
else {
  const logoHeight = await page.evaluate(
    el => window.getComputedStyle(el).height,
    logoImgHandle,
  )
  assert('.navbar__logo img  height', logoHeight, EXPECTED_LOGO_HEIGHT)
}

const docusaurusNavHandle = await page.$('.docusaurus-navbar')
if (!docusaurusNavHandle) {
  console.log('  ❌ FAIL  .docusaurus-navbar not found in DOM')
  failed++
}
else {
  const navHeight = await page.evaluate(
    el => window.getComputedStyle(el).height,
    docusaurusNavHandle,
  )
  assert('.docusaurus-navbar  height', navHeight, EXPECTED_NAVBAR_HEIGHT)
}

// ── Section 4b: pixel-accurate spacing (docs-baseline measurements) ────────────
console.log('\n── Section 4b: pixel-accurate spacing (docs-baseline) ──')

const spacingData = await page.evaluate(() => {
  const logoImg = document.querySelector('.navbar__logo img')
  const title = document.querySelector('.navbar__title')
  const firstLink = document.querySelector('.navbar__link')
  const leftItems = document.querySelector('.navbar__items:not(.navbar__items--right)')
  const rightItems = document.querySelector('.navbar__items--right')
  const inner = document.querySelector('.navbar__inner')

  const r = el => el ? el.getBoundingClientRect() : null
  const cs = el => el ? window.getComputedStyle(el) : null

  const logoRect = r(logoImg)
  const titleRect = r(title)
  const logoToTitle = (logoRect && titleRect) ? titleRect.left - logoRect.right : null

  const allLinks = [...document.querySelectorAll('.navbar__link')]
  const leftLinks = allLinks.filter(el => !el.closest('.navbar__items--right'))
  const rightLinks = allLinks.filter(el => !!el.closest('.navbar__items--right'))

  // Gap between last left link and first right link
  const lastLeft = leftLinks.length ? r(leftLinks[leftLinks.length - 1]) : null
  const firstRight = rightLinks.length ? r(rightLinks[0]) : null
  const middleGap = (lastLeft && firstRight) ? firstRight.left - lastLeft.right : null

  // Within-group gaps: check all adjacent left links and adjacent right links
  const leftGaps = []
  for (let i = 0; i < leftLinks.length - 1; i++) {
    leftGaps.push(r(leftLinks[i + 1]).left - r(leftLinks[i]).right)
  }
  const rightGaps = []
  for (let i = 0; i < rightLinks.length - 1; i++) {
    rightGaps.push(r(rightLinks[i + 1]).left - r(rightLinks[i]).right)
  }

  const innerCs = cs(inner)
  const firstLinkCs = cs(firstLink)

  return {
    logoToTitle,
    middleGap,
    leftGaps,
    rightGaps,
    innerPaddingTop: innerCs?.paddingTop,
    innerPaddingBottom: innerCs?.paddingBottom,
    linkPaddingTop: firstLinkCs?.paddingTop,
    linkPaddingBottom: firstLinkCs?.paddingBottom,
    linkPaddingLeft: firstLinkCs?.paddingLeft,
    linkPaddingRight: firstLinkCs?.paddingRight,
  }
})

if (spacingData.logoToTitle !== null) {
  assertRange(
    `logo → title gap (docs baseline: 8px ±1)`,
    spacingData.logoToTitle,
    EXPECTED_LOGO_TO_TITLE_GAP_MIN,
    EXPECTED_LOGO_TO_TITLE_GAP_MAX,
  )
}
else {
  console.log('  ❌ FAIL  could not compute logo→title gap (elements missing)')
  failed++
}

assert('.navbar__inner  paddingTop', spacingData.innerPaddingTop, EXPECTED_INNER_PADDING_VERTICAL)
assert('.navbar__inner  paddingBottom', spacingData.innerPaddingBottom, EXPECTED_INNER_PADDING_VERTICAL)
assert('.navbar__link  paddingTop', spacingData.linkPaddingTop, EXPECTED_LINK_PADDING_TOP)
assert('.navbar__link  paddingBottom', spacingData.linkPaddingBottom, EXPECTED_LINK_PADDING_BOTTOM)
assert('.navbar__link  paddingLeft', spacingData.linkPaddingLeft, EXPECTED_LINK_PADDING_LEFT)
assert('.navbar__link  paddingRight', spacingData.linkPaddingRight, EXPECTED_LINK_PADDING_RIGHT)

console.log(`  ℹ️   Middle gap (left↔right groups): ${spacingData.middleGap?.toFixed(1)}px`)
console.log(`       (docs=140.4px; local uses full viewport width — layout diff, not a bug)`)

const allWithinGroupGaps = [...spacingData.leftGaps, ...spacingData.rightGaps]
if (allWithinGroupGaps.length > 0) {
  const maxGap = Math.max(...allWithinGroupGaps)
  assertRange(
    `max within-group link gap ≤ ${EXPECTED_WITHIN_GROUP_GAP_MAX}px (links touch within their group)`,
    maxGap,
    -Infinity,
    EXPECTED_WITHIN_GROUP_GAP_MAX,
  )
  console.log(`       (individual within-group gaps: [${allWithinGroupGaps.map(g => g.toFixed(1)).join(', ')}])`)
}

// ── Section 5: active link styling ───────────────────────────────────────────
console.log('\n── Section 5: active link styling ──')

const activeLinkHandle = await page.$('.navbar__link--active')
if (!activeLinkHandle) {
  console.log('  ❌ FAIL  .navbar__link--active not found in DOM')
  failed++
}
else {
  const activeStyles = await page.evaluate((el) => {
    const cs = window.getComputedStyle(el)
    return {
      color: cs.color,
      fontWeight: cs.fontWeight,
    }
  }, activeLinkHandle)

  assert('.navbar__link--active  color', activeStyles.color, 'rgb(138, 151, 247)')
  assert('.navbar__link--active  fontWeight', activeStyles.fontWeight, '500')
}

// ── Section 6: right-side links exist and are in correct order ────────────────
console.log('\n── Section 6: right-side links order ──')

const EXPECTED_RIGHT_LINKS = ['Blog', 'Changelogs', 'Reports', 'Discussions', 'Feedback', 'Store (US Only)']

const rightLinkTexts = await page.$$eval(
  '.navbar__items--right .navbar__link',
  els => els.map(el => el.textContent?.trim()).filter(Boolean),
)
console.log(`  Found right-side links: [${rightLinkTexts.join(', ')}]`)

if (rightLinkTexts.length === 0) {
  console.log('  ❌ FAIL  No .navbar__items--right .navbar__link elements found')
  failed++
}
else {
  const actualOrder = JSON.stringify(rightLinkTexts)
  const expectedOrder = JSON.stringify(EXPECTED_RIGHT_LINKS)
  assert('right-side links order', actualOrder, expectedOrder)
}

// ── Section 7: spacing parity with docs (dark mode) ────────────────────────
console.log('\n── Section 7: spacing parity with docs (dark mode) ──')

let docsContext, docsPage
try {
  docsContext = await browser.newContext({ colorScheme: 'dark' })
  docsPage = await docsContext.newPage()
  await docsPage.setViewportSize({ width: 1440, height: 900 })
  await docsPage.goto('https://docs.projectbluefin.io', { waitUntil: 'networkidle', timeout: 15000 })
  await docsPage.waitForTimeout(2000)

  const docsMetrics = await docsPage.evaluate(() => {
    const logoImg = document.querySelector('.navbar__logo img')
    const title = document.querySelector('.navbar__title')
    const firstLink = document.querySelector('.navbar__link')
    const navbar = document.querySelector('nav.navbar') || document.querySelector('.navbar')

    const r = el => el ? el.getBoundingClientRect() : null
    const cs = el => el ? window.getComputedStyle(el) : null

    const logoRect = r(logoImg)
    const titleRect = r(title)
    const firstLinkRect = r(firstLink)

    return {
      logoToTitle: (logoRect && titleRect) ? titleRect.left - logoRect.right : null,
      titleToFirstLink: (titleRect && firstLinkRect) ? firstLinkRect.left - titleRect.right : null,
      linkPaddingTop: cs(firstLink)?.paddingTop,
      linkPaddingBottom: cs(firstLink)?.paddingBottom,
      linkPaddingLeft: cs(firstLink)?.paddingLeft,
      linkPaddingRight: cs(firstLink)?.paddingRight,
      navbarHeight: cs(navbar)?.height,
      navBackground: cs(navbar)?.backgroundColor,
      linkFontSize: cs(firstLink)?.fontSize,
      linkFontWeight: cs(firstLink)?.fontWeight,
    }
  })

  const localMetrics = await page.evaluate(() => {
    const logoImg = document.querySelector('.navbar__logo img')
    const title = document.querySelector('.navbar__title')
    const firstLink = document.querySelector('.navbar__link')
    const navbar = document.querySelector('.docusaurus-navbar')
      || document.querySelector('nav.navbar')
      || document.querySelector('.navbar')

    const r = el => el ? el.getBoundingClientRect() : null
    const cs = el => el ? window.getComputedStyle(el) : null

    const logoRect = r(logoImg)
    const titleRect = r(title)
    const firstLinkRect = r(firstLink)

    return {
      logoToTitle: (logoRect && titleRect) ? titleRect.left - logoRect.right : null,
      titleToFirstLink: (titleRect && firstLinkRect) ? firstLinkRect.left - titleRect.right : null,
      linkPaddingTop: cs(firstLink)?.paddingTop,
      linkPaddingBottom: cs(firstLink)?.paddingBottom,
      linkPaddingLeft: cs(firstLink)?.paddingLeft,
      linkPaddingRight: cs(firstLink)?.paddingRight,
      navbarHeight: cs(navbar)?.height,
      navBackground: cs(navbar)?.backgroundColor,
      linkFontSize: cs(firstLink)?.fontSize,
      linkFontWeight: cs(firstLink)?.fontWeight,
    }
  })

  console.log(`  ℹ️   docs.projectbluefin.io extracted values:`)
  console.log(`       logo→title: ${docsMetrics.logoToTitle?.toFixed(1)}px`)
  console.log(`       title→first link: ${docsMetrics.titleToFirstLink?.toFixed(1)}px`)
  console.log(`       link padding: ${docsMetrics.linkPaddingTop} ${docsMetrics.linkPaddingRight}`)
  console.log(`       navbar height: ${docsMetrics.navbarHeight}`)
  console.log(`       nav background: ${docsMetrics.navBackground}`)
  console.log(`       link font-size: ${docsMetrics.linkFontSize}  font-weight: ${docsMetrics.linkFontWeight}`)

  // ── Gap parity: local vs docs ──────────────────────────────────────────────
  if (docsMetrics.logoToTitle !== null && localMetrics.logoToTitle !== null) {
    assertFuzzy(
      `logo→title gap parity (local ${localMetrics.logoToTitle?.toFixed(1)}px vs docs ${docsMetrics.logoToTitle?.toFixed(1)}px)`,
      localMetrics.logoToTitle, docsMetrics.logoToTitle,
    )
  }
  else {
    console.log('  ❌ FAIL  logo→title gap: element missing on local or docs')
    failed++
  }

  if (docsMetrics.titleToFirstLink !== null && localMetrics.titleToFirstLink !== null) {
    assertFuzzy(
      `title→first link gap parity (local ${localMetrics.titleToFirstLink?.toFixed(1)}px vs docs ${docsMetrics.titleToFirstLink?.toFixed(1)}px)`,
      localMetrics.titleToFirstLink, docsMetrics.titleToFirstLink,
    )
  }
  else {
    console.log('  ❌ FAIL  title→first link gap: element missing on local or docs')
    failed++
  }

  // ── Absolute targets (±1px) — compare local against known-good values ──────
  assertFuzzy('link paddingTop (target 4px)',    parsePx(localMetrics.linkPaddingTop),    4)
  assertFuzzy('link paddingBottom (target 4px)', parsePx(localMetrics.linkPaddingBottom), 4)
  assertFuzzy('link paddingLeft (target 12px)',  parsePx(localMetrics.linkPaddingLeft),   12)
  assertFuzzy('link paddingRight (target 12px)', parsePx(localMetrics.linkPaddingRight),  12)
  assertFuzzy('navbar height (target 60px)',     parsePx(localMetrics.navbarHeight),      60)
  assertFuzzy('link font-size (target 16px)',    parsePx(localMetrics.linkFontSize),      16)
  assert('link font-weight (target 500)',        localMetrics.linkFontWeight, '500')

  // ── Background color parity ───────────────────────────────────────────────
  assert(
    `nav background color parity (local vs docs)`,
    localMetrics.navBackground,
    docsMetrics.navBackground,
  )

  await docsPage.close()
  await docsContext.close()
}
catch (err) {
  console.log(`  ❌ FAIL  Section 7 network/parse error: ${err.message}`)
  failed++
  if (docsPage) await docsPage.close().catch(() => {})
  if (docsContext) await docsContext.close().catch(() => {})
}

// ── Section 8: no JS console errors ─────────────────────────────────────────
console.log('\n── Section 8: no JS console errors ──')

if (consoleErrors.length === 0) {
  passed++
  console.log('  ✅ PASS  no console errors')
  console.log('           got: 0 errors')
}
else {
  failed++
  console.log(`  ❌ FAIL  ${consoleErrors.length} console error(s) detected:`)
  consoleErrors.forEach((e, i) => console.log(`           [${i + 1}] ${e}`))
}

// ── Screenshot ────────────────────────────────────────────────────────────────
await page.screenshot({ path: SCREENSHOT, fullPage: false })
console.log(`\n📸  Screenshot saved → ${SCREENSHOT}`)

// ── Summary ───────────────────────────────────────────────────────────────────
const total = passed + failed
console.log('\n══════════════════════════════════════════════')
if (failed === 0) {
  console.log(`✅  ALL ${total} assertions PASSED`)
}
else {
  console.log(`❌  ${failed}/${total} assertions FAILED`)
  console.log('\n   Interpretation:')
  console.log('   These failures show the delta between the current component CSS')
  console.log('   and the target docs.projectbluefin.io Docusaurus navbar styling.')
}
console.log('══════════════════════════════════════════════\n')

await browser.close()
process.exit(failed > 0 ? 1 : 0)
