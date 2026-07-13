import type { WolvesChapter } from '../../data/wolves-story'
import { wolvesRelease } from '../../data/wolves-story'

export interface BazziteQuote {
  quote: string
  attribution: string
  context?: string
  date?: string
}

export interface InterceptedMessage {
  speaker?: string
  text: string
  timestamp?: string
  isSfx?: boolean
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
  = { id: string, chapterId: string, type: 'quote', data: BazziteQuote }
    | { id: string, chapterId: string, type: 'conversation', data: InterceptedConversation }

// Map wolvesRelease artifacts directly to Lore Entries
export const loreEntries: WolvesLoreEntry[] = wolvesRelease.artifacts.map((artifact) => {
  if (artifact.type === 'quote') {
    const parts = (artifact.sourceLabel || artifact.title || '').split('—')
    return {
      id: artifact.id,
      chapterId: artifact.chapterId,
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
    // To support legacy files that only use single newlines between speakers or SFX,
    // we normalize them by inserting a double newline before any recognized speaker or SFX tag.
    const normalizedBody = artifact.body.replace(/\n(?=(?:\*\*[^*]+\*\*|[A-Z0-9-]+)(?:\s+\[[^\]]+\])?:|<[^>]+>)/gi, '\n\n')
    const messageBlocks = normalizedBody.split(/\n{2,}/)
    const messages = messageBlocks.map((block) => {
      const trimmedBlock = block.trim()
      const sfxMatch = trimmedBlock.match(/^<([^>]+)>$/)
      if (sfxMatch) {
        return {
          isSfx: true,
          text: sfxMatch[1].trim()
        }
      }

      // support **Speaker**: or SPEAKER:
      const match = trimmedBlock.match(/^(?:\*\*([^*]+)\*\*|([A-Z0-9-]+))(?:\s+\[([^\]]+)\])?:\s*(\S[\s\S]*)$/i)
      if (match) {
        return {
          speaker: (match[1] || match[2]).trim(),
          timestamp: match[3] || undefined,
          text: match[4].replace(/<br>/g, '\n').trim()
        }
      }
      return { text: trimmedBlock.replace(/<br>/g, '\n') }
    })

    return {
      id: artifact.id,
      chapterId: artifact.chapterId,
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

export function getChapterIdForLore(entry: WolvesLoreEntry): string {
  return entry.chapterId
}

export function getLoreEntriesForChapter(chapter: WolvesChapter | undefined): WolvesLoreEntry[] {
  if (!chapter) {
    return loreEntries
  }
  return loreEntries.filter(entry => entry.chapterId === chapter.id)
}

export function formatQuoteSource(quote: BazziteQuote): string | null {
  return quote.context ?? null
}
