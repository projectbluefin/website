/**
 * Source-verified evidence ledger for the Director's Cut nine-quote panel.
 *
 * These records are keyed by the same id as their lore record under
 * `src/data/lore/quote-*.md` and `wolves-lore-records.ts`'s `directors-cut`
 * chapter. The authority for every field here is the `science-quotes`
 * research report produced for this session
 * (`science-quote-research.md`); no wording, locator, or URL here was
 * paraphrased or invented. Dune and Tolkien excerpts researched in the
 * sibling `literary-quote-research.md` report are excluded from this ledger:
 * neither work is public domain, and the owner has not recorded written
 * permission or legal clearance for either estate.
 */

export type QuoteVerificationConfidence
  /** Google Books/archive.org page imagery of the physical printed edition. */
  = | 'primary-print-scan'
  /** The author's/organization's own first-party web publication, read directly, with no print intermediary. */
    | 'primary-web-publication'
  /** An authoritative third party (e.g. NASA) reproduces the passage; not a scan of the print page itself. */
    | 'official-secondary-reproduction'

export interface DirectorsCutQuoteEvidence {
  readonly id: string
  readonly attribution: string
  readonly work: string
  readonly editionOrPublication: string
  readonly locator: string
  readonly sourceUrl: string
  readonly copyrightStatus: string
  readonly verificationConfidence: QuoteVerificationConfidence
}

const SAGAN_COPYRIGHT_STATUS
  = 'In copyright; rights administered by the Carl Sagan estate. Reproduced here only as a short exact excerpt for non-commercial editorial commentary, not under an open licence.'
const CLARKE_COPYRIGHT_STATUS
  = 'In copyright; rights administered by the Arthur C. Clarke estate. Reproduced here only as a short exact excerpt for non-commercial editorial commentary, not under an open licence.'
const ASIMOV_COPYRIGHT_STATUS
  = 'In copyright; rights administered by the Isaac Asimov estate. Reproduced here only as a short exact excerpt for non-commercial editorial commentary, not under an open licence.'
const GOULD_COPYRIGHT_STATUS
  = 'In copyright; rights administered by the Stephen Jay Gould estate. Reproduced here only as a short exact excerpt for non-commercial editorial commentary, not under an open licence.'
const GOODALL_COPYRIGHT_STATUS
  = 'In copyright; rights held by Jane Goodall and/or the Jane Goodall Institute. Reproduced here only as a short exact excerpt for non-commercial editorial commentary, not under an open licence.'

export const DIRECTORS_CUT_QUOTE_EVIDENCE: readonly DirectorsCutQuoteEvidence[] = [
  {
    id: 'quote-sagan-extinction-forever',
    attribution: 'Carl Sagan',
    work: 'The Varieties of Scientific Experience: A Personal View of the Search for God',
    editionOrPublication: '2006 Penguin edition',
    locator: 'p. 204',
    sourceUrl: 'https://books.google.com/books?id=a2iouZybD8sC&pg=PA204&dq=%22Extinction+is+forever%22',
    copyrightStatus: SAGAN_COPYRIGHT_STATUS,
    verificationConfidence: 'primary-print-scan',
  },
  {
    id: 'quote-sagan-pale-blue-dot',
    attribution: 'Carl Sagan',
    work: 'Pale Blue Dot: A Vision of the Human Future in Space',
    editionOrPublication: '1994 first edition',
    locator: 'chapter "You Are Here," p. 6',
    sourceUrl: 'https://science.nasa.gov/resource/voyager-pale-blue-dot-download/',
    copyrightStatus: SAGAN_COPYRIGHT_STATUS,
    verificationConfidence: 'official-secondary-reproduction',
  },
  {
    id: 'quote-clarke-dinosaurs-adapt',
    attribution: 'Arthur C. Clarke',
    work: 'The Collected Stories of Arthur C. Clarke',
    editionOrPublication: '2000 edition',
    locator: 'Foreword, p. x',
    sourceUrl: 'https://books.google.com/books?id=H118kM3MECEC&pg=PR10&dq=dinosaurs+disappeared',
    copyrightStatus: CLARKE_COPYRIGHT_STATUS,
    verificationConfidence: 'primary-print-scan',
  },
  {
    id: 'quote-clarke-unstable-combination',
    attribution: 'Arthur C. Clarke',
    work: 'Voices from the Sky',
    editionOrPublication: '1965 edition',
    locator: 'p. 183',
    sourceUrl: 'https://books.google.com/books?id=6tAyAAAAMAAJ&pg=PA183&dq=%22superior+science%22',
    copyrightStatus: CLARKE_COPYRIGHT_STATUS,
    verificationConfidence: 'primary-print-scan',
  },
  {
    id: 'quote-asimov-knowledge-wisdom',
    attribution: 'Isaac Asimov',
    work: 'Isaac Asimov\'s Book of Science and Nature Quotations',
    editionOrPublication: '1988 edition',
    locator: 'p. 281',
    sourceUrl: 'https://archive.org/details/isaacasimovsbook0000unse',
    copyrightStatus: ASIMOV_COPYRIGHT_STATUS,
    verificationConfidence: 'primary-print-scan',
  },
  {
    id: 'quote-gould-stewards-of-nothing',
    attribution: 'Stephen Jay Gould',
    work: 'Eight Little Piggies',
    editionOrPublication: '1993 edition',
    locator: '"The Golden Rule," p. 48',
    sourceUrl: 'https://books.google.com/books?id=_kOoVw0SIhUC&pg=PA48&dq=stewards',
    copyrightStatus: GOULD_COPYRIGHT_STATUS,
    verificationConfidence: 'primary-print-scan',
  },
  {
    id: 'quote-gould-fight-to-save',
    attribution: 'Stephen Jay Gould',
    work: 'Eight Little Piggies',
    editionOrPublication: '1993 edition',
    locator: '"The Golden Rule," p. 40',
    sourceUrl: 'https://books.google.com/books?id=_kOoVw0SIhUC&pg=PA40&dq=We+cannot+win+this+battle',
    copyrightStatus: GOULD_COPYRIGHT_STATUS,
    verificationConfidence: 'primary-print-scan',
  },
  {
    id: 'quote-goodall-every-individual-matters',
    attribution: 'Jane Goodall',
    work: 'With Love',
    editionOrPublication: 'first Scholastic printing',
    locator: 'preview PP47',
    sourceUrl: 'https://books.google.com/books?id=4ETSewwhUiEC&pg=PP47&dq=Every+individual+matters',
    copyrightStatus: GOODALL_COPYRIGHT_STATUS,
    verificationConfidence: 'primary-print-scan',
  },
  {
    id: 'quote-goodall-nature-resilient',
    attribution: 'Jane Goodall',
    work: 'Protecting the Tapestry of Life',
    editionOrPublication: 'Jane Goodall Institute Canada web essay, May 2019',
    locator: 'May 2019',
    sourceUrl: 'https://janegoodall.ca/our-stories/protecting-the-tapestry-of-life/',
    copyrightStatus: GOODALL_COPYRIGHT_STATUS,
    verificationConfidence: 'primary-web-publication',
  },
] as const

export function findDirectorsCutQuoteEvidence(id: string): DirectorsCutQuoteEvidence | undefined {
  return DIRECTORS_CUT_QUOTE_EVIDENCE.find(evidence => evidence.id === id)
}
