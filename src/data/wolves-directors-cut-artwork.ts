/**
 * Approved Destiny concept-art registry for the Director's Cut Gayane montage.
 *
 * This is an explicit allowlist, one record per approved file, so Task 4 can
 * schedule only the owner's chosen paintings and preserve their provenance.
 * These records do not claim an open licence: usage is gated by Bungie's
 * non-commercial fan-content policy plus the owner's approval recorded in the
 * design spec.
 */

export const BUNGIE_FAN_CONTENT_POLICY_URL
  = 'https://help.bungie.net/hc/en-us/articles/360049201911-Intellectual-Property-and-Trademarks' as const

export const BUNGIE_RIGHTS_HOLDER = 'Bungie, Inc.' as const

export const DIRECTORS_CUT_DESTINY_CONCEPT_RETRIEVAL_DATE = '2026-08-09' as const

export const DIRECTORS_CUT_DESTINY_CONCEPT_CREDIT
  = 'Destiny 2 and related artwork © Bungie, Inc. Environment concept art by the credited artists.' as const

export interface DirectorsCutBackgroundFigureMetadata {
  readonly label: string
  readonly credit: typeof DIRECTORS_CUT_DESTINY_CONCEPT_CREDIT
}

interface DirectorsCutDestinyConceptBase {
  /** Research/contact-sheet id proving this is a selected concept painting, not a render pick. */
  readonly referenceId: string
  /** Stable local registry id for timeline and test references. */
  readonly id: string
  /** Stored filename under public/wolves-intro/destiny-concepts/. */
  readonly filename: string
  /** Public runtime path, relative to BASE_URL/public. */
  readonly localPath: string
  readonly workTitle: string
  /** Accessible figure metadata Task 4 can publish without painting a visible caption. */
  readonly backgroundFigure: DirectorsCutBackgroundFigureMetadata
  /** Human-facing page or profile the asset is cited back to. */
  readonly authoritativeSourceUrl: string
  /** Exact direct asset URL the local file was retrieved from. */
  readonly upstreamAssetUrl: string
  readonly retrievalDate: typeof DIRECTORS_CUT_DESTINY_CONCEPT_RETRIEVAL_DATE
  readonly policyUrl: typeof BUNGIE_FAN_CONTENT_POLICY_URL
  readonly usageBasis: 'non-commercial-fan-content'
}

export interface CreditedDirectorsCutDestinyConcept extends DirectorsCutDestinyConceptBase {
  readonly artist: string
  readonly artistCreditState: 'exact'
}

export interface UncreditedDirectorsCutDestinyConcept extends DirectorsCutDestinyConceptBase {
  readonly artist: null
  readonly artistCreditState: 'uncredited'
  readonly artistCreditNote: string
  readonly rightsHolder: typeof BUNGIE_RIGHTS_HOLDER
  readonly sourceName: string
}

export type DirectorsCutDestinyConcept
  = CreditedDirectorsCutDestinyConcept
    | UncreditedDirectorsCutDestinyConcept

const BUNGIE_PRESS_ROOM
  = 'https://press.bungie.com/Go-Beyond-the-Light-Destiny-2-Beyond-Light-Arrives-On-September-22' as const
const BUNGIE_PRESS_ROOM_SOURCE = 'Bungie Press Room' as const
const JESSE_VAN_DIJK_ARTSTATION = 'https://www.artstation.com/jessevandijk' as const
const MARK_GOLDSWORTHY_ARTSTATION = 'https://www.artstation.com/arasaka' as const
const BUNGIE_ART_BLAST
  = 'https://magazine.artstation.com/2024/09/bungie-10-year-destiny-art-blast/' as const

function exactArtistFigureLabel(workTitle: string, artist: string): string {
  return `${workTitle} concept art by ${artist}`
}

function uncreditedFigureLabel(workTitle: string, sourceName: string): string {
  return `${workTitle} concept art from ${sourceName}, individual artist uncredited`
}

