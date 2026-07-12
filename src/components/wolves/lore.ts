import rawBazziteQuotes from '../../data/bazzite-quotes.json'
import rawInterceptedCommunications from '../../data/intercepted-communications.json'

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

export const bazziteQuotes: BazziteQuote[] = rawBazziteQuotes
export const interceptedCommunications: InterceptedConversation[] = rawInterceptedCommunications
