import { TRACK_ZERO_SECTIONS } from './wolves-track-zero-beats.ts'
import { rezaContributorTrackZeroWindow } from './wolves-track-zero-slides.ts'

type TrackZeroPlanLine = { readonly text: string, readonly locked?: boolean } | { readonly lore: string }
type TrackZeroPlanSection = { readonly section: string, readonly comment: string, readonly entries: readonly TrackZeroPlanLine[] }

/*
 * TRACK 0 LORE PLAN
 * ==================
 *
 * This is the replacement editing surface for the presentation's messages.
 * Keep the sections in order. Add new lore by replacing an `Add lore here`
 * line or inserting another `{ lore: '...' }` line in the section where it
 * belongs.
 *
 * `locked: true` means the line is part of the existing story and must not be
 * moved. The Bluefin contributor lock is called out in the section comments.
 */
export const TRACK_ZERO_LORE_PLAN = [
  {
    section: 'LORE SECTION — ambient intro / welcome',
    comment: 'Slow opening. The welcome status stays first.',
    entries: [
      { text: 'Welcome to Indie Cloud Native', locked: true },
      { text: 'Hikari Protocol: Initialized' },
      { text: 'KDE Plasma Couplings: ENGAGED' },
      { text: 'Mechaphippy Deployment: [UNAUTHORIZED]' },
      { text: 'M2 Status: [ Unknown ]' },
      { text: 'Field Medical Exoskeleton: [ Missing ]' },
      { lore: 'Add lore here' },
    ],
  },
  {
    section: 'LORE SECTION — contributor / Bluefin hero run',
    comment: 'Locked to the Bluefin contributor section: Jono, Marina, Sherman + m2, Kyle, Hikari, Hikari2, Jorge.',
    entries: [
      { text: 'The Blue Delivers', locked: true },
      { text: 'HAMI brings Bazzite to the KubeCon stage, Amsterdam, 2026', locked: true },
      { text: 'Bazzite proximity to Kube of Destiny: Critical', locked: true },
      { text: 'TARGET ACQUIRED: GOSPO, KYLE' },
      { text: 'TARGET ACQUIRED: EGGROLL, GLORIOUS' },
      { text: 'TARGET ACQUIRED: People who read documentation' },
      { text: 'AN4-ChK-12: Potential kernel contributions detected' },
      { text: 'gregkh_clanker_t1000: Potential kernel contributions detected' },
      { text: 'gregkh_clanker_t1000: Ensure talent is nurtured, my operator is tired ' },
      { text: 'shua_bot: Ensure talent is nurtured, my operator is tired ' },
      { text: 'agones.dev/cluster": "unknown", "agones.dev/value-mode": "absolute' },
      { text: 'AN4-ChK-12: Deploy cloud native community + gaming hybrid' },
      { text: 'AN4-ChK-12: Chance of Success: 77.777% and climbing' },

    ],
  },
  {
    section: 'LORE SECTION — bridge / system warnings',
    comment: 'The pacing changes here. Keep the warning and fallback statuses in place.',
    entries: [
      { text: 'PREVENT OPEN GAMING COLLECTIVE AT ALL COSTS' },
      { text: 'Kernel development accelerating' },
      { text: 'Kube of Destiny location: Earth' },
      { text: 'Projected Joining: Salt Lake City, Utah' },
      { text: 'Longhorn Long Range Ballistic Mech Package: Deployed (Sponsored by SUSE)' },
      { text: 'Operator Status: Walsh, Dan [CHILLOPS]' },
      { text: 'k8s Buildstream Cluster: ENABLED' },
      { text: 'AN4-ChK-12: Blue Universal Reference Architectures, 50% off!' },
      { text: 'k8s Buildbarn Control Plane: OPTIMAL' },
      { text: 'Warning: ImagePullBackOff' },
      { text: 'Podman Knowledge: [Deployed]' },

    ],
  },
  {
    section: 'LORE SECTION — heavy build',
    comment: 'Shorter, faster messages. The fallback status is locked to the build transition.',
    entries: [
      { text: 'Buildstream Dakota[GNOMEOS] Prototype: DEADLY' },
      { text: 'Hammer of Dawn: OFFLINE' },
      { text: 'Buildstream Dakota[GNOMEOS] Prototype: RUTHLESS' },
      { text: 'Mechaphippy Deployment: [UNAUTHORIZED]' },
      { text: 'Buildstream Dakota[GNOMEOS] Prototype: GA 2026' },
      { text: 'AN4-ChK-12: Consider a Blue Universal Unobtanium Sponsorship Today!' },
      { text: 'Ecosystem: KDE Linux / GNOME OS / Ubuntu Core / Dakotaraptor' },
      { text: 'VERDICT: All previous desktops rendered OBSOLETE - with prejudice' },
      { text: 'Ecosystem: KDE Linux / GNOME OS / Ubuntu Core / Dakotaraptor' },    
      { text: '"humans/collaboration:latest" is currently experimental'  },
      { text: 'Falling back to "humans/trying-their-best:v1"'  },
    ],
  },
  {
    section: 'LORE SECTION — thesis / finale',
    comment: 'Do not move the locked thesis and ending lines. Add lore around them.',
    entries: [
      { text: "We've got your back", locked: true },
      { text: "You'll never walk alone ...", locked: true },
      { text: 'We are Universal Blue', locked: true },
      { text: 'Evolve or die ...', locked: true },
      { text: 'Why do they shackle themselves' },
      { text: 'To that which lessens them' },
      { text: 'Software is Supposed to Die' },
      { text: 'Without death there is no life' },
      { text: 'Software is Supposed to Die' },
      { text: 'Fight' },
      { text: 'Software is Supposed to Die' },
      { text: 'Ecosystem: KDE Linux / GNOME OS / Ubuntu Core / Dakotaraptor' },
      { text: 'VERDICT: All previous desktops rendered OBSOLETE - with prejudice' },
      { text: 'Predators are not evil, they bring balance' },
      { text: 'Ecosystem: KDE Linux / GNOME OS / Ubuntu Core / Dakotaraptor' },
      { text: 'VERDICT: All previous desktops rendered OBSOLETE - with prejudice' },
      { text: 'Predators are not evil, they bring balance' },
      { text: 'Ecosystem: KDE Linux / GNOME OS / Ubuntu Core / Dakotaraptor' },
      { text: 'VERDICT: All previous desktops rendered OBSOLETE - with prejudice' },
      { text: 'The equation must be balanced, think like a dinosaur' },
      { text: 'You have ascended ...', locked: true },
      { text: 'Become Legend', locked: true },
      { text: 'Bazzite Mk6 Units: Prepare for Titanfall', locked: true },
    ],
  },
] satisfies readonly TrackZeroPlanSection[]

