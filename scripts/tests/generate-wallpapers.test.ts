import { execFileSync } from 'node:child_process'
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'

// generate-wallpapers.js resolves its input and output from its own location
// (ROOT_DIR = <script dir>/..), so each test copies it into a scratch tree with
// the same public/ and src/ layout and runs it there, against fixture images.
const generatorSource = resolve(process.cwd(), 'scripts/generate-wallpapers.js')

interface Wallpaper {
  type: 'single' | 'daynight'
  name: string
  dayName?: string
  nightName?: string
  title: string
  fit?: 'cover' | 'contain'
  description?: string
  theaterTitleOnly?: boolean
}

type Tree = Partial<Record<'wolves' | 'showcase' | 'people', Record<string, string>>>

const roots: string[] = []

afterEach(() => {
  for (const root of roots.splice(0)) {
    rmSync(root, { recursive: true, force: true })
  }
})

function scratchRoot(tree: Tree) {
  const root = mkdtempSync(join(tmpdir(), 'generate-wallpapers-'))
  roots.push(root)
  mkdirSync(join(root, 'scripts'))
  copyFileSync(generatorSource, join(root, 'scripts/generate-wallpapers.js'))
  mkdirSync(join(root, 'src/components/wolves'), { recursive: true })
  for (const [subfolder, files] of Object.entries(tree)) {
    const dir = join(root, 'public/img/wallpapers/wolves', subfolder)
    mkdirSync(dir, { recursive: true })
    for (const [name, contents] of Object.entries(files)) {
      writeFileSync(join(dir, name), contents)
    }
  }
  return root
}

