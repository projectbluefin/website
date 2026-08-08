import type { LoreRecord } from '../../data/wolves-lore-records'
import type { LoreProject } from '../../data/wolves-projects'
import type { WolvesChapter } from '../../data/wolves-story'
import { loadAllLoreRecords } from '../../data/wolves-lore-records'
import { loadLoreProjectIndex } from '../../data/wolves-projects'
import { wolvesRelease } from '../../data/wolves-story'
import { splitLoreBlocks } from './lore/lore-pages'

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
  projects?: readonly LoreProject[]
}

export type WolvesLoreEntry
  = { id: string, chapterId: string, record: LoreRecord, type: 'quote', data: BazziteQuote }
    | { id: string, chapterId: string, record: LoreRecord, type: 'conversation', data: InterceptedConversation }

export interface LoreViewProps {
  record: LoreRecord
  records?: readonly LoreRecord[]
  duration: number
  elapsed?: number
  warning?: string
}

export const loreRecords = loadAllLoreRecords()
const loreProjectIndex = loadLoreProjectIndex()

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
    const speakerOnlyMatch = trimmedBlock.match(/^(?:\*\*([^*]+)\*\*|([A-Z0-9-]+))$/i)
    if (speakerOnlyMatch) {
      return {
        speaker: (speakerOnlyMatch[1] || speakerOnlyMatch[2]).trim(),
        text: '',
      }
    }
    return { text: trimmedBlock.replace(/<br>/g, '\n') }
  })
  const projects = record.metadata.projects?.map((projectId) => {
    const project = loreProjectIndex[projectId]
    if (!project) {
      throw new TypeError(`Lore record "${record.id}" references unknown project "${projectId}"`)
    }
    return project
  })

  return {
    title: record.metadata.title || '',
    channel: record.metadata.channel || 'ARCHIVE//LOG',
    date: record.metadata.timestamp || '',
    messages,
    projects,
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

function escapeLoreHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

/**
 * Render a lore record body as safe HTML paragraphs: escaped text with
 * authored bold markers converted to <strong>. Shared by every dossier view.
 */
export function renderLoreParagraphs(body: string): string[] {
  return body.split(/\n{2,}/).map(para =>
    escapeLoreHtml(para).replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>'),
  )
}

export interface LoreSpeakerParagraph {
  isSpeaker: boolean
  speaker: string
  /** Rendered, escaped HTML for display, without the speaker prefix. */
  text: string
  /**
   * The authored block this paragraph came from, speaker prefix included.
   *
   * Pagination measures this, never `text`. The scheduler costs the same
   * authored blocks (`loreProsePages`), so measuring anything else lets the
   * two disagree about where a long turn breaks — and every page after that
   * break then lands off the beat it was timed to. Escaping and `**bold**`
   * expansion also inflate `text` by an amount the scheduler cannot see.
   */
  source: string
}

/** Escape and convert authored inline markup to display HTML. */
function renderLoreInline(text: string): string {
  return escapeLoreHtml(text).replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
}

const LORE_SPEAKER_PATTERN = /^(?:\*\*([^*]+)\*\*|([A-Z0-9\s\-/]+)):\s*(\S[\s\S]*)$/i

/**
 * Parse a lore record body into speaker-attributed paragraphs (safe HTML),
 * for transcript-style views (news bulletins, source fragments).
 */
export function parseLoreSpeakerParagraphs(body: string): LoreSpeakerParagraph[] {
  return splitLoreBlocks(body).map((para) => {
    const match = para.match(LORE_SPEAKER_PATTERN)
    return {
      isSpeaker: Boolean(match),
      speaker: match ? (match[1] || match[2]).trim() : '',
      text: renderLoreInline(match ? match[3].trim() : para),
      source: para,
    }
  })
}

/**
 * Re-render one split fragment of a speaker paragraph for display. The
 * fragment is a slice of the authored block, so a continuation fragment has no
 * speaker prefix to strip while the first one does. `speaker` is carried
 * through either way: on a projected page every fragment has to say who is
 * talking, or the audience loses the thread of the conversation.
 */
export function rebuildLoreSpeakerParagraph(
  block: LoreSpeakerParagraph,
  part: string,
): LoreSpeakerParagraph {
  const match = part.match(LORE_SPEAKER_PATTERN)
  return { ...block, text: renderLoreInline(match ? match[3].trim() : part), source: part }
}
