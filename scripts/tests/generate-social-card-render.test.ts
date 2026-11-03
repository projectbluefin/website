import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// CI's unit-test job installs no Playwright browser, so the existing
// "renders a valid social card" test there only exercises the pre-rendered
// fallback. These tests drive the render and WebP-conversion steps with a
// fake browser and a mocked converter so they run on every CI pass.

const mockedExec = vi.hoisted(() => vi.fn())
const mockedLaunch = vi.hoisted(() => vi.fn())

vi.mock('node:child_process', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:child_process')>()
  return {
    ...actual,
    default: { ...actual, execFileSync: mockedExec },
    execFileSync: mockedExec,
  }
})

vi.mock('playwright', () => ({
  chromium: { launch: mockedLaunch },
}))

const {
  BLUEFIN_EXTRA_WALLPAPERS,
  BLUEFIN_MONTHLY_WALLPAPERS,
  convertPngToWebp,
  generateSocialCard,
  selectMonthlyWallpaper,
  selectRandomWallpaper,
  selectRotatingWallpaper,
} = await import('../generate-social-cards.js')

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT_DIR = path.resolve(__dirname, '../..')
const PUBLIC_DIR = path.join(ROOT_DIR, 'public')
const WORDMARK_PATH = path.join(PUBLIC_DIR, 'brands/bluefin-wordmark.svg')
const TEMP_PNG = path.join(ROOT_DIR, '.tmp-social-card.png')

interface FakePage {
  setContent: ReturnType<typeof vi.fn>
  screenshot: ReturnType<typeof vi.fn>
  close: ReturnType<typeof vi.fn>
}

function fakeBrowser() {
  const page: FakePage = {
    setContent: vi.fn(async () => {}),
    screenshot: vi.fn(async ({ path: p }: { path: string }) => {
      fs.writeFileSync(p, 'fake-png')
    }),
    close: vi.fn(async () => {}),
  }
  const browser = {
    newPage: vi.fn(async () => page),
    close: vi.fn(async () => {}),
  }
  return { browser, page }
}

let workDir: string

beforeEach(() => {
  mockedExec.mockReset()
  mockedLaunch.mockReset()
  workDir = fs.mkdtempSync(path.join(os.tmpdir(), 'social-card-'))
})

afterEach(() => {
  fs.rmSync(workDir, { recursive: true, force: true })
  fs.rmSync(TEMP_PNG, { force: true })
  vi.restoreAllMocks()
})

describe('convertPngToWebp', () => {
  it('uses cwebp with the requested quality when it is available', () => {
    const png = path.join(workDir, 'in.png')
    const webp = path.join(workDir, 'out.webp')

    expect(convertPngToWebp(png, webp, 77)).toBe(true)
    expect(mockedExec).toHaveBeenCalledTimes(1)
    expect(mockedExec.mock.calls[0][0]).toBe('cwebp')
    expect(mockedExec.mock.calls[0][1]).toEqual(['-q', '77', png, '-o', webp])
  })

  it('falls back to Python PIL when cwebp is missing', () => {
    const png = path.join(workDir, 'in.png')
    const webp = path.join(workDir, 'out.webp')
    mockedExec.mockImplementationOnce(() => {
      throw new Error('cwebp: not found')
    })

    expect(convertPngToWebp(png, webp, 90)).toBe(true)
    expect(mockedExec).toHaveBeenCalledTimes(2)
    const [cmd, args] = mockedExec.mock.calls[1]
    expect(cmd).toBe('python3')
    expect(args[0]).toBe('-c')
    expect(args[1]).toContain(`Image.open('${png}')`)
    expect(args[1]).toContain(`.save('${webp}', 'WEBP', quality=90)`)
  })

  it('copies the PNG unchanged and reports failure when no converter works', () => {
    const png = path.join(workDir, 'in.png')
    const webp = path.join(workDir, 'out.webp')
    fs.writeFileSync(png, 'png-bytes')
    mockedExec.mockImplementation(() => {
      throw new Error('missing')
    })
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})

    expect(convertPngToWebp(png, webp)).toBe(false)
    expect(fs.readFileSync(webp, 'utf8')).toBe('png-bytes')
    expect(warn).toHaveBeenCalledWith('WebP conversion failed, keeping PNG:', 'missing')
  })
})