function creditedRecord(
  concept: Omit<
    CreditedDirectorsCutDestinyConcept,
    'artistCreditState' | 'backgroundFigure' | 'localPath' | 'policyUrl' | 'retrievalDate' | 'usageBasis'
  >,
): CreditedDirectorsCutDestinyConcept {
  return {
    ...concept,
    artistCreditState: 'exact',
    backgroundFigure: {
      label: exactArtistFigureLabel(concept.workTitle, concept.artist),
      credit: DIRECTORS_CUT_DESTINY_CONCEPT_CREDIT,
    },
    localPath: `wolves-intro/destiny-concepts/${concept.filename}`,
    retrievalDate: DIRECTORS_CUT_DESTINY_CONCEPT_RETRIEVAL_DATE,
    policyUrl: BUNGIE_FAN_CONTENT_POLICY_URL,
    usageBasis: 'non-commercial-fan-content',
  }
}

function uncreditedRecord(
  concept: Omit<
    UncreditedDirectorsCutDestinyConcept,
    'artist' | 'artistCreditState' | 'backgroundFigure' | 'localPath' | 'policyUrl' | 'retrievalDate' | 'usageBasis'
  >,
): UncreditedDirectorsCutDestinyConcept {
  return {
    ...concept,
    artist: null,
    artistCreditState: 'uncredited',
    backgroundFigure: {
      label: uncreditedFigureLabel(concept.workTitle, concept.sourceName),
      credit: DIRECTORS_CUT_DESTINY_CONCEPT_CREDIT,
    },
    localPath: `wolves-intro/destiny-concepts/${concept.filename}`,
    retrievalDate: DIRECTORS_CUT_DESTINY_CONCEPT_RETRIEVAL_DATE,
    policyUrl: BUNGIE_FAN_CONTENT_POLICY_URL,
    usageBasis: 'non-commercial-fan-content',
  }
}

