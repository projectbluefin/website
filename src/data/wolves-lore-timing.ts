import {
  estimatePageSeconds,
  estimatePagesSeconds,
  loreChatPages,
  loreProsePages,
} from '../components/wolves/lore/lore-pages'

export interface LoreTimingInput {
  kind: 'quote' | 'chatlog' | 'prose'
  body: string
  attribution?: string
}

export interface LoreTimingSlot {
  id: string
  startTime: number
  endTime: number
  duration: number
  /** One complete, fully-held page: the least this record can be given. */
  minimumDuration: number
  /** Every authored page held for its full reading cost. */
  idealDuration: number
  pageCount: number
}

/** Hold after a conversation's last line, before its slot releases. */
export const CHAT_COMPLETION_PAUSE_SECONDS = 5

/** The pages a record shows, in order, using the shared page model. */
export function loreRecordPages(input: LoreTimingInput): string[] {
  return input.kind === 'chatlog'
    ? loreChatPages(input.body)
    : loreProsePages(input.body)
}

/**
 * Cost of showing every authored page of a record at a theater-readable pace.
 * The renderer costs its own pages with the same functions, so a slot and what
 * it displays never disagree.
 */
export function estimateLoreReadDuration(input: LoreTimingInput): number {
  const pages = loreRecordPages(input)
  const pauseSeconds = input.kind === 'chatlog'
    ? CHAT_COMPLETION_PAUSE_SECONDS
    : 0
  return estimatePagesSeconds(pages) + pauseSeconds
}

/** Cost of the single page a record is guaranteed, fully held. */
export function estimateLoreMinimumDuration(input: LoreTimingInput): number {
  const [firstPage] = loreRecordPages(input)
  return estimatePageSeconds(firstPage ?? input.body)
}

interface LoreTimingPlan {
  id: string
  pageCount: number
  minimum: number
  ideal: number
}

function planLoreRecord(entry: LoreTimingInput & { id: string }): LoreTimingPlan {
  const pages = loreRecordPages(entry)
  const pauseSeconds = entry.kind === 'chatlog'
    ? CHAT_COMPLETION_PAUSE_SECONDS
    : 0
  return {
    id: entry.id,
    pageCount: Math.max(1, pages.length),
    minimum: estimatePageSeconds(pages[0] ?? entry.body),
    ideal: estimatePagesSeconds(pages) + pauseSeconds,
  }
}

/**
 * Allocate a narrative range in whole readable pages.
 *
 * Every record is first given one complete, fully-held page; whatever the
 * range has left is spent extending records toward their full page sequence.
 * A range whose one-page floors already exceed it is oversubscribed authored
 * content, not a scheduling problem: the shortfall stays visible as
 * `minimumDuration` above `duration` rather than being hidden by silently
 * flooring records at an unreadable constant.
 */
export function allocateLoreSlots(
  entries: readonly (LoreTimingInput & { id: string })[],
  startTime: number,
  endTime: number,
  _lockedAnchors: ReadonlyMap<string, number> = new Map(),
): LoreTimingSlot[] {
  const plans = entries.map(planLoreRecord)
  const available = Math.max(0, endTime - startTime)
  const minimumTotal = plans.reduce((sum, plan) => sum + plan.minimum, 0)
  const idealTotal = plans.reduce((sum, plan) => sum + plan.ideal, 0)

  let durations: number[]
  if (idealTotal > 0 && available >= idealTotal) {
    const bonus = available - idealTotal
    durations = plans.map(plan => plan.ideal + bonus * (plan.ideal / idealTotal))
  }
  else if (minimumTotal > 0 && available >= minimumTotal) {
    const growth = idealTotal - minimumTotal
    const scale = growth > 0
      ? (available - minimumTotal) / growth
      : 0
    durations = plans.map(plan => plan.minimum + (plan.ideal - plan.minimum) * scale)
  }
  else {
    const scale = minimumTotal > 0
      ? available / minimumTotal
      : 0
    durations = plans.map(plan => plan.minimum * scale)
  }

  let cursor = startTime
  return plans.map((plan, index) => {
    const duration = durations[index]!
    const slot: LoreTimingSlot = {
      id: plan.id,
      startTime: cursor,
      endTime: cursor + duration,
      duration,
      minimumDuration: plan.minimum,
      idealDuration: plan.ideal,
      pageCount: plan.pageCount,
    }
    cursor += duration
    return slot
  }).map((slot, index, slots) => index === slots.length - 1
    ? { ...slot, endTime }
    : slot)
}
