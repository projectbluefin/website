/**
 * Side-by-side, ping-pong YouTube Shorts feed for the Wolves immersive theater's Creator
 * Shorts interstitial (played once, between Track 0 and Track 1 of the soundtrack).
 * Video IDs are real public Shorts/videos pulled from each creator's channel (never invented),
 * verified against YouTube's oEmbed API before being added here.
 *
 * Each creator has her own ordered list (`wolvesCreatorShortsByCreator`), played independently
 * side by side: Cassidy Williams's list on the left, Lindsay Nikole's on the right, each side
 * preloading its own next video while the other side is active. Cassidy always takes the first
 * turn. If one creator's list runs out before the other's, the remaining side keeps playing solo
 * until it also finishes.
 */

export interface WolvesCreatorShort {
  videoId: string
  title: string
  creatorName: string
  channelUrl: string
  /**
   * Most Shorts are vertical (9:16); a small number of real videos are horizontal (16:9) and
   * must be letterboxed instead of filling the vertical slot.
   */
  orientation: 'vertical' | 'horizontal'
}

export const wolvesCreatorShortsLindsayNikole: readonly WolvesCreatorShort[] = [
  { videoId: 'vHEOX5i9HBE', title: 'complete and total freaks', creatorName: 'Lindsay Nikole', channelUrl: 'https://www.youtube.com/@LindsayNikole', orientation: 'vertical' },
  { videoId: 'hqbR6Kt2McY', title: 'Animals that are METAL AS F*CK', creatorName: 'Lindsay Nikole', channelUrl: 'https://www.youtube.com/@LindsayNikole', orientation: 'horizontal' },
  { videoId: 'T8aREn47900', title: 'every single one is horrific', creatorName: 'Lindsay Nikole', channelUrl: 'https://www.youtube.com/@LindsayNikole', orientation: 'vertical' },
  { videoId: 'GjSzNxJG1dA', title: 'rocket needs some medicine', creatorName: 'Lindsay Nikole', channelUrl: 'https://www.youtube.com/@LindsayNikole', orientation: 'vertical' },
  { videoId: 'K1DJNw2zHlo', title: 'Hammerheads are getting hammered', creatorName: 'Lindsay Nikole', channelUrl: 'https://www.youtube.com/@LindsayNikole', orientation: 'vertical' },
  { videoId: 'Xz8kStQDgUI', title: 'this is INSANE.', creatorName: 'Lindsay Nikole', channelUrl: 'https://www.youtube.com/@LindsayNikole', orientation: 'vertical' },
  { videoId: 'GnBTGEvOuRk', title: 'a gargantuan snack', creatorName: 'Lindsay Nikole', channelUrl: 'https://www.youtube.com/@LindsayNikole', orientation: 'vertical' },
  { videoId: 'CqyzFjfmLhU', title: 'this is a real seal', creatorName: 'Lindsay Nikole', channelUrl: 'https://www.youtube.com/@LindsayNikole', orientation: 'vertical' },
] as const

export const wolvesCreatorShortsCassidyWilliams: readonly WolvesCreatorShort[] = [
  { videoId: 'e6GCa-E75uk', title: 'My meeting persona vs my quiet working persona', creatorName: 'Cassidy Williams', channelUrl: 'https://www.youtube.com/@cassidoo', orientation: 'vertical' },
  { videoId: 'Ffhu6TLyuuY', title: 'The boss always knows', creatorName: 'Cassidy Williams', channelUrl: 'https://www.youtube.com/@cassidoo', orientation: 'vertical' },
  { videoId: 'cLd205w04do', title: 'Where are the tests', creatorName: 'Cassidy Williams', channelUrl: 'https://www.youtube.com/@cassidoo', orientation: 'vertical' },
  { videoId: 'xCjuz1Q4qbE', title: 'I accidentally discovered a clustering algorithm with Magna-Tiles', creatorName: 'Cassidy Williams', channelUrl: 'https://www.youtube.com/@cassidoo', orientation: 'vertical' },
  { videoId: 'yvhbINxBR6k', title: 'Beyonce knows eslint', creatorName: 'Cassidy Williams', channelUrl: 'https://www.youtube.com/@cassidoo', orientation: 'vertical' },
  { videoId: 'cIaNRGkZQdM', title: 'React is like paella', creatorName: 'Cassidy Williams', channelUrl: 'https://www.youtube.com/@cassidoo', orientation: 'vertical' },
] as const

/** Ping-pong turn order: Cassidy's list on the left, Lindsay's on the right, Cassidy first. */
export const wolvesCreatorShortsByCreator = [
  wolvesCreatorShortsCassidyWilliams,
  wolvesCreatorShortsLindsayNikole,
] as const
