/**
 * Authored per-segment CNCF team chat log.
 *
 * Content boundary: this data is a distinct layer from the top HUD
 * communications (`WolvesThesisState.hudLabel`), the lower thesis overlay
 * (`WolvesThesisState.text`), and lore records. Agents never write chat
 * dialogue here — the empty message lists below are intentional authorized
 * content slots waiting on user-authored lines, not generated placeholders.
 */

export interface WolvesTeamChatMessage {
  atSeconds: number
  speaker: string
  text: string
}

export interface WolvesTeamChatSequence {
  messages: readonly WolvesTeamChatMessage[]
  finalMessageEndsAtSeconds: number
}

/** Seconds the chat log takes to fade to zero after the final authored message ends. */
export const WOLVES_TEAM_CHAT_FADE_SECONDS = 4

export const WOLVES_TEAM_CHATS: Readonly<Record<string, WolvesTeamChatSequence>> = {
  'ghosts-in-the-mist': { messages: [], finalMessageEndsAtSeconds: 0 },
  'tonight-we-must-be-warriors': { messages: [], finalMessageEndsAtSeconds: 0 },
  'not-your-monster': { messages: [], finalMessageEndsAtSeconds: 0 },
  'end-of-you': { messages: [], finalMessageEndsAtSeconds: 0 },
  'soulbound': { messages: [], finalMessageEndsAtSeconds: 0 },
  'last-ride-of-the-day': { messages: [], finalMessageEndsAtSeconds: 0 },
}

/** Messages whose authored timestamp has been reached by the real player clock. */
export function getVisibleWolvesTeamChatMessages(
  sequence: WolvesTeamChatSequence,
  elapsedSeconds: number,
) {
  return sequence.messages.filter(message => elapsedSeconds >= message.atSeconds)
}

/** Full opacity through the final message, then a linear fade over the fade window. */
export function getWolvesTeamChatOpacity(
  sequence: WolvesTeamChatSequence,
  elapsedSeconds: number,
) {
  if (sequence.messages.length === 0) {
    return 0
  }
  if (elapsedSeconds <= sequence.finalMessageEndsAtSeconds) {
    return 1
  }
  return Math.max(
    0,
    1 - (elapsedSeconds - sequence.finalMessageEndsAtSeconds) / WOLVES_TEAM_CHAT_FADE_SECONDS,
  )
}
