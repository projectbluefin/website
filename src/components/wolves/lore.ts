import type { WolvesChapter } from '../../data/wolves-story'
import { wolvesRelease } from '../../data/wolves-story'

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

// Map wolvesRelease artifacts directly to Lore Entries
export const loreEntries: WolvesLoreEntry[] = wolvesRelease.artifacts.map((artifact) => {
  if (artifact.type === 'quote') {
    const parts = (artifact.sourceLabel || artifact.title || '').split('—')
    return {
      type: 'quote',
      data: {
        quote: artifact.body,
        attribution: parts[0]?.trim() || artifact.title,
        context: parts[1]?.trim() || '',
        date: artifact.publishedAt
      }
    }
  }
  else {
    // parse body into messages
    const messageBlocks = artifact.body.split(/\n{2,}/)
    const messages = messageBlocks.map((block) => {
      // support **Speaker**: or SPEAKER:
      const match = block.match(/^(?:\*\*([^*]+)\*\*|([A-Z0-9-]+))(?:\s+\[([^\]]+)\])?:\s*(\S[\s\S]*)$/i)
      if (match) {
        return {
          speaker: (match[1] || match[2]).trim(),
          timestamp: match[3] || undefined,
          text: match[4].replace(/<br>/g, '\n').trim()
        }
      }
      return { speaker: 'SYSTEM', text: block }
    })

    return {
      type: 'conversation',
      data: {
        title: artifact.title,
        channel: artifact.channel || 'ARCHIVE//LOG',
        date: artifact.publishedAt,
        messages
      }
    }
  }
})

export function getChapterIdForLore(_entry: WolvesLoreEntry): string {
  return 'prologue'
}

export function getLoreEntriesForChapter(_chapter: WolvesChapter | undefined): WolvesLoreEntry[] {
  return loreEntries
}

export function formatQuoteSource(quote: BazziteQuote): string | null {
  return quote.context ?? null
}
