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
  /**
   * Pixel geometry of the exact upstream asset at `upstreamAssetUrl`, as
   * retrieved on `retrievalDate`. Tests compare the downloaded local JPEG's
   * real dimensions against these two fields, not merely against "nonzero",
   * so a truncated, re-compressed, or silently swapped download fails.
   */
  readonly sourceWidth: number
  readonly sourceHeight: number
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

/**
 * A record for art the owner supplied from his own local collection.
 *
 * The two shapes above both carry an `upstreamAssetUrl`, because both were
 * retrieved from a public page that can be re-checked. The Earth devastation
 * montage cannot make that claim: those files came out of the owner's picture
 * library, and several arrived as opaque filenames (`VvQ42JH.jpeg`) with no
 * recoverable page behind them.
 *
 * That is a provenance *gap*, and the honest thing is to record it rather than
 * paper over it. Inventing a plausible ArtStation URL would satisfy the test
 * and lie in the ledger, which is worse than an admitted unknown: the next
 * agent would treat the fabricated link as verified evidence.
 *
 * So this shape has no `upstreamAssetUrl` at all, and `artistCreditState` is
 * `'filename-asserted'` when the supplied filename names an artist —
 * `sung-choi-foundry-gate-...` is good evidence of Sung Choi and poor evidence
 * of anything else — or `'unattributed'` when it does not. Either way the
 * claim in the ledger is exactly as strong as the evidence for it.
 */
export interface OwnerSuppliedDirectorsCutConcept
  extends Omit<DirectorsCutDestinyConceptBase, 'authoritativeSourceUrl' | 'upstreamAssetUrl'> {
  readonly artist: string | null
  readonly artistCreditState: 'filename-asserted' | 'unattributed'
  /** Where the file actually came from, in place of a URL that does not exist. */
  readonly provenance: 'owner-supplied-local'
  /** What is and is not known about this file's origin, in the owner's terms. */
  readonly provenanceNote: string
  readonly rightsHolder: typeof BUNGIE_RIGHTS_HOLDER
}

export type DirectorsCutDestinyConcept
  = CreditedDirectorsCutDestinyConcept
    | UncreditedDirectorsCutDestinyConcept
    | OwnerSuppliedDirectorsCutConcept

const BUNGIE_PRESS_ROOM
  = 'https://press.bungie.com/Go-Beyond-the-Light-Destiny-2-Beyond-Light-Arrives-On-September-22' as const
const BUNGIE_PRESS_ROOM_SOURCE = 'Bungie Press Room' as const
const JESSE_VAN_DIJK_ARTSTATION = 'https://www.artstation.com/jessevandijk' as const

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

function ownerSuppliedRecord(
  concept: Omit<
    OwnerSuppliedDirectorsCutConcept,
    'backgroundFigure' | 'localPath' | 'policyUrl' | 'provenance' | 'retrievalDate' | 'rightsHolder' | 'usageBasis'
  >,
): OwnerSuppliedDirectorsCutConcept {
  return {
    ...concept,
    provenance: 'owner-supplied-local',
    rightsHolder: BUNGIE_RIGHTS_HOLDER,
    backgroundFigure: {
      label: concept.artist
        ? exactArtistFigureLabel(concept.workTitle, concept.artist)
        : uncreditedFigureLabel(concept.workTitle, 'the owner\'s supplied collection'),
      credit: DIRECTORS_CUT_DESTINY_CONCEPT_CREDIT,
    },
    localPath: `wolves-intro/destiny-concepts/${concept.filename}`,
    retrievalDate: DIRECTORS_CUT_DESTINY_CONCEPT_RETRIEVAL_DATE,
    policyUrl: BUNGIE_FAN_CONTENT_POLICY_URL,
    usageBasis: 'non-commercial-fan-content',
  }
}

