import type { LoreRecord } from './wolves-lore-records'
import { load as loadYaml } from 'js-yaml'

export interface LoreProject {
  id: string
  relativePath: string
  name: string
  maturity: string
  homepage: string
  documentation: string
  summary: string
  facts: readonly string[]
  sources: readonly string[]
}

function isMapping(value: unknown): value is Record<string, unknown> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    return false
  }
  const prototype = Object.getPrototypeOf(value)
  return prototype === Object.prototype || prototype === null
}

function stringField(metadata: Record<string, unknown>, field: string): string {
  const value = metadata[field]
  if (typeof value !== 'string' || value.trim() === '') {
    throw new TypeError(`Lore project field "${field}" must be a non-empty string`)
  }
  return value
}

function stringArrayField(metadata: Record<string, unknown>, field: 'facts' | 'sources'): readonly string[] {
  const value = metadata[field]
  if (!Array.isArray(value) || value.some(item => typeof item !== 'string' || item.trim() === '')) {
    throw new TypeError(`Lore project field "${field}" must be an array of non-empty strings`)
  }
  return Object.freeze([...value])
}

export function parseLoreProject(id: string, relativePath: string, raw: string): LoreProject {
  const loaded = loadYaml(raw, { filename: relativePath })
  if (!isMapping(loaded)) {
    throw new TypeError('Lore project file must be a mapping')
  }

  return Object.freeze({
    id,
    relativePath,
    name: stringField(loaded, 'name'),
    maturity: stringField(loaded, 'maturity'),
    homepage: stringField(loaded, 'homepage'),
    documentation: stringField(loaded, 'documentation'),
    summary: stringField(loaded, 'summary'),
    facts: stringArrayField(loaded, 'facts'),
    sources: stringArrayField(loaded, 'sources'),
  })
}

interface ProjectManifestEntry {
  id: string
  relativePath: string
}

const projectManifest = [
  { id: 'kubestellar', relativePath: './projects/kubestellar.project' },
  { id: 'kubernetes', relativePath: './projects/kubernetes.project' },
] as const satisfies readonly ProjectManifestEntry[]

const projectFiles = import.meta.glob('./projects/*.project', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>

export function loadAllLoreProjects(): readonly LoreProject[] {
  return Object.freeze(projectManifest.map(({ id, relativePath }) => {
    const raw = projectFiles[relativePath]
    if (raw === undefined) {
      throw new Error(`Missing lore project file "${relativePath}"`)
    }
    return parseLoreProject(id, relativePath, raw)
  }))
}

export function loadLoreProjectIndex(): Readonly<Record<string, LoreProject>> {
  return Object.freeze(Object.fromEntries(loadAllLoreProjects().map(project => [project.id, project])))
}

export function validateLoreProjectReferences(
  records: readonly LoreRecord[],
  projectIndex: Readonly<Record<string, LoreProject>>,
): void {
  for (const record of records) {
    const projectIds = record.metadata.projects
    if (projectIds === undefined) {
      continue
    }
    if (record.kind !== 'chatlog') {
      throw new TypeError(`Lore record "${record.id}" can only declare projects on chatlog records`)
    }
    for (const projectId of projectIds) {
      if (projectIndex[projectId] === undefined) {
        throw new TypeError(`Lore record "${record.id}" references unknown project "${projectId}"`)
      }
    }
  }
}
