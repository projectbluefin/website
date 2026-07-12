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

const rawEntries = [
  ...bazziteQuotes.map(data => ({ type: 'quote' as const, data })),
  ...interceptedCommunications.map(data => ({ type: 'conversation' as const, data })),
]

const clarkeEntries = rawEntries.filter(
  entry => entry.type === 'quote' && entry.data.attribution === 'Arthur C. Clarke'
)

const targetQuoteText = 'In the space of a few days, humanity had lost its future, for the heart of any race is destroyed, and its will to survive is utterly broken, when its children are taken from it.'

const targetEntry = clarkeEntries.find(
  entry => entry.type === 'quote' && entry.data.quote === targetQuoteText
)

const remainingClarke = clarkeEntries.filter(
  entry => !(entry.type === 'quote' && entry.data.quote === targetQuoteText)
)

const nonClarkeEntries = rawEntries.filter(
  entry => !(entry.type === 'quote' && entry.data.attribution === 'Arthur C. Clarke')
)

const loreEntries = [
  ...(targetEntry ? [targetEntry] : []),
  ...shuffleLoreEntries(remainingClarke),
  ...shuffleLoreEntries(nonClarkeEntries),
]

export function getChapterIdForLore(entry: WolvesLoreEntry): string {
  if (entry.type === 'quote') {
    const chapterIds = ['prologue', 'pursuit', 'awakening'] as const
    const quoteIndex = bazziteQuotes.findIndex(quote => quote.quote === entry.data.quote)
    if (quoteIndex === -1) {
      return 'prologue'
    }
    return chapterIds[(quoteIndex + 1) % chapterIds.length]
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
    return loreEntries
  }

  return loreEntries.filter(entry => getChapterIdForLore(entry) === chapter.id)
}

export function formatQuoteSource(quote: BazziteQuote): string | null {
  return quote.context ?? null
}