export const DIRECTORS_CUT_DESTINY_CONCEPTS: readonly DirectorsCutDestinyConcept[] = [
  // Registry order IS montage order - the shot list schedules by index - so this
  // array is the running order of the prologue, not bookkeeping.
  //
  // **Every record is stored at exactly 1920x1080.** Sources arrived at nine
  // different aspect ratios, from 1.40:1 to 2.35:1, and the runtime frames
  // paintings whole rather than cropping them, so an off-ratio record painted
  // inside black bars: the 2.35:1 invasion plate left 47% of a 1080p screen
  // black and the 1280x705 atrium 56%. On owner instruction (2026-08-10) each
  // one is now cropped to the largest centred 16:9 rectangle and resampled to
  // 1920x1080, so the montage fills the frame edge to edge with no bars at all.
  //
  // `sourceWidth` / `sourceHeight` therefore describe the **stored** file, which
  // is what the geometry test decodes and compares. Each record's original
  // dimensions are recorded in its provenance note, so the crop is visible in
  // the ledger rather than silently lost.
  //
  // Two rules govern what may be in here.
  //
  // **The threat is never seen.** No Traveler, no aliens, no alien architecture,
  // nothing an audience can name as Destiny on sight. Six records were cut under
  // this and a test fails if any of their ids returns. Ships are the one
  // admitted exception, on owner instruction: the narration already says others
  // came to claim the Garden, so distant craft illustrate a line the audience is
  // being told rather than revealing a threat it was promised it would not see.
  // Creatures stay out. So do the Darkness pyramids, which a curation pass
  // scored highly before being overruled here - they are as nameable as the
  // Traveler.
  //
  // **Cityscapes and skyboxes.** Owner instruction: bias toward cities and sky
  // rather than interiors and yards. A foundry hall, a scrapyard, a dust plain
  // and a valley dam were all dropped on that basis despite being good
  // pictures - they had no horizon, and this piece lives on its horizons.

  // The universe first. The Gardener and the Winnower are cosmic beings, and
  // every other record in this list is Earth *after* the Collapse, so opening on
  // ruin put the show's first line - "walked among the stars" - over rubble.
  ownerSuppliedRecord({
    referenceId: 'SPACE-1',
    id: 'destiny-concepts/space-asteroid-belt',
    filename: 'space-asteroid-belt.jpg',
    artist: null,
    artistCreditState: 'unattributed',
    provenanceNote: 'Supplied by the owner as `World 654.jpg`, an opaque filename with no recoverable source page. Artist unknown; not guessed. Stored as retrieved at 1920x1080; no crop was needed.',
    workTitle: 'Asteroid belt against a gas giant',
    sourceWidth: 1920,
    sourceHeight: 1080,
  }),

  // The world as it was, so the ninety seconds of ruin that follow are the loss
  // of something the audience has actually seen. The one record admitted with a
  // prominent foreground figure, on owner approval: here the figure is the point.
  ownerSuppliedRecord({
    referenceId: 'EARTH-GOLD',
    id: 'destiny-concepts/earth-golden-age-city',
    filename: 'earth-golden-age-city-sung-choi.jpg',
    artist: 'Sung Choi',
    artistCreditState: 'filename-asserted',
    provenanceNote: 'Supplied by the owner as `sung-choi-guardian-day-sung-choi-1600px.jpg` and approved by name for the Golden Age beat. The filename asserts Sung Choi; no upstream page was verified. Original 1600x900; upscaled to 1920x1080.',
    workTitle: 'Golden Age city under banners',
    sourceWidth: 1920,
    sourceHeight: 1080,
  }),

  // The descent.
  ownerSuppliedRecord({
    referenceId: 'EARTH-1',
    id: 'destiny-concepts/earth-overgrown-city',
    filename: 'earth-overgrown-city-joseph-cross.jpg',
    artist: 'Joseph Cross',
    artistCreditState: 'filename-asserted',
    provenanceNote: 'Supplied by the owner as `joseph-cross-jc-edz-2.jpg`. The filename asserts Joseph Cross; no upstream page was verified. Original 1728x987; cropped to 16:9 and resampled.',
    workTitle: 'Overgrown city blocks',
    sourceWidth: 1920,
    sourceHeight: 1080,
  }),
  ownerSuppliedRecord({
    referenceId: 'EARTH-2',
    id: 'destiny-concepts/earth-drowned-city',
    filename: 'earth-drowned-city-zombot-studio.jpg',
    artist: 'Zombot Studio',
    artistCreditState: 'filename-asserted',
    provenanceNote: 'Supplied by the owner as `zombot-studio-downlox.jpg`. The filename asserts Zombot Studio; no upstream page was verified. Original 1862x1000; cropped to 16:9 and resampled.',
    workTitle: 'Drowned city behind dead trees',
    sourceWidth: 1920,
    sourceHeight: 1080,
  }),
  ownerSuppliedRecord({
    referenceId: 'EARTH-3',
    id: 'destiny-concepts/earth-storm-city',
    filename: 'earth-storm-city.jpg',
    artist: null,
    artistCreditState: 'unattributed',
    provenanceNote: 'Supplied by the owner as `EjCq1IT.jpeg`, an opaque filename with no recoverable source page. Artist unknown; not guessed. Stored at 1920x1080.',
    workTitle: 'Overgrown towers in a rainstorm',
    sourceWidth: 1920,
    sourceHeight: 1080,
  }),
  ownerSuppliedRecord({
    referenceId: 'EARTH-4',
    id: 'destiny-concepts/earth-ruined-city-canyon',
    filename: 'earth-ruined-city-canyon.jpg',
    artist: null,
    artistCreditState: 'unattributed',
    provenanceNote: 'Supplied by the owner as `VvQ42JH.jpeg`, an opaque filename with no recoverable source page. Artist unknown; not guessed. Stored at 1920x1080.',
    workTitle: 'Ruined city canyon under storm light',
    sourceWidth: 1920,
    sourceHeight: 1080,
  }),
  ownerSuppliedRecord({
    referenceId: 'EARTH-5',
    id: 'destiny-concepts/earth-shuttle-monolith',
    filename: 'earth-shuttle-monolith.jpg',
    artist: null,
    artistCreditState: 'unattributed',
    provenanceNote: 'Supplied by the owner under a base64-like filename with no recoverable source page. Artist unknown; not guessed. Original 1899x1068; cropped to 16:9 and resampled.',
    workTitle: 'Grounded shuttle on a storm plain',
    sourceWidth: 1920,
    sourceHeight: 1080,
  }),
  ownerSuppliedRecord({
    referenceId: 'EARTH-6',
    id: 'destiny-concepts/earth-collapsed-arcology',
    filename: 'earth-collapsed-arcology-jesse-van-dijk.jpg',
    artist: 'Jesse van Dijk',
    artistCreditState: 'filename-asserted',
    provenanceNote: 'Supplied by the owner as `jesse-van-dijk-e-010.jpg`. The filename asserts Jesse van Dijk; no upstream page was verified. Original 1920x1369; cropped to 16:9 and resampled.',
    workTitle: 'Collapsed arcology above the lake',
    sourceWidth: 1920,
    sourceHeight: 1080,
  }),

  // The invasion, under the line that names it.
  ownerSuppliedRecord({
    referenceId: 'EARTH-7',
    id: 'destiny-concepts/earth-invasion-city',
    filename: 'earth-invasion-city-sung-choi.jpg',
    artist: 'Sung Choi',
    artistCreditState: 'filename-asserted',
    provenanceNote: 'Supplied by the owner as `destiny-2-concept-art-sung-choi-ruined-city-wide-01.jpg`. The filename asserts Sung Choi; no upstream page was verified. Original 1600x681; cropped to 16:9 and resampled.',
    workTitle: 'Ruined city wide, under descending craft',
    sourceWidth: 1920,
    sourceHeight: 1080,
  }),

  // The aftermath. These two exist because three consecutive shots on the
  // Collapse night plate read as one still held for 27.75s - a stalled
  // projector, not a held beat.
  ownerSuppliedRecord({
    referenceId: 'EARTH-8',
    id: 'destiny-concepts/earth-flooded-atrium',
    filename: 'earth-flooded-atrium.jpg',
    artist: null,
    artistCreditState: 'unattributed',
    provenanceNote: 'Supplied by the owner as `photo_2022-08-13_15-27-01.jpg`, a messaging-app export with no recoverable source page. Artist unknown; not guessed. Original 1280x705; cropped to 16:9 and upscaled.',
    workTitle: 'Vine-choked industrial atrium',
    sourceWidth: 1920,
    sourceHeight: 1080,
  }),
  ownerSuppliedRecord({
    referenceId: 'EARTH-9',
    id: 'destiny-concepts/earth-storm-island',
    filename: 'earth-storm-island.jpg',
    artist: 'Dorje Bellbrook',
    artistCreditState: 'filename-asserted',
    provenanceNote: 'Supplied by the owner as `dorje-bellbrook-db-destiny2-001.jpg`. The filename asserts Dorje Bellbrook; no upstream page was verified. Stored at 1920x1080.',
    workTitle: 'Last lit settlement above the flood plain',
    sourceWidth: 1920,
    sourceHeight: 1080,
  }),

  // ---------------------------------------------------------------------
  // The cold arrival. Europa is held to the end on owner instruction
  // (2026-08-10): "save europa for the end except for the bluefin title slide".
  // These two records, and the title plate, are the only Europa in the
  // prologue. Do not schedule either of them earlier.
  creditedRecord({
    referenceId: 'C2',
    id: 'destiny-concepts/c2-underneath-the-ice-on-europa',
    filename: 'destiny-2020-jessevandijk-030.jpg',
    artist: 'Jesse van Dijk',
    workTitle: 'Underneath the ice on Europa',
    authoritativeSourceUrl: JESSE_VAN_DIJK_ARTSTATION,
    upstreamAssetUrl: 'https://cdna.artstation.com/p/assets/images/images/032/810/504/large/jesse-van-dijk-destiny-2020-jessevandijk-030.jpg?1607533935',
    // Retrieved at 1920x1200; cropped to 16:9 and stored at 1920x1080.
    sourceWidth: 1920,
    sourceHeight: 1080,
  }),
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
    sourceWidth: 1920,
    sourceHeight: 1080,
  }),
] as const
