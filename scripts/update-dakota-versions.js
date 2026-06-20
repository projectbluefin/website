#!/usr/bin/env node

/**
 * Updates dakota-versions.json from the BST SPDX SBOM attached to the
 * :stable image on GHCR. Falls back to :latest if :stable has no SBOM.
 *
 * Requires: oras (installed by update-content.yml), gh CLI (pre-installed
 * in GitHub Actions runners) for auth token.
 *
 * Sources:
 * 1. GHCR OCI SBOM referrer on ghcr.io/projectbluefin/dakota — BST SPDX
 * 2. projectbluefin/dakota elements/freedesktop-sdk.bst — sdk version
 * 3. Existing dakota-versions.json — fallback for fields not in SBOM
 */

import { Buffer } from 'node:buffer'
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const OUT = path.join(__dirname, '../public/dakota-versions.json')
const FDSDK_BST_URL = 'https://api.github.com/repos/projectbluefin/dakota/contents/elements/freedesktop-sdk.bst'

// ---------------------------------------------------------------------------
// BST SPDX extractor
// ---------------------------------------------------------------------------

const BST_PACKAGE_MAP = [
  { name: 'gnome-shell', bstSuffix: 'core/gnome-shell.bst', field: 'gnome' },
  { name: 'linux', bstSuffix: 'components/linux.bst', field: 'kernel' },
  { name: 'mesa', bstSuffix: 'extensions/mesa/mesa.bst', field: 'mesa' },
  { name: 'pipewire', bstSuffix: 'components/pipewire-base.bst', field: 'pipewire' },
  { name: 'podman', bstSuffix: 'components/podman.bst', field: 'podman' },
  { name: 'flatpak', bstSuffix: 'components/flatpak.bst', field: 'flatpak' },
  { name: 'bootc', bstSuffix: 'gnomeos-deps/bootc.bst', field: 'bootc' },
  { name: 'systemd', bstSuffix: 'core-deps/systemd-base.bst', field: 'systemd' },
  { name: 'NVIDIA-Linux-x86', bstSuffix: 'bluefin-nvidia/nvidia-drivers.bst', field: 'nvidia' },
]

function isSemverLike(v) {
  return typeof v === 'string' && v.length <= 40 && /^\d+\.\d+/.test(v)
}

function extractBstVersions(sbom) {
  const result = {}
  for (const pkg of (sbom.packages || [])) {
    const { name, versionInfo: ver } = pkg
    if (!name || !isSemverLike(ver)) {
      continue
    }
    const bstRefs = (pkg.externalRefs || []).filter(r => r.referenceType === 'bst-element')
    if (!bstRefs.length) {
      continue
    }
    for (const { name: n, bstSuffix, field } of BST_PACKAGE_MAP) {
      if (name !== n || result[field]) {
        continue
      }
      if (bstRefs.some(r => r.referenceLocator?.endsWith(bstSuffix))) {
        result[field] = ver
      }
    }
  }
  return result
}

// ---------------------------------------------------------------------------
// oras helpers
// ---------------------------------------------------------------------------

function orasLogin() {
  const token = execFileSync('gh', ['auth', 'token'], { encoding: 'utf8' }).trim()
  execFileSync('oras', ['login', 'ghcr.io', '--username', 'x-access-token', '--password', token], { stdio: 'pipe' })
}

function pullSbom(imageRef, outDir) {
  const raw = execFileSync('oras', [
    'discover',
    '--artifact-type',
    'application/vnd.spdx+json',
    '--format',
    'json',
    imageRef,
  ], { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] })

  const spdx = (JSON.parse(raw).referrers || [])
    .find(r => r.artifactType === 'application/vnd.spdx+json')
  if (!spdx) {
    return null
  }

  execFileSync('oras', ['pull', `ghcr.io/projectbluefin/dakota@${spdx.digest}`, '--output', outDir], { stdio: 'pipe' })

  const file = fs.readdirSync(outDir).find(f => f.endsWith('.json'))
  if (!file) {
    return null
  }
  return JSON.parse(fs.readFileSync(path.join(outDir, file), 'utf8'))
}

// ---------------------------------------------------------------------------
// main
// ---------------------------------------------------------------------------

async function main() {
  const current = JSON.parse(fs.readFileSync(OUT, 'utf8'))

  // 1. SBOM from GHCR — :stable then :latest
  try {
    orasLogin()
    let sbom = null
    for (const tag of ['stable', 'latest']) {
      const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'dakota-sbom-'))
      try {
        sbom = pullSbom(`ghcr.io/projectbluefin/dakota:${tag}`, tmp)
        if (sbom) {
          console.info(`[dakota-versions] SBOM from :${tag}`)
          break
        }
        console.warn(`[dakota-versions] no SPDX referrer on :${tag}`)
      }
      finally {
        fs.rmSync(tmp, { recursive: true, force: true })
      }
    }

    if (sbom) {
      const versions = extractBstVersions(sbom)
      for (const [k, v] of Object.entries(versions)) {
        if (v) {
          current.packages[k] = v
        }
      }
      current.generatedAt = new Date().toISOString()
      console.info('[dakota-versions] versions:', JSON.stringify(versions))
    }
    else {
      console.warn('[dakota-versions] no SBOM found on :stable or :latest')
    }
  }
  catch (e) {
    console.warn('[dakota-versions] SBOM fetch failed:', e.message)
  }

  // 2. freedesktop-sdk from upstream dakota main
  try {
    const headers = {
      'User-Agent': 'bluefin-website-updater',
      ...(process.env.GITHUB_TOKEN ? { Authorization: `token ${process.env.GITHUB_TOKEN}` } : {}),
    }
    const res = await fetch(FDSDK_BST_URL, { headers })
    if (res.ok) {
      const { content, encoding } = await res.json()
      const raw = encoding === 'base64' ? Buffer.from(content, 'base64').toString() : content
      const ver = raw.match(/ref:\s*freedesktop-sdk-([\d.]+)/)?.[1]
      if (ver) {
        current.packages['freedesktop-sdk'] = ver
        console.info(`[dakota-versions] freedesktop-sdk → ${ver}`)
      }
    }
  }
  catch (e) {
    console.warn('[dakota-versions] freedesktop-sdk fetch failed:', e.message)
  }

  fs.writeFileSync(OUT, `${JSON.stringify(current, null, 2)}\n`)
  console.info('[dakota-versions] wrote', OUT)
}

main().catch((e) => {
  console.error('[dakota-versions] error:', e.message)
  process.exit(0)
})
