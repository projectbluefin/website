export interface DinosaurSpecies {
  id: string
  scientificName: string
  documentationUrl: string
  artwork: string
}

export const dinosaurSpecies = [
  {
    id: 'bluefin',
    scientificName: 'Deinonychus antirrhopus',
    documentationUrl: 'https://docs.projectbluefin.io/dinosaurs/#bluefin',
    artwork: './characters/bluefin-small.webp',
  },
  {
    id: 'achillobator',
    scientificName: 'Achillobator giganticus',
    documentationUrl: 'https://docs.projectbluefin.io/dinosaurs/#bluefin-lts-and-gdx',
    artwork: './characters/achillobator.webp',
  },
  {
    id: 'karl',
    scientificName: 'Amargasaurus cazaui',
    documentationUrl: 'https://docs.projectbluefin.io/dinosaurs/#kubernetes',
    artwork: './characters/karl.webp',
  },
  {
    id: 'dolly',
    scientificName: 'Dimetrodon limbatus',
    documentationUrl: 'https://docs.projectbluefin.io/dinosaurs/#flathub',
    artwork: './characters/dolly.webp',
  },
  {
    id: 'dakotaraptor',
    scientificName: 'Dakotaraptor steini',
    documentationUrl: 'https://docs.projectbluefin.io/dinosaurs/#-redacted-',
    artwork: './characters/dakota.webp',
  },
  {
    id: 'utahraptor',
    scientificName: 'Utahraptor ostrommaysi',
    documentationUrl: 'https://docs.projectbluefin.io/dinosaurs/#-redacted--1',
    artwork: './characters/utah.webp',
  },
  {
    id: 'torosaurus',
    scientificName: 'Torosaurus latus',
    documentationUrl: 'https://docs.projectbluefin.io/dinosaurs/#-redacted--2',
    artwork: './characters/torosaurus.webp',
  },
  {
    id: 'bob-torosaurus',
    scientificName: 'Torosaurus latus',
    documentationUrl: 'https://docs.projectbluefin.io/dinosaurs/#-redacted--2',
    artwork: './characters/bob-torosaurus.webp',
  },
  {
    id: 'kaslin-torosaurus',
    scientificName: 'Torosaurus latus',
    documentationUrl: 'https://docs.projectbluefin.io/dinosaurs/#-redacted--2',
    artwork: './characters/kaslin-torosaurus.webp',
  },
  {
    id: 'alamosaurus',
    scientificName: 'Alamosaurus sanjuanensis',
    documentationUrl: 'https://docs.projectbluefin.io/dinosaurs/#-redacted--3',
    artwork: './characters/alamosaurus.webp',
  },
] as const satisfies readonly DinosaurSpecies[]
