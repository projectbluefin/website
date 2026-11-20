import { execFileSync, spawnSync } from 'node:child_process'
import { chmodSync, mkdirSync, mkdtempSync, realpathSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'

const script = resolve(process.cwd(), 'scripts/check-git-hygiene.mjs')

const gitEnv = {
  ...process.env,
  GIT_CONFIG_GLOBAL: '/dev/null',
  GIT_CONFIG_SYSTEM: '/dev/null',
  GIT_AUTHOR_NAME: 'Hygiene Fixture',
  GIT_AUTHOR_EMAIL: 'hygiene@example.invalid',
  GIT_COMMITTER_NAME: 'Hygiene Fixture',
  GIT_COMMITTER_EMAIL: 'hygiene@example.invalid',
}

const temporaryRoots: string[] = []

afterEach(() => {
  while (temporaryRoots.length) {
    rmSync(temporaryRoots.pop()!, { force: true, recursive: true })
  }
})

function git(cwd: string, ...args: string[]) {
  return execFileSync('git', ['-C', cwd, ...args], { encoding: 'utf8', env: gitEnv }).trim()
}

function commit(cwd: string, message: string) {
  writeFileSync(join(cwd, `${message.replace(/\W+/g, '-')}.txt`), `${message}\n`)
  git(cwd, 'add', '-A')
  git(cwd, 'commit', '-m', message)
}

/**
 * A repository shaped like a contributor checkout: `main` tracked through an
 * `upstream` remote whose URL is a GitHub slug, because the checker derives the
 * repository from that remote and compares every branch against `upstream/main`.
 */
function createRepository(remoteUrl = 'https://github.com/projectbluefin/website.git') {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'git-hygiene-')))
  temporaryRoots.push(root)
  const repository = join(root, 'repo')
  mkdirSync(repository)

  git(repository, 'init', '--initial-branch=main', '--quiet')
  commit(repository, 'initial')
  git(repository, 'remote', 'add', 'upstream', remoteUrl)

  return { root, repository }
}

/** A `gh` stub on PATH: the checker shells out to it and parses its stdout. */
function stubGh(root: string, { stdout = '[]', status = 0, stderr = '' } = {}) {
  const bin = join(root, 'bin')
  mkdirSync(bin, { recursive: true })
  const path = join(bin, 'gh')
  writeFileSync(path, [
    '#!/bin/sh',
    `cat <<'GH_STUB_EOF'`,
    stdout,
    'GH_STUB_EOF',
    stderr
      ? `printf '%s\\n' ${JSON.stringify(stderr)} >&2`
      : '',
    `exit ${status}`,
    '',
  ].join('\n'))
  chmodSync(path, 0o755)
  return bin
}

function runChecker(repository: string, { bin, args = [] as string[] } = {} as { bin?: string, args?: string[] }) {
  const result = spawnSync(process.execPath, [script, ...args], {
    cwd: repository,
    encoding: 'utf8',
    env: {
      ...gitEnv,
      // `main` is both the base ref and the branch the checker treats as the
      // base branch, so the fixture needs no second remote-tracking ref.
      GIT_HYGIENE_BASE: 'main',
      PATH: bin
        ? `${bin}:${process.env.PATH}`
        : process.env.PATH,
    },
  })
  return { ...result, output: `${result.stdout}${result.stderr}` }
}

function pullRequest(overrides: Record<string, unknown> = {}) {
  return {
    number: 7,
    state: 'OPEN',
    url: 'https://github.com/projectbluefin/website/pull/7',
    mergedAt: null,
    closedAt: null,
    headRefName: 'feat/x',
    headRepositoryOwner: { login: 'projectbluefin' },
    updatedAt: '2026-01-01T00:00:00Z',
    ...overrides,
  }
}

describe('check-git-hygiene --self-test', () => {
  it('passes without touching git or gh', () => {
    const { repository } = createRepository()
    const result = runChecker(repository, {
      args: ['--self-test']
    })

    expect(result.status).toBe(0)
    expect(result.output).toContain('git-hygiene self-test: pass')
  })
})