export const DIRECTORS_CUT_DESTINY_CONCEPTS: readonly DirectorsCutDestinyConcept[] = [
  uncreditedRecord({
    referenceId: 'E1',
    id: 'destiny-concepts/e1-europa-environment',
    filename: 'Destiny_2_Beyond_Light_Europa_Environment_01.jpg',
    sourceName: BUNGIE_PRESS_ROOM_SOURCE,
    rightsHolder: BUNGIE_RIGHTS_HOLDER,
    artistCreditNote: 'The approved Bungie Press Room asset and Bungie\'s official Europa environment spotlights do not attribute this exact press image to a single named artist.',
    workTitle: 'Europa environment',
    authoritativeSourceUrl: BUNGIE_PRESS_ROOM,
    upstreamAssetUrl: 'https://imgeucdn.gamespress.com/cdn/files/PremierPR/2020/06/09163147-741099bb-d13d-4d1a-bf66-a5f5300c3ed9/Destiny_2_Beyond_Light_Europa_Environment_01.jpg?otf=y&lightbox=y&sky=1b9ae393e24c13847cf692b20b8c587754b3b5106b459664b26043307b74c1c1',
  }),
  creditedRecord({
    referenceId: 'C1',
    id: 'destiny-concepts/c1-europa-landscape-v1',
    filename: 'mark-goldsworthy-europa-landscape-v1-copy.jpg',
    artist: 'Mark Goldsworthy',
    workTitle: 'Europa Landscape V1',
    authoritativeSourceUrl: BUNGIE_ART_BLAST,
    upstreamAssetUrl: 'https://cdnb.artstation.com/p/assets/images/images/012/963/475/4k/mark-goldsworthy-europa-landscape-v1-copy.jpg?1537386402',
  }),
  creditedRecord({
    referenceId: 'C2',
    id: 'destiny-concepts/c2-underneath-the-ice-on-europa',
    filename: 'destiny-2020-jessevandijk-030.jpg',
    artist: 'Jesse van Dijk',
    workTitle: 'Underneath the ice on Europa',
    authoritativeSourceUrl: JESSE_VAN_DIJK_ARTSTATION,
    upstreamAssetUrl: 'https://cdna.artstation.com/p/assets/images/images/032/810/504/large/jesse-van-dijk-destiny-2020-jessevandijk-030.jpg?1607533935',
  }),
  creditedRecord({
    referenceId: 'C3',
    id: 'destiny-concepts/c3-early-europa-concept',
    filename: 'destiny-2020-jessevandijk-010.jpg',
    artist: 'Jesse van Dijk',
    workTitle: 'Early Europa concept',
    authoritativeSourceUrl: JESSE_VAN_DIJK_ARTSTATION,
    upstreamAssetUrl: 'https://cdna.artstation.com/p/assets/images/images/032/809/884/large/jesse-van-dijk-destiny-2020-jessevandijk-010.jpg?1607532980',
  }),
  creditedRecord({
    referenceId: 'C4',
    id: 'destiny-concepts/c4-cryovolcanoes',
    filename: 'destiny-2020-jessevandijk-020.jpg',
    artist: 'Jesse van Dijk',
    workTitle: 'Cryovolcanoes',
    authoritativeSourceUrl: JESSE_VAN_DIJK_ARTSTATION,
    upstreamAssetUrl: 'https://cdnb.artstation.com/p/assets/images/images/032/810/477/large/jesse-van-dijk-destiny-2020-jessevandijk-020.jpg?1607533856',
  }),
  creditedRecord({
    referenceId: 'C9',
    id: 'destiny-concepts/c9-mars-farm-collapse',
    filename: 'mark-goldsworthy-markg-mars-farm-collapse-concept.jpg',
    artist: 'Mark Goldsworthy',
    workTitle: 'Mars Farm Collapse',
    authoritativeSourceUrl: MARK_GOLDSWORTHY_ARTSTATION,
    upstreamAssetUrl: 'https://cdnb.artstation.com/p/assets/images/images/046/905/269/large/mark-goldsworthy-markg-mars-farm-collapse-concept.jpg?1646261226',
  }),
  creditedRecord({
    referenceId: 'C6',
    id: 'destiny-concepts/c6-fallen-citadel',
    filename: 'mark-goldsworthy-fallen-citadel-oct-1.jpg',
    artist: 'Mark Goldsworthy',
    workTitle: 'Fallen Citadel',
    authoritativeSourceUrl: MARK_GOLDSWORTHY_ARTSTATION,
    upstreamAssetUrl: 'https://cdna.artstation.com/p/assets/images/images/032/669/612/large/mark-goldsworthy-fallen-citadel-oct-1.jpg?1607107735',
  }),
  creditedRecord({
    referenceId: 'C5',
    id: 'destiny-concepts/c5-ice-shelf-shapes',
    filename: 'destiny-2020-jessevandijk-079.jpg',
    artist: 'Jesse van Dijk',
    workTitle: 'Ice-shelf shapes',
    authoritativeSourceUrl: JESSE_VAN_DIJK_ARTSTATION,
    upstreamAssetUrl: 'https://cdna.artstation.com/p/assets/images/images/032/810/096/large/jesse-van-dijk-destiny-2020-jessevandijk-079.jpg?1607533346',
  }),
  creditedRecord({
    referenceId: 'C7',
    id: 'destiny-concepts/c7-early-throne-world-citadel',
    filename: 'mark-goldsworthy-markg-citadel-concept.jpg',
    artist: 'Mark Goldsworthy',
    workTitle: 'Early Throne World citadel',
    authoritativeSourceUrl: MARK_GOLDSWORTHY_ARTSTATION,
    upstreamAssetUrl: 'https://cdna.artstation.com/p/assets/images/images/046/905/669/large/mark-goldsworthy-markg-citadel-concept.jpg?1646262190',
  }),
  creditedRecord({
    referenceId: 'C10',
    id: 'destiny-concepts/c10-crash',
    filename: 'jvd_cabalshipcrashintrohiveship_1920.jpg',
    artist: 'Jesse van Dijk',
    workTitle: 'Crash',
    authoritativeSourceUrl: JESSE_VAN_DIJK_ARTSTATION,
    upstreamAssetUrl: 'https://cdna.artstation.com/p/assets/images/images/001/163/640/large/jesse-van-dijk-jvd-cabalshipcrashintrohiveship-1920.jpg?1441351541',
  }),
] as const