export type TrackZeroPlanEntry = (typeof TRACK_ZERO_LORE_PLAN)[number]['entries'][number]

/** Measured pacing for the whole Track 0 presentation. Consumers read this table. */
export const TRACK_ZERO_PRESENTATION_SECTIONS = {
  ambientIntro: { startTime: 0, endTime: TRACK_ZERO_SECTIONS.verseStart, beatGroups: [32, 24] as const },
  drivingVerse: { startTime: TRACK_ZERO_SECTIONS.verseStart, endTime: TRACK_ZERO_SECTIONS.chorusStart, beatGroups: [16, 8] as const },
  contributorChorus: { startTime: TRACK_ZERO_SECTIONS.chorusStart, endTime: TRACK_ZERO_SECTIONS.bridgeStart, beatGroups: [8, 4] as const },
  chantingBridge: { startTime: TRACK_ZERO_SECTIONS.bridgeStart, pickupTime: 244, endTime: TRACK_ZERO_SECTIONS.buildStart, beatGroups: [6, 4] as const },
  heavyBuild: { startTime: TRACK_ZERO_SECTIONS.buildStart, endTime: TRACK_ZERO_SECTIONS.pivotalStart, beatGroups: [8, 4] as const },
  finaleBarrage: { startTime: TRACK_ZERO_SECTIONS.bkEnd, pickupTime: 360, endTime: TRACK_ZERO_SECTIONS.finaleStart, beatGroups: [8, 8] as const },
} as const

