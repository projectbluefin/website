import type { LoreRecord } from '../../data/wolves-lore-records'
import type { WolvesChapter } from '../../data/wolves-story'
import { loadAllLoreRecords } from '../../data/wolves-lore-records'
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
  = { id: string, chapterId: string, record: LoreRecord, type: 'quote', data: BazziteQuote }
    | { id: string, chapterId: string, record: LoreRecord, type: 'conversation', data: InterceptedConversation }

export interface LoreViewProps {
  record: LoreRecord
  records?: readonly LoreRecord[]
  duration: number
  warning?: string
}

export const loreRecords = loadAllLoreRecords()

function artifactFor(record: LoreRecord) {
  return wolvesRelease.artifacts.find(artifact => artifact.id === record.id)
}

export function getQuoteLore(record: LoreRecord): BazziteQuote {
  const attribution = record.metadata.attribution
  if (!attribution?.trim()) {
    throw new TypeError(`Quote lore record "${record.id}" is missing authored attribution`)
  }

  return {
    quote: record.body,
    attribution,
    context: record.metadata.context,
    date: record.metadata.timestamp,
  }
}

export function getChatlogLore(record: LoreRecord): InterceptedConversation {
  const normalizedBody = record.body.replace(/\n(?=(?:\*\*[^*]+\*\*|[A-Z0-9-]+)(?:\s+\[[^\]]+\])?:|<[^>]+>)/gi, '\n\n')
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
    title: record.metadata.title || '',
    channel: record.metadata.channel || 'ARCHIVE//LOG',
    date: record.metadata.timestamp || '',
    messages
  }
}

export function getSourceProvenance(record: LoreRecord): string | undefined {
  return artifactFor(record)?.sourceUrl ?? record.metadata.sender
}

export const loreEntries: WolvesLoreEntry[] = loreRecords.map((record) => {
  if (record.kind === 'quote') {
    return {
      id: record.id,
      chapterId: record.chapterId,
      record,
      type: 'quote',
      data: getQuoteLore(record),
    }
  }

  return {
    id: record.id,
    chapterId: record.chapterId,
    record,
    type: 'conversation',
    data: getChatlogLore(record),
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
