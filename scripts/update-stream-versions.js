#!/usr/bin/env node

/**
 * Update stream-versions.yml from the SBOM attestations cache at
 * docs.projectbluefin.io/data/sbom-attestations.json
 *
 * This replaces the previous approach of parsing GitHub release markdown,
 * which was fragile and broke whenever the release note format changed.
 *
 * Stream mapping:
 *   stable.kernel  → bluefin-stable
 *   stable.gnome   → bluefin-stable
 *   stable.mesa    → bluefin-stable
 *   stable.nvidia  → bluefin-nvidia-open-stable
 *
 *   lts.kernel     → bluefin-lts
 *   lts.gnome      → bluefin-lts
 *   lts.mesa       → bluefin-lts
 *   lts.hwe        → bluefin-lts-hwe (kernel field)
 *   lts.nvidia     → bluefin-gdx-lts
 *
 * The sbom-attestations.json is generated nightly by projectbluefin/documentation
 * via cosign-verified OCI SBOM attestations from ghcr.io/ublue-os/bluefin* images.
 */

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { dump as dumpYaml } from 'js-yaml'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const OUT = path.join(__dirname, '../public/stream-versions.yml')
const SBOM_URL = 'https://docs.projectbluefin.io/data/sbom-attestations.json'

export function latestPv(streams, name) {
  const stream = streams[name]
  if (!stream) {
    console.warn(`[stream-versions] stream "${name}" not found in SBOM`)
    return {}
  }
  const releases = stream.releases ?? {}
  const key = Object.keys(releases).find((releaseKey) => {
    const packageVersions = releases[releaseKey]?.packageVersions
    return packageVersions && Object.keys(packageVersions).length > 0
  })
  if (!key) {
    console.warn(`[stream-versions] no releases for stream "${name}"`)
    return {}
  }
  console.info(`[stream-versions] ${name}: using release ${key}`)
  return releases[key]?.packageVersions ?? {}
}

export function buildStreamVersionData(streams) {
  const stable = latestPv(streams, 'bluefin-stable')
  const stableNvidia = latestPv(streams, 'bluefin-nvidia-open-stable')
  const lts = latestPv(streams, 'bluefin-lts')
  const ltsHwe = latestPv(streams, 'bluefin-lts-hwe')
  const ltsNvidia = latestPv(streams, 'bluefin-gdx-lts')

  return {
    stable: {
      base: stable.fedora ? `Fedora ${stable.fedora.replace(/^F/, '')}` : 'Fedora 44',
      kernel: stable.kernel ?? 'unknown',
      gnome: stable.gnome ?? 'unknown',
      mesa: stable.mesa ?? 'unknown',
      nvidia: stableNvidia.nvidia ?? 'unknown',
    },
    lts: {
      base: 'CentOS Stream 10',
      kernel: lts.kernel ?? 'unknown',
      gnome: lts.gnome ?? 'unknown',
      mesa: lts.mesa ?? 'unknown',
      hwe: ltsHwe.kernel ?? 'unknown',
      nvidia: ltsNvidia.nvidia ?? 'unknown',
    },
  }
}

export function createHeader(today = new Date().toISOString().split('T')[0]) {
  return [
    '# Stream version information for Bluefin releases',
    '# Source: docs.projectbluefin.io/data/sbom-attestations.json',
    '#         (cosign-verified OCI SBOM attestations from ghcr.io/ublue-os)',
    `# Last updated: ${today}`,
    '',
    '',
  ].join('\n')
}

function isMainModule() {
  return process.argv[1] != null && import.meta.url === pathToFileURL(process.argv[1]).href
}

async function main() {
  const res = await fetch(SBOM_URL)
  if (!res.ok) {
    throw new Error(`SBOM fetch failed: ${res.status} ${res.statusText}`)
  }

  const sbom = await res.json()
  const data = buildStreamVersionData(sbom.streams ?? {})

  fs.writeFileSync(
    OUT,
    createHeader() + dumpYaml(data, { lineWidth: -1, quotingType: '"', forceQuotes: true }),
  )

  console.info('[stream-versions] wrote', OUT)
  console.info('stable:', data.stable)
  console.info('lts:', data.lts)
}

if (isMainModule()) {
  main().catch((e) => {
    console.error('[stream-versions] fatal:', e.message)
    process.exit(1)
  })
}