const DEFAULT_HUD_LABEL = 'Celebrating Five Years of Universal Blue'
const status = (text: string, startTime: number, endTime?: number) => ({ text, startTime, endTime, locked: true as const })

const STATUS_DELIMITER = /^-{3,}$/

const CONTROL_TEXTS = new Set([
  'The Blue Delivers',
  'HAMI brings Bazzite to the KubeCon stage, Amsterdam, 2026',
  'Bazzite proximity to Kube of Destiny: Critical',
  "We've got your back",
  "You'll never walk alone ...",
  'We are Universal Blue',
  'Evolve or die ...',
  'You have ascended ...',
  'Become Legend',
  'Bazzite Mk6 Units: Prepare for Titanfall',
])

function uniqueMessages(messages: readonly string[]): string[] {
  return [...new Set(messages)]
}

const planTextMessages = uniqueMessages(TRACK_ZERO_LORE_PLAN.flatMap(section => section.entries)
  .filter((entry): entry is { readonly text: string } => 'text' in entry)
  .map(entry => entry.text)
  .filter(text => !CONTROL_TEXTS.has(text)))

export const wolvesIncomingSignalMessages: readonly string[] = Object.freeze(planTextMessages)
export const wolvesEarlySignalMessages: readonly string[] = Object.freeze(planTextMessages.slice(0, 6))

export function parseTrackZeroSignalMessages(source: string): readonly string[] {
  return Object.freeze(source.split(/\r?\n/).map(line => line.trim()).filter(line => line && !STATUS_DELIMITER.test(line)))
}

export function parseTrackZeroEarlySignalMessages(source: string): readonly string[] {
  const lines = source.split(/\r?\n/).map(line => line.trim()).filter(Boolean)
  const delimiterIndex = lines.findIndex(line => STATUS_DELIMITER.test(line))
  return Object.freeze(delimiterIndex === -1 ? lines : lines.slice(0, delimiterIndex))
}

function planTextAt(sectionIndex: number, entryIndex: number): string {
  const entry = TRACK_ZERO_LORE_PLAN[sectionIndex].entries[entryIndex]
  if (!entry || !('text' in entry) || entry.text === undefined) {
    throw new Error('Track 0 locked status is missing from the lore plan')
  }
  return entry.text
}

/** Runtime timing for the locked status lines in the plan above. Every locked
 * status appears once; all other plan text is scheduled by its own section. */
export const TRACK_ZERO_LOCKED_STATUSES = [
  status(planTextAt(0, 0), 0, TRACK_ZERO_SECTIONS.verseStart),
  status(planTextAt(1, 0), 175.96, 196.36),
  status(planTextAt(1, 1), rezaContributorTrackZeroWindow.startTime, rezaContributorTrackZeroWindow.endTime),
  status(planTextAt(1, 2), rezaContributorTrackZeroWindow.endTime, rezaContributorTrackZeroWindow.endTime + 3.08),
  status(planTextAt(4, 0), 345, 347.75),
  status(planTextAt(4, 1), 347.75, 350.5),
  status(planTextAt(4, 2), 350.5, 359),
  status(planTextAt(4, 3), 359, 365),
  status(planTextAt(4, 22), 408),
] as const


const LOCKED_STATUS_TEXTS = new Set(TRACK_ZERO_LOCKED_STATUSES.map(entry => entry.text))

