#!/usr/bin/env node

import { rename, rm, writeFile } from 'node:fs/promises'
import { fileURLToPath, pathToFileURL } from 'node:url'

const TARGET_PATH = fileURLToPath(new URL('../public/contributors.json', import.meta.url))
const LOGIN_PATTERN = /^[a-z\d][a-z\d-]{0,38}$/i
const AUTOMATION_LOGINS = new Set([
  'actions-user',
  'claude',
  'copilot',
  'imgbotapp',
  'renovate-bot',
  'web-flow',
])

async function fetchPages(path, allowEmpty = false) {
  const records = []
  for (let page = 1; ; page++) {
    const url = new URL(`https://api.github.com${path}`)
    url.searchParams.set('per_page', '100')
    url.searchParams.set('page', String(page))
    const headers = { Accept: 'application/vnd.github+json' }
    if (process.env.GH_TOKEN) {
      headers.Authorization = `Bearer ${process.env.GH_TOKEN}`
    }
    const response = await fetch(url, { headers, signal: AbortSignal.timeout(30000) })
    if (response.status === 204 && allowEmpty) {
      return records
    }
    if (!response.ok) {
      throw new Error(`GitHub request failed: ${url.pathname} page ${page} (HTTP ${response.status})`)
    }
    let data
    try {
      data = await response.json()
    }
    catch {
      throw new Error(`Malformed GitHub JSON: ${url.pathname} page ${page}`)
    }
    if (!Array.isArray(data)) {
      throw new TypeError(`Expected a GitHub array: ${url.pathname} page ${page}`)
    }
    records.push(...data)
    if (data.length < 100) {
      return records
    }
  }
}

function validateContributor(record, repository) {
  const { id, login, html_url, avatar_url } = record
  if (!Number.isSafeInteger(id) || id <= 0 || typeof login !== 'string' || !LOGIN_PATTERN.test(login)) {
    throw new Error(`Invalid human contributor identity in ${repository}`)
  }
  let profile
  let avatar
  try {
    profile = new URL(html_url)
    avatar = new URL(avatar_url)
  }
  catch {
    throw new Error(`Invalid contributor URLs for ${login} in ${repository}`)
  }
  if (
    typeof html_url !== 'string' || typeof avatar_url !== 'string'
    || profile.protocol !== 'https:' || profile.hostname !== 'github.com'
    || profile.port || profile.username || profile.password || profile.search || profile.hash
    || profile.pathname.toLowerCase() !== `/${login.toLowerCase()}`
    || avatar.protocol !== 'https:' || avatar.hostname !== 'avatars.githubusercontent.com'
    || avatar.port || avatar.username || avatar.password || avatar.hash
    || avatar.pathname !== `/u/${id}`
  ) {
    throw new Error(`Invalid contributor URLs for ${login} in ${repository}`)
  }
  return { id, login, html_url, avatar_url }
}

export async function updateContributors() {
  const repositories = await fetchPages('/orgs/projectbluefin/repos?type=public')
  for (const repository of repositories) {
    if (
      !repository || typeof repository.fork !== 'boolean' || repository.private !== false
      || typeof repository.archived !== 'boolean' || typeof repository.full_name !== 'string'
      || !/^projectbluefin\/[\w.-]+$/i.test(repository.full_name)
    ) {
      throw new Error('Malformed public projectbluefin repository record')
    }
  }
  const included = repositories.filter(repository => !repository.fork)
    .sort((a, b) => a.full_name.toLowerCase().localeCompare(b.full_name.toLowerCase(), 'en'))
  const people = new Map()
  for (const repository of included) {
    const contributors = await fetchPages(`/repos/${repository.full_name}/contributors`, true)
    for (const contributor of contributors) {
      if (!contributor || typeof contributor.type !== 'string') {
        throw new Error(`Malformed contributor record in ${repository.full_name}`)
      }
      if (contributor.type !== 'User') {
        continue
      }
      if (
        typeof contributor.login === 'string'
        && (AUTOMATION_LOGINS.has(contributor.login.toLowerCase()) || /\[bot\]$/i.test(contributor.login))
      ) {
        continue
      }
      const person = validateContributor(contributor, repository.full_name)
      people.set(person.id, person)
    }
  }
  if (people.size === 0) {
    throw new Error('No human contributors found; refusing to replace existing data')
  }
  const contributors = [...people.values()].sort((a, b) =>
    a.login.toLowerCase().localeCompare(b.login.toLowerCase(), 'en') || a.id - b.id,
  )
  const temporaryPath = `${TARGET_PATH}.${process.pid}.tmp`
  try {
    await writeFile(temporaryPath, `${JSON.stringify(contributors, null, 2)}\n`, { flag: 'wx' })
    await rename(temporaryPath, TARGET_PATH)
  }
  finally {
    await rm(temporaryPath, { force: true })
  }
  const archived = included.filter(repository => repository.archived).length
  console.info(`[contributors] Saved ${contributors.length} people from ${included.length} public non-fork repositories (${archived} archived; ${repositories.length} public repositories discovered).`)
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  updateContributors().catch((error) => {
    console.error('[contributors] fatal:', error.message)
    process.exitCode = 1
  })
}
