import { describe, expect, it } from 'vitest'
import { parseLoreRecord } from '../data/wolves-lore-records'
import {
  loadAllLoreProjects,
  loadLoreProjectIndex,
  parseLoreProject,
  validateLoreProjectReferences,
} from '../data/wolves-projects'

describe('wolves lore projects', () => {
  it('loads the authored CNCF project dossier files', () => {
    expect(loadAllLoreProjects()).toEqual([
      expect.objectContaining({
        id: 'kubestellar',
        name: 'KubeStellar',
        maturity: 'CNCF Sandbox',
        homepage: 'https://kubestellar.io/',
        documentation: 'https://kubestellar.io/docs/introduction',
      }),
      expect.objectContaining({
        id: 'kubernetes',
        name: 'Kubernetes',
        maturity: 'CNCF Graduated',
        homepage: 'https://kubernetes.io/',
        documentation: 'https://kubernetes.io/docs/concepts/overview/',
      }),
    ])
  })

  it('surfaces malformed project files', () => {
    expect(() => parseLoreProject('broken', './projects/broken.project', 'name: ['))
      .toThrow()
    expect(() => parseLoreProject('list', './projects/list.project', '- not\n- a mapping'))
      .toThrow('Lore project file must be a mapping')
  })

  it('rejects unknown project references on lore records', () => {
    const record = parseLoreRecord('project-chat', 'awakening', './lore/project-chat.md', [
      '---',
      'kind: chatlog',
      'title: Project-linked transcript',
      'timestamp: \'2326-08-01\'',
      'projects:',
      '  - does-not-exist',
      '---',
      '',
      '**andy**: I\'m telling you it works',
    ].join('\n'))

    expect(() => validateLoreProjectReferences([record], loadLoreProjectIndex()))
      .toThrow('Lore record "project-chat" references unknown project "does-not-exist"')
  })

  it('rejects project tabs on non-chatlog records', () => {
    const record = parseLoreRecord('project-source', 'awakening', './lore/project-source.md', [
      '---',
      'kind: source',
      'title: Project-linked source',
      'timestamp: \'2326-08-01\'',
      'projects:',
      '  - kubernetes',
      '---',
      '',
      'Body',
    ].join('\n'))

    expect(() => validateLoreProjectReferences([record], loadLoreProjectIndex()))
      .toThrow('Lore record "project-source" can only declare projects on chatlog records')
  })
})