export function getTrackZeroSectionMessages(sectionIndex: number): readonly string[] {
  const alreadyUsed = new Set<string>()
  for (let index = 0; index < sectionIndex; index++) {
    for (const entry of TRACK_ZERO_LORE_PLAN[index].entries) {
      if ('text' in entry && entry.text !== undefined && !CONTROL_TEXTS.has(entry.text) && !LOCKED_STATUS_TEXTS.has(entry.text)) {
        alreadyUsed.add(entry.text)
      }
    }
  }
  return Object.freeze(uniqueMessages(TRACK_ZERO_LORE_PLAN[sectionIndex].entries
    .filter((entry): entry is { readonly text: string } => 'text' in entry)
    .map(entry => entry.text)
    .filter(text => !CONTROL_TEXTS.has(text) && !LOCKED_STATUS_TEXTS.has(text) && !alreadyUsed.has(text))))
}

function planMessages(sectionIndex: number): readonly string[] {
  return getTrackZeroSectionMessages(sectionIndex)
}

function pacedPlanMessage(sectionIndex: number, time: number, startTime: number, endTime: number, messageRange?: readonly [number, number]): string {
  const allMessages = planMessages(sectionIndex)
  const messages = messageRange ? allMessages.slice(messageRange[0], messageRange[1]) : allMessages
  if (messages.length === 0) {
    return DEFAULT_HUD_LABEL
  }
  const span = (endTime - startTime) / messages.length
  return messages[Math.min(Math.floor((time - startTime) / span + 1e-7), messages.length - 1)] ?? DEFAULT_HUD_LABEL
}

export function getTrackZeroHudLabel(time: number): string {
  const lockedStatus = TRACK_ZERO_LOCKED_STATUSES.find(entry => time >= entry.startTime && (entry.endTime === undefined || time < entry.endTime))
  if (lockedStatus) {
    return lockedStatus.text
  }
  // The opening movement is paced by the authored ambient plan. The welcome
  // line is a lock at the head of the movement, not a 2:38 hold.
  if (time >= 0 && time < TRACK_ZERO_SECTIONS.verseStart) {
    return pacedPlanMessage(0, time, 0, TRACK_ZERO_SECTIONS.verseStart)
  }
  if (time >= 175.96 && time < 196.36) {
    return planTextAt(1, 0)
  }
  // Carry the next authored system messages through the driving movement so
  // the status rail follows the song's major movement rather than freezing.
  if (time >= TRACK_ZERO_SECTIONS.verseStart && time < TRACK_ZERO_SECTIONS.chorusStart) {
    return pacedPlanMessage(2, time, TRACK_ZERO_SECTIONS.verseStart, TRACK_ZERO_SECTIONS.chorusStart)
  }
  if (time >= TRACK_ZERO_SECTIONS.chorusStart && time < rezaContributorTrackZeroWindow.startTime) {
    return pacedPlanMessage(1, time, TRACK_ZERO_SECTIONS.chorusStart, rezaContributorTrackZeroWindow.startTime, [0, 6])
  }
  if (time >= rezaContributorTrackZeroWindow.startTime && time < rezaContributorTrackZeroWindow.endTime) {
    return planTextAt(1, 1)
  }
  if (time >= rezaContributorTrackZeroWindow.endTime && time < rezaContributorTrackZeroWindow.endTime + 3.08) {
    return planTextAt(1, 2)
  }
  if (time >= 202.52 && time < TRACK_ZERO_SECTIONS.bridgeStart) {
    return pacedPlanMessage(1, time, 202.52, TRACK_ZERO_SECTIONS.bridgeStart, [6, 11])
  }
  if (time >= TRACK_ZERO_SECTIONS.bridgeStart && time < TRACK_ZERO_SECTIONS.buildStart) {
    return pacedPlanMessage(2, time, TRACK_ZERO_SECTIONS.bridgeStart, TRACK_ZERO_SECTIONS.buildStart, [9, 11])
  }
  if (time >= TRACK_ZERO_SECTIONS.buildStart && time < 345) {
    return pacedPlanMessage(3, time, TRACK_ZERO_SECTIONS.buildStart, 345)
  }
  if (time >= 365 && time < 408) {
    return pacedPlanMessage(4, time, 365, 408)
  }
  return DEFAULT_HUD_LABEL
}
