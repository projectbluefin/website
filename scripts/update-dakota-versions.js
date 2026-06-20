#!/usr/bin/env node

/**
 * Script to update dakota-versions.json with SBOM-driven package versions.
 *
 * Sources of truth (in priority order):
 * 1. docs.projectbluefin.io/data/sbom-attestations.json  — kernel, gnome, mesa,
 *    bootc, systemd, podman, pipewire, flatpak from the live SBOM pipeline.
 *    Uses dakota-stable stream.
 * 2. projectbluefin/dakota raw freedesktop-sdk.bst       — freedesktop-sdk version
 *    (parsed from the `ref:` tag; not in SBOM because it's a build junction)
 * 3. Existing values in dakota-versions.json             — fallback / manual fields
 *    (nvidia — not in SBOM; baseline — fixed string)
 *
 * IMPORTANT: freedesktop-sdk must be read from projectbluefin/dakota upstream
 * main, NOT from any local fork or feature branch.
 */

import { Buffer } from 'node:buffer'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const OUT = path.join(__dirname, '../public/dakota-versions.json')
const GITHUB_API = 'https://api.github.com'
const SBOM_URL = 'https://docs.projectbluefin.io/data/sbom-attestations.json'
const FDSDK_BST_URL
  = `${GITHUB_API}/repos/projectbluefin/dakota/contents/elements/freedesktop-sdk.bst`

export function applySbomVersions(current, sbom, generatedAt = new Date().toISOString()) {
  const next = structuredClone(current)
  const stream = sbom?.streams?.['dakota-stable']
  const releases = stream?.releases ?? {}
  const latest = Object.values(releases)[0]

  if (!latest) {
    return next
  }

  const pv = latest.packageVersions ?? {}
  const all = pv.allPackages ?? {}
  const assign = (key, val) => {
    if (val) {
      next.packages[key] = val
    }
  }

  assign('kernel', pv.kernel)
  assign('gnome', pv.gnome)
  assign('mesa', pv.mesa)
  assign('systemd', pv.systemd)
  assign('podman', pv.podman)
  assign('pipewire', pv.pipewire)
  assign('flatpak', pv.flatpak)
  assign('bootc', all.bootc)

  const nvStream = sbom?.streams?.['dakota-nvidia-stable']
  const nvReleases = nvStream?.releases ?? {}
  const nvLatest = Object.values(nvReleases)[0]
  assign('nvidia', nvLatest?.packageVersions?.nvidia)

  next.generatedAt = generatedAt
  return next
}

export function decodeGitHubContent(content, encoding) {
  return encoding === 'base64' ? Buffer.from(content, 'base64').toString() : content
}

export function extractFreedesktopSdkVersion(raw) {
  return raw.match(/ref:\s*freedesktop-sdk-([\d.]+)/)?.[1] ?? null
}

function isMainModule() {
  return process.argv[1] != null && import.meta.url === pathToFileURL(process.argv[1]).href
}

async function main() {
  const headers = {
    'User-Agent': 'bluefin-website-updater',
    ...(process.env.GITHUB_TOKEN ? { Authorization: `token ${process.env.GITHUB_TOKEN}` } : {}),
  }

  let current = JSON.parse(fs.readFileSync(OUT, 'utf8'))

  try {
    const sbomRes = await fetch(SBOM_URL)
    if (sbomRes.ok) {
      current = applySbomVersions(current, await sbomRes.json())
      console.info('[dakota-versions] SBOM versions updated')
      if (current.packages.nvidia) {
        console.info(`[dakota-versions] nvidia → ${current.packages.nvidia}`)
      }
    }
    else {
      console.warn(`[dakota-versions] SBOM fetch returned ${sbomRes.status}`)
    }
  }
  catch (e) {
    console.warn('[dakota-versions] SBOM fetch failed:', e.message)
  }

  try {
    const bstRes = await fetch(FDSDK_BST_URL, { headers })
    if (bstRes.ok) {
      const { content, encoding } = await bstRes.json()
      const version = extractFreedesktopSdkVersion(decodeGitHubContent(content, encoding))
      if (version) {
        current.packages['freedesktop-sdk'] = version
        console.info(`[dakota-versions] freedesktop-sdk → ${version}`)
      }
    }
    else {
      console.warn(`[dakota-versions] freedesktop-sdk.bst fetch returned ${bstRes.status}`)
    }
  }
  catch (e) {
    console.warn('[dakota-versions] freedesktop-sdk.bst fetch failed:', e.message)
  }

  fs.writeFileSync(OUT, `${JSON.stringify(current, null, 2)}\n`)
  console.info('[dakota-versions] wrote', OUT)
}

if (isMainModule()) {
  main().catch((e) => {
    console.error('[dakota-versions] error:', e.message)
    process.exit(0)
  })
}
