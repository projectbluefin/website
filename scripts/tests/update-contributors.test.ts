import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { updateContributors } from '../update-contributors.js'

describe('update-contributors script', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('collects human contributors across non-fork repos, excludes bots and automation, and sorts alphabetically', async () => {
    const tempDir = mkdtempSync(join(tmpdir(), 'contributors-test-'))
    const targetFile = join(tempDir, 'contributors.json')

    const fetchMock = vi.fn(async (url: URL | string) => {
      const urlStr = String(url)
      if (urlStr.includes('/orgs/projectbluefin/repos')) {
        return new Response(JSON.stringify([
          { full_name: 'projectbluefin/repo-a', fork: false, private: false, archived: false },
          { full_name: 'projectbluefin/repo-fork', fork: true, private: false, archived: false },
          { full_name: 'projectbluefin/repo-archived', fork: false, private: false, archived: true },
        ]), { status: 200, headers: { 'Content-Type': 'application/json' } })
      }
      if (urlStr.includes('/repos/projectbluefin/repo-a/contributors')) {
        return new Response(JSON.stringify([
          { id: 2, login: 'bob', type: 'User', html_url: 'https://github.com/bob', avatar_url: 'https://avatars.githubusercontent.com/u/2' },
          { id: 99, login: 'actions-user', type: 'User', html_url: 'https://github.com/actions-user', avatar_url: 'https://avatars.githubusercontent.com/u/99' },
          { id: 98, login: 'renovate[bot]', type: 'Bot', html_url: 'https://github.com/renovate[bot]', avatar_url: 'https://avatars.githubusercontent.com/u/98' },
        ]), { status: 200, headers: { 'Content-Type': 'application/json' } })
      }
      if (urlStr.includes('/repos/projectbluefin/repo-archived/contributors')) {
        return new Response(JSON.stringify([
          { id: 1, login: 'Alice', type: 'User', html_url: 'https://github.com/Alice', avatar_url: 'https://avatars.githubusercontent.com/u/1' },
          { id: 2, login: 'bob', type: 'User', html_url: 'https://github.com/bob', avatar_url: 'https://avatars.githubusercontent.com/u/2' },
        ]), { status: 200, headers: { 'Content-Type': 'application/json' } })
      }
      return new Response('[]', { status: 200 })
    })

    vi.stubGlobal('fetch', fetchMock)

    try {
      await updateContributors(targetFile)
      const content = JSON.parse(readFileSync(targetFile, 'utf8'))
      expect(content).toEqual([
        { id: 1, login: 'Alice', html_url: 'https://github.com/Alice', avatar_url: 'https://avatars.githubusercontent.com/u/1' },
        { id: 2, login: 'bob', html_url: 'https://github.com/bob', avatar_url: 'https://avatars.githubusercontent.com/u/2' },
      ])
    }
    finally {
      rmSync(tempDir, { recursive: true, force: true })
    }
  })

  it('handles 204 No Content for empty repos as empty array', async () => {
    const tempDir = mkdtempSync(join(tmpdir(), 'contributors-test-'))
    const targetFile = join(tempDir, 'contributors.json')

    const fetchMock = vi.fn(async (url: URL | string) => {
      const urlStr = String(url)
      if (urlStr.includes('/orgs/projectbluefin/repos')) {
        return new Response(JSON.stringify([
          { full_name: 'projectbluefin/empty-repo', fork: false, private: false, archived: false },
          { full_name: 'projectbluefin/has-contributor', fork: false, private: false, archived: false },
        ]), { status: 200, headers: { 'Content-Type': 'application/json' } })
      }
      if (urlStr.includes('/repos/projectbluefin/empty-repo/contributors')) {
        return new Response(null, { status: 204 })
      }
      if (urlStr.includes('/repos/projectbluefin/has-contributor/contributors')) {
        return new Response(JSON.stringify([
          { id: 10, login: 'dev', type: 'User', html_url: 'https://github.com/dev', avatar_url: 'https://avatars.githubusercontent.com/u/10' },
        ]), { status: 200, headers: { 'Content-Type': 'application/json' } })
      }
      return new Response('[]', { status: 200 })
    })

    vi.stubGlobal('fetch', fetchMock)

    try {
      await updateContributors(targetFile)
      const content = JSON.parse(readFileSync(targetFile, 'utf8'))
      expect(content).toEqual([
        { id: 10, login: 'dev', html_url: 'https://github.com/dev', avatar_url: 'https://avatars.githubusercontent.com/u/10' },
      ])
    }
    finally {
      rmSync(tempDir, { recursive: true, force: true })
    }
  })

  it('refuses to overwrite when no human contributors are found', async () => {
    const tempDir = mkdtempSync(join(tmpdir(), 'contributors-test-'))
    const targetFile = join(tempDir, 'contributors.json')

    const fetchMock = vi.fn(async () => {
      return new Response(JSON.stringify([
        { full_name: 'projectbluefin/only-fork', fork: true, private: false, archived: false },
      ]), { status: 200, headers: { 'Content-Type': 'application/json' } })
    })

    vi.stubGlobal('fetch', fetchMock)

    try {
      await expect(updateContributors(targetFile)).rejects.toThrow(/No human contributors found/)
    }
    finally {
      rmSync(tempDir, { recursive: true, force: true })
    }
  })
})