describe('check-git-hygiene', () => {
  it('passes on a checkout holding only the base branch', () => {
    const { root, repository } = createRepository()
    const result = runChecker(repository, {
      bin: stubGh(root)
    })

    expect(result.output).toContain('Git hygiene: pass')
    expect(result.status).toBe(0)
  })

  it('reports local edits on the base branch as active work, not a failure', () => {
    const { root, repository } = createRepository()
    writeFileSync(join(repository, 'dirty.txt'), 'uncommitted\n')
    const result = runChecker(repository, {
      bin: stubGh(root)
    })

    expect(result.output).toContain('base branch has local edits')
    expect(result.status).toBe(0)
  })

  it('fails an unmounted clean branch that is ahead of the base with no PR', () => {
    const { root, repository } = createRepository()
    git(repository, 'checkout', '--quiet', '-b', 'feat/x')
    commit(repository, 'work')
    git(repository, 'checkout', '--quiet', 'main')
    const result = runChecker(repository, {
      bin: stubGh(root)
    })

    expect(result.output).toContain('local branch [feat/x]')
    expect(result.output).toContain('is 1 commit(s) ahead of main but has no open PR')
    expect(result.status).toBe(1)
  })

  it('fails an unmounted clean branch with no commits and no PR', () => {
    const { root, repository } = createRepository()
    git(repository, 'branch', 'feat/x')
    const result = runChecker(repository, {
      bin: stubGh(root)
    })

    expect(result.output).toContain('has no commits beyond main and no open PR')
    expect(result.status).toBe(1)
  })

  it('accepts a branch that still has an open PR', () => {
    const { root, repository } = createRepository()
    git(repository, 'checkout', '--quiet', '-b', 'feat/x')
    commit(repository, 'work')
    git(repository, 'checkout', '--quiet', 'main')
    const bin = stubGh(root, {
      stdout: JSON.stringify([
        pullRequest()
      ])
    })
    const result = runChecker(repository, { bin })

    expect(result.output).toContain('active PR #7 (https://github.com/projectbluefin/website/pull/7)')
    expect(result.status).toBe(0)
  })

  it.each(['MERGED', 'CLOSED'])('fails a branch whose PR is %s', (state) => {
    const { root, repository } = createRepository()
    git(repository, 'checkout', '--quiet', '-b', 'feat/x')
    commit(repository, 'work')
    git(repository, 'checkout', '--quiet', 'main')
    const bin = stubGh(root, {
      stdout: JSON.stringify([
        pullRequest({ state })
      ])
    })
    const result = runChecker(repository, { bin })

    expect(result.output).toContain(`PR #7 is ${state.toLowerCase()}`)
    expect(result.output).toContain('move any new edits to a fresh branch')
    expect(result.status).toBe(1)
  })

  it('ignores a PR opened from a fork that reuses a local branch name', () => {
    const { root, repository } = createRepository()
    git(repository, 'checkout', '--quiet', '-b', 'feat/x')
    commit(repository, 'work')
    git(repository, 'checkout', '--quiet', 'main')
    const bin = stubGh(root, {
      stdout: JSON.stringify([
        pullRequest({
          headRepositoryOwner: { login: 'a-fork-owner' }
        })
      ]),
    })
    const result = runChecker(repository, { bin })

    expect(result.output).not.toContain('active PR #7')
    expect(result.output).toContain('but has no open PR')
    expect(result.status).toBe(1)
  })

  it('classifies a branch by its most recent PR when a name was reused', () => {
    const { root, repository } = createRepository()
    git(repository, 'checkout', '--quiet', '-b', 'feat/x')
    commit(repository, 'work')
    git(repository, 'checkout', '--quiet', 'main')
    const bin = stubGh(root, {
      stdout: JSON.stringify([
        pullRequest({ number: 9, state: 'MERGED' }),
        pullRequest({ number: 7, state: 'OPEN' }),
      ]),
    })
    const result = runChecker(repository, { bin })

    expect(result.output).toContain('PR #9 is merged')
    expect(result.output).not.toContain('active PR #7')
    expect(result.status).toBe(1)
  })

  it('keeps a dirty worktree on a fresh branch but fails a clean detached one', () => {
    const { root, repository } = createRepository()
    const dirty = join(root, 'dirty-worktree')
    const detached = join(root, 'detached-worktree')
    git(repository, 'worktree', 'add', '--quiet', '-b', 'feat/dirty', dirty)
    writeFileSync(join(dirty, 'wip.txt'), 'in progress\n')
    git(repository, 'worktree', 'add', '--quiet', '--detach', detached)
    const result = runChecker(repository, {
      bin: stubGh(root)
    })

    expect(result.output).toContain('dirty work in progress on a fresh branch')
    expect(result.output).toContain('clean detached worktree with no open PR')
    expect(result.status).toBe(1)
  })

  it('fails when a worktree directory was deleted without pruning its metadata', () => {
    const { root, repository } = createRepository()
    const abandoned = join(root, 'abandoned-worktree')
    git(repository, 'worktree', 'add', '--quiet', '-b', 'feat/abandoned', abandoned)
    rmSync(abandoned, { force: true, recursive: true })
    const result = runChecker(repository, {
      bin: stubGh(root)
    })

    expect(result.output).toContain(`${abandoned}: marked prunable by git`)
    // The prunable record still claims the branch, so the local-branch sweep
    // treats it as mounted and never classifies it a second time. Pinned here
    // so the single prunable failure stays the only report for this branch.
    expect(result.output).not.toContain('local branch [feat/abandoned]')
    expect(result.status).toBe(1)
  })

  it('refuses to guess when gh is not installed', () => {
    const { root, repository } = createRepository()
    // git must stay reachable; only gh is removed from PATH.
    const emptyBin = join(root, 'git-only-bin')
    mkdirSync(emptyBin, { recursive: true })
    symlinkSync(execFileSync('sh', ['-c', 'command -v git'], { encoding: 'utf8' }).trim(), join(emptyBin, 'git'))
    const result = spawnSync(process.execPath, [script], {
      cwd: repository,
      encoding: 'utf8',
      env: { ...gitEnv, GIT_HYGIENE_BASE: 'main', PATH: emptyBin },
    })

    expect(`${result.stderr}`).toContain('gh is required to distinguish active branches from squash-merged PRs')
    expect(result.status).not.toBe(0)
  })

  it('surfaces a failing gh lookup instead of reporting a clean tree', () => {
    const { root, repository } = createRepository()
    const bin = stubGh(root, { status: 1, stderr: 'HTTP 502' })
    const result = runChecker(repository, { bin })

    expect(result.output).toContain('gh PR lookup failed')
    expect(result.output).toContain('HTTP 502')
    expect(result.output).not.toContain('Git hygiene: pass')
    expect(result.status).not.toBe(0)
  })

  it('rejects an upstream remote that is not a GitHub repository', () => {
    const { root, repository } = createRepository('https://git.example.invalid/projectbluefin/website.git')
    const result = runChecker(repository, {
      bin: stubGh(root)
    })

    expect(result.output).toContain('cannot derive GitHub repository from upstream URL')
    expect(result.status).not.toBe(0)
  })

  it.each([
    ['git@github.com:projectbluefin/website.git'],
    ['https://github.com/projectbluefin/website'],
  ])('derives the repository slug from upstream URL %s', (url) => {
    const { root, repository } = createRepository(url)
    const result = runChecker(repository, {
      bin: stubGh(root)
    })

    expect(result.output).not.toContain('cannot derive GitHub repository')
    expect(result.status).toBe(0)
  })

  it('fails when the configured base ref does not exist', () => {
    const { root, repository } = createRepository()
    const result = spawnSync(process.execPath, [script], {
      cwd: repository,
      encoding: 'utf8',
      env: { ...gitEnv, GIT_HYGIENE_BASE: 'upstream/main', PATH: `${stubGh(root)}:${process.env.PATH}` },
    })

    expect(result.status).toBe(2)
    expect(`${result.stdout}`).not.toContain('Git hygiene: pass')
    // An unhandled `fatal: Needed a single revision` stack trace does not tell
    // a contributor which ref is missing or how to supply it.
    expect(`${result.stderr}`).toContain('base ref "upstream/main" does not exist')
    expect(`${result.stderr}`).toContain('git fetch upstream main')
    expect(`${result.stderr}`).toContain('GIT_HYGIENE_BASE')
    expect(`${result.stderr}`).not.toContain('Needed a single revision')
  })

  it('names the missing remote when the base ref remote is not configured', () => {
    const { root, repository } = createRepository()
    git(repository, 'remote', 'remove', 'upstream')
    const result = runChecker(repository, {
      bin: stubGh(root)
    })

    expect(result.status).toBe(2)
    expect(result.output).toContain('no git remote named "upstream"')
    expect(result.output).toContain('Remotes present: (none)')
  })

  it('derives the repository from the remote named by the base ref', () => {
    const { root, repository } = createRepository()
    git(repository, 'remote', 'rename', 'upstream', 'origin')
    // Create the remote-tracking ref directly; fetching would need the network.
    git(repository, 'update-ref', 'refs/remotes/origin/main', 'HEAD')
    const result = spawnSync(process.execPath, [script], {
      cwd: repository,
      encoding: 'utf8',
      env: { ...gitEnv, GIT_HYGIENE_BASE: 'origin/main', PATH: `${stubGh(root)}:${process.env.PATH}` },
    })

    expect(`${result.stdout}${result.stderr}`).toContain('Git hygiene: pass')
    expect(result.status).toBe(0)
  })
})
