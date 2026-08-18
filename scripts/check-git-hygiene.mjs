#!/usr/bin/env node

/**
 * Fail closed when a local agent session leaves stale branches or worktrees.
 *
 * This is deliberately a checker, not a cleaner. Deleting a worktree is safe
 * only after its dirty state, unique commits, and PR state have been reviewed.
 */
import assert from 'node:assert/strict'
import { execFileSync, spawnSync } from 'node:child_process'
import { realpathSync } from 'node:fs'

const BASE_REF = process.env.GIT_HYGIENE_BASE ?? 'upstream/main'

function run(command, args, options = {}) {
  return execFileSync(command, args, {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    ...options,
  }).trim()
}

function git(args, cwd = process.cwd()) {
  return run('git', ['-C', cwd, ...args])
}

export function classifyWorktree({ branch, dirty, ahead, prState, prNumber, prUrl, detached, isBase }) {
  if (prState === 'MERGED' || prState === 'CLOSED') {
    return {
      ok: false,
      reason: `PR #${prNumber} is ${prState.toLowerCase()} (${prUrl}); move any new edits to a fresh branch, then remove this worktree and branch`,
    }
  }
  if (prState === 'OPEN') {
    return { ok: true, reason: `active PR #${prNumber} (${prUrl})` }
  }
  if (detached) {
    return dirty
      ? { ok: true, reason: 'dirty detached worktree (preserved, but attach a branch before handoff)' }
      : { ok: false, reason: 'clean detached worktree with no open PR' }
  }
  if (isBase) {
    return dirty
      ? { ok: true, reason: 'base branch has local edits' }
      : { ok: true, reason: 'base branch' }
  }
  if (dirty) {
    return { ok: true, reason: 'dirty work in progress on a fresh branch' }
  }
  if (ahead === 0) {
    return { ok: false, reason: `clean branch ${branch} has no commits beyond ${BASE_REF} and no open PR` }
  }
  return {
    ok: false,
    reason: `clean branch ${branch} is ${ahead} commit(s) ahead of ${BASE_REF} but has no open PR`,
  }
}

function parseWorktrees(text) {
  return text.split(/\n{2,}/).filter(Boolean).map((record) => {
    const fields = new Map()
    for (const line of record.split('\n')) {
      const space = line.indexOf(' ')
      fields.set(space === -1 ? line : line.slice(0, space), space === -1 ? true : line.slice(space + 1))
    }
    return {
      path: fields.get('worktree'),
      branch: typeof fields.get('branch') === 'string'
        ? fields.get('branch').replace('refs/heads/', '')
        : null,
      detached: fields.has('detached'),
      prunable: fields.has('prunable'),
    }
  })
}

function repositorySlug(cwd) {
  const url = git(['remote', 'get-url', 'upstream'], cwd)
  const match = url.match(/github\.com(?::|\/)([^/]+\/[^/]+?)(?:\.git)?$/)
  if (!match) {
    throw new Error(`cannot derive GitHub repository from upstream URL: ${url}`)
  }
  return match[1]
}

function prForBranch(slug, branch, cwd) {
  if (!branch) {
    return null
  }
  const result = spawnSync('gh', [
    'pr',
    'list',
    '--repo',
    slug,
    '--head',
    branch,
    '--state',
    'all',
    '--limit',
    '1',
    '--json',
    'number,state,url,mergedAt,closedAt',
  ], { cwd, encoding: 'utf8' })
  if (result.error?.code === 'ENOENT') {
    throw new Error('gh is required to distinguish active branches from squash-merged PRs')
  }
  if (result.status !== 0) {
    throw new Error(`gh PR lookup failed for ${branch}: ${result.stderr.trim()}`)
  }
  return JSON.parse(result.stdout)[0] ?? null
}

function selfTest() {
  const base = { branch: 'feat/x', dirty: false, ahead: 1, prState: null, prNumber: null, prUrl: null, detached: false, isBase: false }
  assert.equal(classifyWorktree({ ...base, prState: 'OPEN', prNumber: 1 }).ok, true)
  assert.equal(classifyWorktree({ ...base, dirty: true, ahead: 0 }).ok, true)
  assert.equal(classifyWorktree({ ...base, ahead: 0 }).ok, false)
  assert.equal(classifyWorktree(base).ok, false)
  assert.equal(classifyWorktree({ ...base, prState: 'MERGED', prNumber: 1 }).ok, false)
  assert.equal(classifyWorktree({ ...base, detached: true, ahead: 0 }).ok, false)
  assert.equal(classifyWorktree({ ...base, branch: 'main', ahead: 0, isBase: true }).ok, true)
  console.info('git-hygiene self-test: pass')
}

function main() {
  if (process.argv.includes('--self-test')) {
    selfTest()
    return
  }

  const cwd = realpathSync(process.cwd())
  git(['rev-parse', '--verify', BASE_REF], cwd)
  const slug = repositorySlug(cwd)
  const worktrees = parseWorktrees(git(['worktree', 'list', '--porcelain'], cwd))
  const failures = []
  const active = []

  const prune = git(['worktree', 'prune', '--dry-run', '--verbose'], cwd)
  if (prune) {
    failures.push(`stale worktree metadata:\n${prune}`)
  }

  for (const worktree of worktrees) {
    if (worktree.prunable) {
      failures.push(`${worktree.path}: marked prunable by git`)
      continue
    }
    const dirty = git(['status', '--porcelain'], worktree.path).length > 0
    const ahead = worktree.branch
      ? Number(git(['rev-list', '--count', `${BASE_REF}..${worktree.branch}`], cwd))
      : 0
    const pr = prForBranch(slug, worktree.branch, cwd)
    const result = classifyWorktree({
      branch: worktree.branch,
      dirty,
      ahead,
      prState: pr?.state ?? null,
      prNumber: pr?.number ?? null,
      prUrl: pr?.url ?? null,
      detached: worktree.detached,
      isBase: worktree.branch === 'main',
    })
    const label = `${worktree.path} [${worktree.branch ?? 'detached'}]`
    ;(result.ok ? active : failures).push(`${label}: ${result.reason}`)
  }

  console.info('Git hygiene: active work')
  for (const item of active) {
    console.info(`  ✓ ${item}`)
  }
  if (failures.length) {
    console.error('\nGit hygiene: FAIL')
    for (const failure of failures) {
      console.error(`  ✗ ${failure}`)
    }
    console.error('\nResolve each item, run `git worktree prune`, then rerun this check.')
    process.exitCode = 1
    return
  }
  console.info('\nGit hygiene: pass')
}

main()