describe('generateSocialCard render path', () => {
  it('injects the wallpaper and wordmark into the template, screenshots it and converts to WebP', async () => {
    const { browser, page } = fakeBrowser()
    const wallpaper = BLUEFIN_MONTHLY_WALLPAPERS[0]
    const outputPath = path.join(workDir, 'nested/dir/card.webp')

    const result = await generateSocialCard({ wallpaper, outputPath, deviceScaleFactor: 3, browser })

    expect(result).toBe(outputPath)
    expect(browser.newPage).toHaveBeenCalledWith({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 3 })

    const [html, opts] = page.setContent.mock.calls[0]
    expect(opts).toEqual({ waitUntil: 'networkidle' })
    const wallpaperB64 = fs.readFileSync(path.join(PUBLIC_DIR, 'img/wallpapers', wallpaper.file)).toString('base64')
    expect(html).toContain(`id="bg" style="background-image: url('data:image/webp;base64,${wallpaperB64}')"`)
    expect(html).toContain(`<div class="wordmark-wrap" id="wordmark">${fs.readFileSync(WORDMARK_PATH, 'utf8')}</div>`)
    expect(html).not.toContain('<div class="background" id="bg"></div>')

    expect(page.screenshot).toHaveBeenCalledWith({ path: TEMP_PNG, type: 'png' })
    expect(page.close).toHaveBeenCalled()
    expect(fs.existsSync(path.dirname(outputPath))).toBe(true)
    expect(mockedExec.mock.calls[0][1]).toEqual(['-q', '90', TEMP_PNG, '-o', outputPath])
    expect(fs.existsSync(TEMP_PNG)).toBe(false)
    // A caller-supplied browser is reused across cards, so it must stay open.
    expect(browser.close).not.toHaveBeenCalled()
    expect(mockedLaunch).not.toHaveBeenCalled()
  })

  it('launches and closes its own browser when none is passed', async () => {
    const { browser } = fakeBrowser()
    mockedLaunch.mockResolvedValue(browser)

    await generateSocialCard({
      wallpaper: BLUEFIN_EXTRA_WALLPAPERS[0],
      outputPath: path.join(workDir, 'card.webp'),
    })

    expect(mockedLaunch).toHaveBeenCalledWith({ headless: true })
    expect(browser.close).toHaveBeenCalledTimes(1)
  })

  it('closes its own browser even when the wallpaper file is missing', async () => {
    const { browser } = fakeBrowser()
    mockedLaunch.mockResolvedValue(browser)

    await expect(generateSocialCard({
      wallpaper: { file: 'does-not-exist.webp', title: 'Missing' },
      outputPath: path.join(workDir, 'card.webp'),
    })).rejects.toThrow(/Wallpaper file not found: .*does-not-exist\.webp/)
    expect(browser.newPage).not.toHaveBeenCalled()
    expect(browser.close).toHaveBeenCalledTimes(1)
  })
})

describe('generateSocialCard without a browser', () => {
  it('copies the pre-rendered card when Playwright cannot launch', async () => {
    mockedLaunch.mockRejectedValue(new Error('Executable doesn\'t exist\nrun npx playwright install'))
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const wallpaper = BLUEFIN_MONTHLY_WALLPAPERS[0]
    const outputPath = path.join(workDir, 'sub/meta.webp')

    expect(await generateSocialCard({ wallpaper, outputPath })).toBe(outputPath)

    const prebuilt = path.join(PUBLIC_DIR, 'cards', wallpaper.file)
    expect(fs.readFileSync(outputPath).equals(fs.readFileSync(prebuilt))).toBe(true)
    expect(warn.mock.calls[0][0]).toContain('Playwright browser unavailable (Executable doesn\'t exist)')
    expect(mockedExec).not.toHaveBeenCalled()
  })

  it('rethrows the launch error when there is no pre-rendered card to fall back on', async () => {
    mockedLaunch.mockRejectedValue(new Error('no browser'))
    const outputPath = path.join(workDir, 'meta.webp')

    await expect(generateSocialCard({
      wallpaper: { file: 'not-prebuilt.webp', title: 'Not prebuilt' },
      outputPath,
    })).rejects.toThrow('no browser')
    expect(fs.existsSync(outputPath)).toBe(false)
  })
})

describe('wallpaper selection edge cases', () => {
  it('refuses to pick from an empty pool', () => {
    expect(() => selectRotatingWallpaper([])).toThrow('Wallpaper pool is empty')
    expect(() => selectRandomWallpaper([])).toThrow('Wallpaper pool is empty')
  })

  it('falls back to the first pool entry when no wallpaper matches the month', () => {
    const pool = BLUEFIN_EXTRA_WALLPAPERS
    expect(selectMonthlyWallpaper(pool, new Date(Date.UTC(2026, 4, 1)))).toBe(pool[0])
  })

  it('uses the first entry of the month when it has no Day variant', () => {
    const night = BLUEFIN_MONTHLY_WALLPAPERS.find(w => w.monthIndex === 5 && w.time === 'Night')!
    expect(selectMonthlyWallpaper([BLUEFIN_EXTRA_WALLPAPERS[0], night], new Date(Date.UTC(2026, 4, 1)))).toBe(night)
  })
})
