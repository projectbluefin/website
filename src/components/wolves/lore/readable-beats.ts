const SENTENCE_PATTERN = /[^.!?…]+(?:[.!?…]+(?=\s|$)|$)/g

/**
 * Titles and initials that end in a period without ending a sentence. Without
 * these, "Dr. Andy Anderson" splits after "Dr." and the name lands on the next
 * page — which is how the death reveal in the closing bulletin got cut in half.
 */
const ABBREVIATION_ENDING = /(?:^|\s)(?:Dr|Mr|Mrs|Ms|Messrs|Prof|Sr|Jr|St|Lt|Sgt|Capt|Cmdr|Gen|Col|Maj|Rev|Hon|Pres|Gov|Sen|Rep|Inc|Ltd|Co|Corp|Dept|Est|vs|etc|al|approx|No|Fig|Vol|Ch|pp|Ave|Blvd|Mt|Ft|[A-Z])\.$/

/** A token that already began as "Title. Name", so the name run continues. */
const TITLED_NAME_RUN = /(?:^|\s)[A-Z][a-z]*\.\s[A-Z]/

/**
 * Words that begin a trailing phrase. Breaking a page here keeps the phrase
 * whole on the next page instead of dealing it across a page turn.
 */
const PHRASE_START = /^(?:following|of|in|on|at|with|for|from|by|after|before|during|under|over|through|into|onto|against|about|between|among|across|toward|towards|until|since|despite|within|without|upon|via|and|or|but|because|although|though|unless|while|when|where|which|that)$/i

/** Least of a beat that must survive a rebreak, so pages stay balanced. */
const MINIMUM_BEAT_SHARE = 0.5

/**
 * Function words that must never be the last thing on a page. A beat ending
 * "…the tragic death of" hands the audience a preposition and makes them wait
 * a page turn for its object.
 */
const DANGLING_TAIL = /(?:^|\s)(?:a|an|the|and|or|nor|but|of|to|in|on|at|by|for|from|with|into|onto|over|under|about|after|before|between|through|during|against|as|than|that|this|these|those|its|their|his|her|our|your|my|is|was|were|are|be|been|will|would|can|could|may|might|must|has|have|had|following)$/i

/**
 * Repair a beat that ends mid phrase by moving the whole trailing phrase onto
 * the next beat: "…sublicense the technology following the tragic death of"
 * becomes "…sublicense the technology", and the reveal travels together.
 *
 * Only beats that actually end badly are touched. A beat ending on a complete
 * thought is already a good page and is left exactly as it is.
 */
function settleBreaks(beats: readonly string[], maximumCharacters: number): string[] {
  const settled = [...beats]

  for (let index = 0; index < settled.length - 1; index += 1) {
    if (!DANGLING_TAIL.test(settled[index]!)) {
      continue
    }

    const words = settled[index]!.split(' ')
    const earliest = Math.ceil(words.length * MINIMUM_BEAT_SHARE)

    for (let cut = earliest; cut < words.length; cut += 1) {
      if (!PHRASE_START.test(words[cut]!)) {
        continue
      }

      const moved = words.slice(cut).join(' ')
      const grown = `${moved} ${settled[index + 1]}`
      if (grown.length > maximumCharacters) {
        break
      }

      settled[index] = words.slice(0, cut).join(' ')
      settled[index + 1] = grown
      break
    }
  }

  return settled
}

/**
 * Rejoin sentence fragments that were split at an abbreviation's period. A beat
 * must never end on a title, so the name it introduces stays with it.
 */
function mergeAbbreviationSplits(sentences: readonly string[]): string[] {
  const merged: string[] = []

  for (const sentence of sentences) {
    const previous = merged.at(-1)
    if (previous !== undefined && ABBREVIATION_ENDING.test(previous)) {
      merged[merged.length - 1] = `${previous} ${sentence}`
    }
    else {
      merged.push(sentence)
    }
  }

  return merged
}

/**
 * Fuse a title with the capitalised name that follows it into one unbreakable
 * token, so "Dr. Andy Anderson" is laid out as a single unit and can never be
 * dealt across two pages.
 */
function fuseTitledNames(words: readonly string[]): string[] {
  const fused: string[] = []

  for (const word of words) {
    const previous = fused.at(-1)
    const continuesName = previous !== undefined
      && (ABBREVIATION_ENDING.test(previous) || TITLED_NAME_RUN.test(previous))
      && /^[A-Z]/.test(word)

    if (continuesName) {
      fused[fused.length - 1] = `${previous} ${word}`
    }
    else {
      fused.push(word)
    }
  }

  return fused
}

function splitLongSentence(sentence: string, maximumCharacters: number): string[] {
  const words = fuseTitledNames(sentence.trim().split(/\s+/).filter(Boolean))
  const beats: string[] = []
  let beat = ''

  for (const word of words) {
    const candidate = beat ? `${beat} ${word}` : word
    if (beat && candidate.length > maximumCharacters) {
      beats.push(beat)
      beat = word
    }
    else {
      beat = candidate
    }
  }

  if (beat) {
    beats.push(beat)
  }

  return beats
}

export function splitReadableBeats(text: string, maximumCharacters: number): string[] {
  const matched = text.match(SENTENCE_PATTERN)?.map(sentence => sentence.trim()).filter(Boolean) ?? []
  const sentences = mergeAbbreviationSplits(matched)
  const source = sentences.length > 0 ? sentences : [text.trim()]
  const beats: string[] = []
  let beat = ''

  for (const sentence of source) {
    const units = sentence.length > maximumCharacters
      ? splitLongSentence(sentence, maximumCharacters)
      : [sentence]

    for (const unit of units) {
      const candidate = beat ? `${beat} ${unit}` : unit
      if (beat && candidate.length > maximumCharacters) {
        beats.push(beat)
        beat = unit
      }
      else {
        beat = candidate
      }
    }
  }

  if (beat) {
    beats.push(beat)
  }

  return settleBreaks(beats, maximumCharacters)
}
