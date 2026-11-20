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

/** Run git, returning null instead of throwing when the command fails. */
function tryGit(args, cwd = process.cwd()) {
  try {
    return git(args, cwd)
  }
  catch {
    return null
  }
}

/**
 * Abort with an actionable message rather than an unhandled exception.
 *
 * The checker shells out to git before it can validate its own preconditions,
 * so a checkout without the production remote used to die with a raw Node
 * stack trace over `fatal: Needed a single revision`.
 *
 * @param {string} message
 */
function abort(message) {
  console.error(`Git hygiene: cannot run\n  ${message}`)
  process.exit(2)
}

/** The remote half of `BASE_REF`, or null when the base ref is a local branch. */
function baseRemote(baseRef) {
  const [remote, ...rest] = baseRef.split('/')
  return rest.length > 0
    ? remote
    : null
}

export function classifyWorktree({ branch, dirty, ahead, prState, prNumber, prUrl, detached, isBase }) {
  // A fork PR can have a head branch named `main`; the local base branch wins
  // before any PR-state classification.
  if (isBase) {
    return dirty
      ? { ok: true, reason: 'base branch has local edits' }
      : { ok: true, reason: 'base branch' }
  }
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
      fields.set(space === -1
        ? line
        : line.slice(0, space), space === -1
        ? true
        : line.slice(space + 1))
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

function repositorySlug(cwd, remote = 'upstream') {
  const url = tryGit(['remote', 'get-url', remote], cwd)
  if (url == null) {
    const remotes = tryGit(['remote'], cwd) || '(none)'
    abort([
      `no git remote named "${remote}" in ${cwd}.`,
      `This repository's production remote is "upstream"; add it with`,
      `\`git remote add upstream https://github.com/projectbluefin/website\`,`,
      `or point GIT_HYGIENE_BASE at a base ref on a remote you do have.`,
      `Remotes present: ${remotes.split('\n').filter(Boolean).join(', ') || '(none)'}`,
    ].join(' '))
  }
  const match = url.match(/github\.com(?::|\/)([^/]+\/[^/]+?)(?:\.git)?$/)
  if (!match) {
    throw new Error(`cannot derive GitHub repository from upstream URL: ${url}`)
  }
  return match[1]
}

function pullRequestsByBranch(slug, cwd) {
  const upstreamOwner = slug.split('/')[0]
  const result = spawnSync('gh', [
    'pr',
    'list',
    '--repo',
    slug,
    '--state',
    'all',
    '--limit',
    '1000',
    '--json',
    'number,state,url,mergedAt,closedAt,headRefName,headRepositoryOwner,updatedAt',
  ], { cwd, encoding: 'utf8' })
  if (result.error?.code === 'ENOENT') {
    throw new Error('gh is required to distinguish active branches from squash-merged PRs')
  }
  if (result.status !== 0) {
    throw new Error(`gh PR lookup failed: ${result.stderr.trim()}`)
  }

  // `gh pr list` returns the newest records first. If a branch name was ever
  // reused, classify it by its most recent PR — though reusing a completed PR
  // branch is itself forbidden by AGENTS.md.
  const byBranch = new Map()
  for (const pr of JSON.parse(result.stdout)) {
    if (pr.headRepositoryOwner?.login === upstreamOwner && !byBranch.has(pr.headRefName)) {
      byBranch.set(pr.headRefName, pr)
    }
  }
  return byBranch
}

function selfTest() {
  const base = {
    branch: 'feat/x',
    dirty: false,
    ahead: 1,
    prState: null,
    prNumber: null,
    prUrl: null,
    detached: false,
    isBase: false
  }
  assert.equal(classifyWorktree({ ...base, prState: 'OPEN', prNumber: 1 }).ok, true)
  assert.equal(classifyWorktree({ ...base, dirty: true, ahead: 0 }).ok, true)
  assert.equal(classifyWorktree({ ...base, ahead: 0 }).ok, false)
  assert.equal(classifyWorktree(base).ok, false)
  assert.equal(classifyWorktree({ ...base, prState: 'MERGED', prNumber: 1 }).ok, false)
  assert.equal(classifyWorktree({ ...base, detached: true, ahead: 0 }).ok, false)
  assert.equal(classifyWorktree({
    ...base,
    branch: 'main',
    ahead: 0,
    isBase: true
  }).ok, true)
  console.info('git-hygiene self-test: pass')
}

function main() {
  if (process.argv.includes('--self-test')) {
    selfTest()
    return
  }

  const cwd = realpathSync(process.cwd())
  if (tryGit(['rev-parse', '--git-dir'], cwd) == null) {
    abort(`${cwd} is not a git repository.`)
  }
  if (tryGit(['rev-parse', '--verify', BASE_REF], cwd) == null) {
    const remote = baseRemote(BASE_REF)
    abort([
      `base ref "${BASE_REF}" does not exist in ${cwd}.`,
      remote
        ? `Fetch it with \`git fetch ${remote} ${BASE_REF.slice(remote.length + 1)}\`,`
        : `Create or check out that branch,`,
      `or set GIT_HYGIENE_BASE to the ref this checkout compares against`,
      `(for example \`GIT_HYGIENE_BASE=origin/main\`).`,
    ].join(' '))
  }
  const slug = repositorySlug(cwd, baseRemote(BASE_REF) ?? 'upstream')
  const worktrees = parseWorktrees(git(['worktree', 'list', '--porcelain'], cwd))
  const prsByBranch = pullRequestsByBranch(slug, cwd)
  const failures = []
  const active = []

  const prune = git([
    'worktree',
    'prune',
    '--dry-run',
    '--verbose'
  ], cwd)
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
    const pr = prsByBranch.get(worktree.branch)
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

  // A branch does not stop being stale merely because it is no longer mounted
  // in a worktree. Check every local branch, not only `git worktree list`.
  const mounted = new Set(worktrees.map(worktree => worktree.branch).filter(Boolean))
  const localBranches = git(['for-each-ref', '--format=%(refname:short)', 'refs/heads'], cwd).split('\n').filter(Boolean)
  for (const branch of localBranches) {
    if (mounted.has(branch)) {
      continue
    }
    const ahead = Number(git(['rev-list', '--count', `${BASE_REF}..${branch}`], cwd))
    const pr = prsByBranch.get(branch)
    const result = classifyWorktree({
      branch,
      dirty: false,
      ahead,
      prState: pr?.state ?? null,
      prNumber: pr?.number ?? null,
      prUrl: pr?.url ?? null,
      detached: false,
      isBase: branch === 'main',
    })
    ;(result.ok ? active : failures).push(`local branch [${branch}]: ${result.reason}`)
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
