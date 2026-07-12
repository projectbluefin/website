import type { WolvesChapter } from '../../data/wolves-story'
import rawBazziteQuotes from '../../data/bazzite-quotes.json'
import rawInterceptedCommunications from '../../data/intercepted-communications.json'
import { shuffleLoreEntries } from '../../utils/loreRotation'

export interface BazziteQuote {
  quote: string
  attribution: string
  context?: string
  date?: string
}

export interface InterceptedMessage {
  speaker: string
  text: string
  timestamp?: string
}

export interface InterceptedConversation {
  title: string
  channel: string
  date: string
  sourceTitle?: string
  sourceCollection?: string
  sourceUrl?: string
  attribution?: string
  messages: InterceptedMessage[]
}

export type WolvesLoreEntry
  = { type: 'quote', data: BazziteQuote }
    | { type: 'conversation', data: InterceptedConversation }

export const bazziteQuotes: BazziteQuote[] = rawBazziteQuotes
export const interceptedCommunications: InterceptedConversation[] = rawInterceptedCommunications

const loreEntries = shuffleLoreEntries([
  ...bazziteQuotes.map(data => ({ type: 'quote' as const, data })),
  ...interceptedCommunications.map(data => ({ type: 'conversation' as const, data })),
])

export function getChapterIdForLore(entry: WolvesLoreEntry): string {
  if (entry.type === 'quote') {
    return 'pursuit'
  }

  const title = entry.data.title
  if (title === 'Forbidden Factory' || title === 'Maintenance Window') {
    return 'prologue'
  }
  if (title === 'Do Not Reply' || title === 'Childhood\'s End Wager') {
    return 'pursuit'
  }

  return 'awakening'
}

export function getLoreEntriesForChapter(chapter: WolvesChapter | undefined): WolvesLoreEntry[] {
  if (!chapter) {
    return []
  }

  return loreEntries.filter(entry => getChapterIdForLore(entry) === chapter.id)
}

export function formatQuoteSource(quote: BazziteQuote): string | null {
  return quote.context ?? null
}
