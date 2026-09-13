import { execFileSync } from 'node:child_process'
import { copyFileSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterEach, describe, expect, it } from 'vitest'

const __dirname = dirname(fileURLToPath(import.meta.url))
const checkDocs = join(__dirname, '..', 'check-docs.mjs')

const temporaryRoots: string[] = []

interface RunResult {
  status: number
  stdout: string
  stderr: string
}

function write(root: string, path: string, contents: string) {
  const target = join(root, path)
  mkdirSync(dirname(target), { recursive: true })
  writeFileSync(target, contents)
}

function skillBody(name = 'demo', extra = '') {
  return [
    '---',
    `name: ${name}`,
    `description: ${name} skill`,
    '---',
    '',
    `# ${name}`,
    '',
    '## When to Use',
    '',
    'Always.',
    '',
    '## When NOT to Use',
    '',
    'Never.',
    '',
    '## Core Process',
    '',
    'Steps.',
    '',
    '## Common Rationalizations',
    '',
    'Excuses.',
    '',
    '## Red Flags',
    '',
    'Warnings.',
    '',
    '## Verification',
    '',
    'Proof.',
    extra,
    '',
  ].join('\n')
}

/**
 * check-docs.mjs resolves its repository root from its own location and has no
 * exported entry point, so it is exercised as the CI gate runs it: copied into
 * a throwaway tree and executed as a subprocess.
 */
function makeRepo(): string {
  const root = mkdtempSync(join(tmpdir(), 'check-docs-'))
  temporaryRoots.push(root)
  mkdirSync(join(root, 'scripts'), { recursive: true })
  copyFileSync(checkDocs, join(root, 'scripts', 'check-docs.mjs'))
  write(root, 'AGENTS.md', '# Agents\n')
  write(root, 'docs/README.md', '# Docs\n')
  write(root, 'docs/SKILL.md', '# Router\n\nSee [demo](skills/demo/SKILL.md).\n')
  write(root, 'docs/skills/INDEX.md', '# Index\n')
  write(root, 'docs/skills/demo/SKILL.md', skillBody())
  return root
}

