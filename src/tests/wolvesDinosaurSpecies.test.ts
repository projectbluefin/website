import { describe, expect, it } from 'vitest'
import { dinosaurSpecies } from '../data/wolves-dinosaur-species'

describe('wolves dinosaur species', () => {
  it('cites the documentation section for every declared scientific name', () => {
    const citationsByScientificName = {
      'Deinonychus antirrhopus': 'https://docs.projectbluefin.io/dinosaurs/#bluefin',
      'Achillobator giganticus': 'https://docs.projectbluefin.io/dinosaurs/#bluefin-lts-and-gdx',
      'Amargasaurus cazaui': 'https://docs.projectbluefin.io/dinosaurs/#kubernetes',
      'Dimetrodon limbatus': 'https://docs.projectbluefin.io/dinosaurs/#flathub',
      'Dakotaraptor steini': 'https://docs.projectbluefin.io/dinosaurs/#-redacted-',
      'Utahraptor ostrommaysi': 'https://docs.projectbluefin.io/dinosaurs/#-redacted--1',
      'Torosaurus latus': 'https://docs.projectbluefin.io/dinosaurs/#-redacted--2',
      'Alamosaurus sanjuanensis': 'https://docs.projectbluefin.io/dinosaurs/#-redacted--3',
    } as const

    expect(Object.keys(citationsByScientificName)).toHaveLength(dinosaurSpecies.length)
    for (const species of dinosaurSpecies) {
      expect(species.documentationUrl).toBe(citationsByScientificName[species.scientificName])
    }
  })

  it('uses an explicit cited artwork for every registry species', () => {
    for (const species of dinosaurSpecies) {
      expect(species.documentationUrl).toMatch(/^https:\/\/docs\.projectbluefin\.io\//)
      expect(species.artwork).toMatch(/^\.\/characters\/.+\.webp$/)
    }
  })
})