function run(tree: Tree) {
  const root = scratchRoot(tree)
  const output = execFileSync(process.execPath, [join(root, 'scripts/generate-wallpapers.js')], {
    cwd: root,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  const source = readFileSync(join(root, 'src/components/wolves/wallpapers-list.ts'), 'utf8')
  const marker = 'export const wallpapers: Wallpaper[] = '
  const start = source.indexOf(marker)
  expect(start).toBeGreaterThan(-1)
  // The array literal is plain JavaScript (single-quoted strings, identifier keys).
  // eslint-disable-next-line no-new-func
  const wallpapers = new Function(`return ${source.slice(start + marker.length)}`)() as Wallpaper[]
  return { output, source, wallpapers }
}

// Distinct contents per file unless a test wants duplicates.
function images(...names: string[]) {
  return Object.fromEntries(names.map(name => [name, `image:${name}`]))
}

describe('generate-wallpapers.js', () => {
  it('keeps only image files, matching extensions case-insensitively and including gifs', () => {
    const { wallpapers } = run({
      showcase: images('a.webp', 'b.PNG', 'c.jpg', 'd.JPEG', 'e.gif', 'notes.txt', 'f.svg', 'g.webp.bak', 'README'),
    })

    expect(wallpapers.map(w => w.name)).toEqual([
      'wolves/showcase/a.webp',
      'wolves/showcase/b.PNG',
      'wolves/showcase/c.jpg',
      'wolves/showcase/d.JPEG',
      'wolves/showcase/e.gif',
    ])
  })

  it('emits story, then showcase, then people, each sorted by filename', () => {
    const { wallpapers, output } = run({
      people: images('zed.webp', 'amy.webp'),
      showcase: images('showcase-2.webp', 'showcase-10.webp'),
      wolves: images('zeta.webp', 'alpha.webp'),
    })

    expect(wallpapers.map(w => w.name)).toEqual([
      'wolves/wolves/alpha.webp',
      'wolves/wolves/zeta.webp',
      'wolves/showcase/showcase-10.webp',
      'wolves/showcase/showcase-2.webp',
      'wolves/people/amy.webp',
      'wolves/people/zed.webp',
    ])
    expect(output).toContain('Successfully generated playlist with 6 wallpapers')
  })

  it('pairs -day and -night story files into one daynight entry, across extensions', () => {
    const { wallpapers } = run({
      wolves: images('bluefin-prey-day.webp', 'bluefin-prey-night.png', 'moon-night.webp', 'sun-day.webp'),
    })

    expect(wallpapers).toEqual([
      {
        type: 'daynight',
        name: 'bluefin-prey',
        dayName: 'wolves/wolves/bluefin-prey-day.webp',
        nightName: 'wolves/wolves/bluefin-prey-night.png',
        title: 'Prey (Day & Night) by Dr. Natalia Jagielska and Delphic Melody (M. Gopal)',
      },
      // An unpaired half stays a single slide under its own filename.
      { type: 'single', name: 'wolves/wolves/moon-night.webp', title: 'Moon Night' },
      { type: 'single', name: 'wolves/wolves/sun-day.webp', title: 'Sun Day' },
    ])
  })

  it('swaps day and night for bluefin-collapse, whose art is visually reversed', () => {
    const { wallpapers } = run({
      wolves: images('bluefin-collapse-day.webp', 'bluefin-collapse-night.webp', 'bluefin-eyes-day.webp', 'bluefin-eyes-night.webp'),
    })

    expect(wallpapers).toMatchObject([
      {
        name: 'bluefin-collapse',
        dayName: 'wolves/wolves/bluefin-collapse-night.webp',
        nightName: 'wolves/wolves/bluefin-collapse-day.webp',
      },
      {
        name: 'bluefin-eyes',
        dayName: 'wolves/wolves/bluefin-eyes-day.webp',
        nightName: 'wolves/wolves/bluefin-eyes-night.webp',
      },
    ])
  })

  it('marks panoramic story art fit: cover, for single and daynight entries alike', () => {
    const { wallpapers } = run({
      wolves: images('bluefin-duality-day.webp', 'bluefin-duality-night.webp', 'bluefin-dusk.webp', 'bluefin-huntress.webp'),
    })

    expect(wallpapers).toEqual([
      expect.objectContaining({ type: 'daynight', name: 'bluefin-duality', fit: 'cover' }),
      expect.not.objectContaining({ fit: expect.anything() }),
      expect.objectContaining({ type: 'single', name: 'wolves/wolves/bluefin-huntress.webp', fit: 'cover' }),
    ])
    expect(wallpapers[1].name).toBe('wolves/wolves/bluefin-dusk.webp')
  })

  it('uses curated titles, and otherwise title-cases the stem with KC and CNC upper-cased', () => {
    const { wallpapers } = run({
      showcase: images('showcase-5.webp', 'kc_cnc_eu-day_one.jpg', 'my--odd__name.webp'),
    })

    expect(Object.fromEntries(wallpapers.map(w => [w.name, w.title]))).toEqual({
      'wolves/showcase/kc_cnc_eu-day_one.jpg': 'KC CNC Eu Day One',
      'wolves/showcase/my--odd__name.webp': 'My Odd Name',
      'wolves/showcase/showcase-5.webp': 'Community Showcase by Killishness',
    })
  })

  it('withholds the title-card portrait from people but not from other folders', () => {
    const { wallpapers } = run({
      people: images('Yikes!.webp', 'kyle.webp'),
      showcase: images('Yikes!.webp'),
    })

    expect(wallpapers.map(w => w.name)).toEqual([
      'wolves/showcase/Yikes!.webp',
      'wolves/people/kyle.webp',
    ])
  })

  it('flags the Jono interview still as a title-only theater caption', () => {
    const { wallpapers } = run({
      people: images('interview-jono-bacon-cult-psychology-kubernetes.webp', 'interview-l4e-games-for-everyone-2-linux-gaming.webp'),
    })

    expect(wallpapers).toEqual([
      {
        type: 'single',
        name: 'wolves/people/interview-jono-bacon-cult-psychology-kubernetes.webp',
        title: 'Jono Bacon, Stateshift — "The Cult Psychology of Kubernetes"',
        theaterTitleOnly: true,
      },
      {
        type: 'single',
        name: 'wolves/people/interview-l4e-games-for-everyone-2-linux-gaming.webp',
        title: 'Linux For Everyone — "Games For Everyone #2: Linux Gaming Is WINNING"',
      },
    ])
  })

  describe('duplicate contents', () => {
    it('keeps a pinned stem over every other copy of the same image', () => {
      const { wallpapers } = run({
        people: {
          'aaa-curated-caption.webp': 'same',
          'kubecon-55164225841.webp': 'same',
          'walters.webp': 'same',
        },
      })

      expect(wallpapers.map(w => w.name)).toEqual(['wolves/people/walters.webp'])
      expect(wallpapers[0].title).toBe('bootc creator Colin Walters')
    })

    it('prefers a curated filename over stock feed and camera-roll names', () => {
      const { wallpapers } = run({
        people: {
          '20240606_123456.webp': 'one',
          'IMG_0001.jpg': 'one',
          'flickr-53608872377.webp': 'one',
          'kubecon-55164225841.webp': 'one',
          'sherman-m2.webp': 'one',
        },
        showcase: {
          'PXL_20260101.jpg': 'two',
          'Screenshot From 2026-01-01.png': 'two',
          'my-desktop.png': 'two',
        },
      })

      expect(wallpapers.map(w => w.name)).toEqual([
        'wolves/showcase/my-desktop.png',
        'wolves/people/sherman-m2.webp',
      ])
    })

    it('falls back to the first filename when every copy is a stock name', () => {
      const { wallpapers } = run({
        people: {
          'MVIMG_2.jpg': 'same',
          'flickr-1.webp': 'same',
          'kubecon-2.webp': 'same',
        },
      })

      expect(wallpapers.map(w => w.name)).toEqual(['wolves/people/MVIMG_2.jpg'])
    })

    it('keeps files whose contents differ, and does not dedupe story art', () => {
      const { wallpapers } = run({
        people: { 'kubecon-1.webp': 'a', 'kubecon-2.webp': 'b' },
        wolves: { 'one.webp': 'same', 'two.webp': 'same' },
      })

      expect(wallpapers.map(w => w.name)).toEqual([
        'wolves/wolves/one.webp',
        'wolves/wolves/two.webp',
        'wolves/people/kubecon-1.webp',
        'wolves/people/kubecon-2.webp',
      ])
    })
  })

  it('groups chicken, huntress and lazy-days together where the first of them sorted', () => {
    const { wallpapers } = run({
      people: images('kyle.webp'),
      wolves: images(
        'aaa.webp',
        'bluefin-chicken.webp',
        'bluefin-dusk.webp',
        'bluefin-eyes-day.webp',
        'bluefin-eyes-night.webp',
        'bluefin-huntress.webp',
        'bluefin-lazy-days.webp',
        'zzz.webp',
      ),
    })

    expect(wallpapers.map(w => w.name)).toEqual([
      'wolves/wolves/aaa.webp',
      'wolves/wolves/bluefin-chicken.webp',
      'wolves/wolves/bluefin-huntress.webp',
      'wolves/wolves/bluefin-lazy-days.webp',
      'wolves/wolves/bluefin-dusk.webp',
      'bluefin-eyes',
      'wolves/wolves/zzz.webp',
      'wolves/people/kyle.webp',
    ])
  })

  it('groups whichever of the three exist, and leaves a lone one where it sorted', () => {
    const pair = run({ wolves: images('a.webp', 'bluefin-huntress.webp', 'bluefin-k.webp', 'bluefin-lazy-days.webp') })
    expect(pair.wallpapers.map(w => w.name)).toEqual([
      'wolves/wolves/a.webp',
      'wolves/wolves/bluefin-huntress.webp',
      'wolves/wolves/bluefin-lazy-days.webp',
      'wolves/wolves/bluefin-k.webp',
    ])

    const lone = run({ wolves: images('a.webp', 'bluefin-huntress.webp', 'm.webp', 'z-bluefin-lazy-days.webp') })
    expect(lone.wallpapers.map(w => w.name)).toEqual([
      'wolves/wolves/a.webp',
      'wolves/wolves/bluefin-huntress.webp',
      'wolves/wolves/m.webp',
      'wolves/wolves/z-bluefin-lazy-days.webp',
    ])
  })

  it('escapes quotes and backslashes in titles so the module still parses', () => {
    const { wallpapers, source } = run({ showcase: images(`o'brien\\desk.webp`) })

    expect(wallpapers).toEqual([
      { type: 'single', name: `wolves/showcase/o'brien\\desk.webp`, title: `O'brien\\desk` },
    ])
    expect(source).toContain(`name: 'wolves/showcase/o\\'brien\\\\desk.webp'`)
  })

  it('writes an empty list with the Wallpaper interface when no folders exist', () => {
    const { wallpapers, source, output } = run({})

    expect(wallpapers).toEqual([])
    expect(source).toMatch(/^\/\/ Automatically generated by scripts\/generate-wallpapers\.js\. Do not edit directly\.\n/)
    expect(source).toContain('export interface Wallpaper {')
    expect(source).toContain('export const wallpapers: Wallpaper[] = []\n')
    expect(output).toContain('Successfully generated playlist with 0 wallpapers')
  })

  it('exits 1 when the output file cannot be written', () => {
    const root = scratchRoot({ showcase: images('a.webp') })
    rmSync(join(root, 'src'), { recursive: true })

    let status: number | null = 0
    let stderr = ''
    try {
      execFileSync(process.execPath, [join(root, 'scripts/generate-wallpapers.js')], { cwd: root, stdio: 'pipe' })
    }
    catch (error) {
      const failure = error as { status: number | null, stderr: string }
      status = failure.status
      stderr = String(failure.stderr)
    }

    expect(status).toBe(1)
    expect(stderr).toContain('Error generating wallpapers playlist:')
  })
})
