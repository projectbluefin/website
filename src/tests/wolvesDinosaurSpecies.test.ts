import { describe, expect, it } from 'vitest'
import { dinosaurSpecies } from '../data/wolves-dinosaur-species'

describe('wolves dinosaur species', () => {
  it('cites the documentation section for every declared scientific name', () => {
    const citationsBySpeciesId = {
      'bluefin': 'https://docs.projectbluefin.io/dinosaurs/#bluefin',
      'achillobator': 'https://docs.projectbluefin.io/dinosaurs/#bluefin-lts-and-gdx',
      'karl': 'https://docs.projectbluefin.io/dinosaurs/#kubernetes',
      'dolly': 'https://docs.projectbluefin.io/dinosaurs/#flathub',
      'dakotaraptor': 'https://docs.projectbluefin.io/dinosaurs/#-redacted-',
      'utahraptor': 'https://docs.projectbluefin.io/dinosaurs/#-redacted--1',
      'torosaurus': 'https://docs.projectbluefin.io/dinosaurs/#-redacted--2',
      'bob-torosaurus': 'https://docs.projectbluefin.io/dinosaurs/#-redacted--2',
      'kaslin-torosaurus': 'https://docs.projectbluefin.io/dinosaurs/#-redacted--2',
      'alamosaurus': 'https://docs.projectbluefin.io/dinosaurs/#-redacted--3',
    } as const

    expect(Object.keys(citationsBySpeciesId)).toHaveLength(dinosaurSpecies.length)
    for (const species of dinosaurSpecies) {
      expect(species.documentationUrl).toBe(citationsBySpeciesId[species.id as keyof typeof citationsBySpeciesId])
    }
  })

  it('uses an explicit cited artwork for every registry species', () => {
    for (const species of dinosaurSpecies) {
      expect(species.documentationUrl).toMatch(/^https:\/\/docs\.projectbluefin\.io\//)
      expect(species.artwork).toMatch(/^\.\/characters\/.+\.webp$/)
    }
  })

  it('registers Bob and Kaslin Torosaurus artwork separately under the same cited species', () => {
    expect(dinosaurSpecies).toEqual(expect.arrayContaining([
      expect.objectContaining({
        id: 'bob-torosaurus',
        scientificName: 'Torosaurus latus',
        artwork: './characters/bob-torosaurus.webp',
      }),
      expect.objectContaining({
        id: 'kaslin-torosaurus',
        scientificName: 'Torosaurus latus',
        artwork: './characters/kaslin-torosaurus.webp',
      }),
    ]))
  })
})