function run(root: string): RunResult {
  try {
    const stdout = execFileSync(process.execPath, [join(root, 'scripts', 'check-docs.mjs')], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    return { status: 0, stdout, stderr: '' }
  }
  catch (error) {
    const failure = error as { status?: number, stdout?: string, stderr?: string }
    return {
      status: failure.status ?? 1,
      stdout: failure.stdout ?? '',
      stderr: failure.stderr ?? '',
    }
  }
}

afterEach(() => {
  while (temporaryRoots.length) {
    rmSync(temporaryRoots.pop()!, { recursive: true, force: true })
  }
})

describe('check-docs gate: happy path', () => {
  it('accepts a compliant tree and reports what it checked', () => {
    const result = run(makeRepo())
    expect(result.status).toBe(0)
    expect(result.stderr).toBe('')
    expect(result.stdout).toMatch(/^checked \d+ Markdown files and 1 skills\n$/)
  })

  it('counts every Markdown file it walked, not only skills', () => {
    const root = makeRepo()
    write(root, 'docs/extra.md', '# Extra\n')
    const result = run(root)
    expect(result.status).toBe(0)
    expect(result.stdout).toContain('checked 6 Markdown files and 1 skills')
  })

  it('ignores node_modules, dist and .git while walking', () => {
    const root = makeRepo()
    write(root, 'node_modules/pkg/README.md', '[gone](./missing.md)\n')
    write(root, 'dist/report.md', '[gone](./missing.md)\n')
    write(root, '.git/notes.md', '[gone](./missing.md)\n')
    const result = run(root)
    expect(result.status).toBe(0)
    expect(result.stdout).toContain('checked 5 Markdown files')
  })
})

describe('check-docs gate: required and banned paths', () => {
  it('rejects a tree missing a required document', () => {
    const root = makeRepo()
    rmSync(join(root, 'docs/README.md'))
    const result = run(root)
    expect(result.status).toBe(1)
    expect(result.stderr).toContain('missing required file: docs/README.md')
  })

  it.each(['IMPROVEMENTS.md', 'CHANGELOG.md', 'CHANGES.md', 'SESSION.md', 'NOTES.md', 'PLAN.md', 'TODO.md'])(
    'rejects the banned agent changelog %s',
    (banned) => {
      const root = makeRepo()
      write(root, banned, '# Session notes\n')
      const result = run(root)
      expect(result.status).toBe(1)
      expect(result.stderr).toContain(`banned agent changelog or session file: ${banned}`)
    },
  )

  it.each(['docs/superpowers/plans', 'docs/superpowers/specs'])(
    'rejects the committed session directory %s',
    (directory) => {
      const root = makeRepo()
      write(root, `${directory}/plan.md`, '# Plan\n')
      const result = run(root)
      expect(result.status).toBe(1)
      expect(result.stderr).toContain(`banned committed session directory: ${directory}`)
    },
  )

  it('reports every failure in one run rather than stopping at the first', () => {
    const root = makeRepo()
    rmSync(join(root, 'docs/README.md'))
    write(root, 'TODO.md', '# Todo\n')
    const result = run(root)
    expect(result.status).toBe(1)
    expect(result.stderr).toContain('missing required file: docs/README.md')
    expect(result.stderr).toContain('banned agent changelog or session file: TODO.md')
  })
})

describe('check-docs gate: skill front matter', () => {
  it('rejects a skill with no front matter and skips its remaining checks', () => {
    const root = makeRepo()
    write(root, 'docs/skills/demo/SKILL.md', '# demo\n\nNo front matter here.\n')
    const result = run(root)
    expect(result.status).toBe(1)
    expect(result.stderr).toContain('docs/skills/demo/SKILL.md: missing YAML front matter')
    expect(result.stderr).not.toContain('missing ## Red Flags')
  })

  it('rejects a skill whose front matter has no description', () => {
    const root = makeRepo()
    write(
      root,
      'docs/skills/demo/SKILL.md',
      skillBody().replace('description: demo skill\n', ''),
    )
    const result = run(root)
    expect(result.status).toBe(1)
    expect(result.stderr).toContain('front matter needs name and description')
  })

  it('rejects a skill whose name does not match its directory', () => {
    const root = makeRepo()
    write(root, 'docs/skills/demo/SKILL.md', skillBody('other'))
    const result = run(root)
    expect(result.status).toBe(1)
    expect(result.stderr).toContain('name \'other\' does not match \'demo\'')
  })
})

describe('check-docs gate: skill contract', () => {
  it('rejects a skill that the router never links to', () => {
    const root = makeRepo()
    write(root, 'docs/SKILL.md', '# Router\n\nNothing routed.\n')
    const result = run(root)
    expect(result.status).toBe(1)
    expect(result.stderr).toContain('docs/skills/demo/SKILL.md: not routed from docs/SKILL.md')
  })

  it.each([
    '## When to Use',
    '## When NOT to Use',
    '## Core Process',
    '## Common Rationalizations',
    '## Red Flags',
  ])('rejects a skill missing the %s section', (section) => {
    const root = makeRepo()
    write(root, 'docs/skills/demo/SKILL.md', skillBody().replace(`${section}\n`, '## Something Else\n'))
    const result = run(root)
    expect(result.status).toBe(1)
    expect(result.stderr).toContain(`docs/skills/demo/SKILL.md: missing ${section} section`)
  })

  it('rejects a skill missing the Verification section', () => {
    const root = makeRepo()
    write(root, 'docs/skills/demo/SKILL.md', skillBody().replace('## Verification\n', '## Proof\n'))
    const result = run(root)
    expect(result.status).toBe(1)
    expect(result.stderr).toContain('docs/skills/demo/SKILL.md: missing Verification section')
  })

  it('rejects a skill longer than 500 lines', () => {
    const root = makeRepo()
    write(root, 'docs/skills/demo/SKILL.md', skillBody('demo', '\nfiller\n'.repeat(500)))
    const result = run(root)
    expect(result.status).toBe(1)
    expect(result.stderr).toContain('docs/skills/demo/SKILL.md: exceeds 500 lines')
  })

  it('accepts a skill of exactly 500 lines', () => {
    const root = makeRepo()
    const base = skillBody()
    const padding = 500 - base.split('\n').length
    write(root, 'docs/skills/demo/SKILL.md', base + '\n'.repeat(padding))
    const result = run(root)
    expect(result.status).toBe(0)
  })

  it('does not apply the skill contract to non-SKILL Markdown under docs/skills', () => {
    const root = makeRepo()
    write(root, 'docs/skills/demo/NOTES-ON-USE.md', '# Notes\n\nNo sections at all.\n')
    const result = run(root)
    expect(result.status).toBe(0)
  })
})

describe('check-docs gate: link checking', () => {
  it('rejects a broken relative link', () => {
    const root = makeRepo()
    write(root, 'docs/README.md', '# Docs\n\nSee [gone](./missing.md).\n')
    const result = run(root)
    expect(result.status).toBe(1)
    expect(result.stderr).toContain('docs/README.md: broken link ./missing.md')
  })

  it('resolves relative links against the linking file, not the repository root', () => {
    const root = makeRepo()
    write(root, 'docs/guide.md', '# Guide\n\nBack to [docs](./README.md).\n')
    const result = run(root)
    expect(result.status).toBe(0)
  })

  it.each(['https://example.com/x.md', 'http://example.com/x.md', 'mailto:hi@example.com', '#anchor'])(
    'skips the non-local link %s',
    (link) => {
      const root = makeRepo()
      write(root, 'docs/README.md', `# Docs\n\n[link](${link})\n`)
      const result = run(root)
      expect(result.status).toBe(0)
    },
  )

  it('strips the fragment before resolving a relative link', () => {
    const root = makeRepo()
    write(root, 'docs/README.md', '# Docs\n\n[index](./skills/INDEX.md#usage)\n')
    const result = run(root)
    expect(result.status).toBe(0)
  })

  it('reports a broken link whose target exists only as a fragment on a missing file', () => {
    const root = makeRepo()
    write(root, 'docs/README.md', '# Docs\n\n[missing](./nope.md#usage)\n')
    const result = run(root)
    expect(result.status).toBe(1)
    expect(result.stderr).toContain('broken link ./nope.md#usage')
  })
})
