export type WolvesArtifactType = 'transmission' | 'quote' | 'news' | 'source'

export interface WolvesChapter {
  id: string
  title: string
  description: string
  pageStart: number
  pageEnd: number
  soundtrackLabel: string
}

export interface WolvesArtifact {
  id: string
  chapterId: string
  type: WolvesArtifactType
  publishedAt: string
  title: string
  body: string
  sourceUrl?: string
  sourceLabel?: string
}

export interface WolvesRelease {
  id: string
  publishedAt: string
  chapters: WolvesChapter[]
  artifacts: WolvesArtifact[]
}

export const wolvesRelease: WolvesRelease = {
  id: '2026-07-11-r1',
  publishedAt: '2026-07-11',
  chapters: [
    {
      id: 'prologue',
      title: 'The Kube',
      description: 'Who left this here?',
      pageStart: 1,
      pageEnd: 7,
      soundtrackLabel: 'The Kube',
    },
    {
      id: 'pursuit',
      title: 'The Illustrius',
      description: 'The maintainers are gods.',
      pageStart: 8,
      pageEnd: 14,
      soundtrackLabel: 'Pressure',
    },
    {
      id: 'awakening',
      title: 'The Wolves',
      description: 'The maintainers are the hunted.',
      pageStart: 15,
      pageEnd: 20,
      soundtrackLabel: 'Resistance',
    },
  ],
  artifacts: [
    // --- Prologue: transmissions ---
    {
      id: 'forbidden-factory',
      chapterId: 'prologue',
      type: 'transmission',
      publishedAt: '2326-07-09',
      title: 'Forbidden Factory',
      body: 'REDACTED: Are you still transmitting?\nNIMBINATUS: Only when the machines stop listening.\nREDACTED: Find that scientist, Europa\'s not that big, good luck.',
    },
    {
      id: 'maintenance-window',
      chapterId: 'prologue',
      type: 'transmission',
      publishedAt: '2326-06-15',
      title: 'Maintenance Window',
      body: 'RENNER: It\'s ready. We need a name before sunrise, it\'s bad luck otherwise.\nJOHN BAZZITE: Give it a name that survives the people who made it.',
    },
    {
      id: 'lorem-prologue-1',
      chapterId: 'prologue',
      type: 'transmission',
      publishedAt: '2326-06-16',
      title: 'Placeholder Transmission',
      body: 'Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.',
    },
    {
      id: 'lorem-prologue-2',
      chapterId: 'prologue',
      type: 'quote',
      publishedAt: '2326-06-17',
      title: 'Placeholder Quote',
      body: 'Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident.',
    },
    // --- Pursuit: transmissions ---
    {
      id: 'do-not-reply',
      chapterId: 'pursuit',
      type: 'transmission',
      publishedAt: '2326-05-24',
      title: 'Do Not Reply',
      body: 'UNMARKED GRAVE: Under no circumstance let the stupid one manage secrets.\nSYSTEM: MESSAGE RECEIVED. ORIGIN UNVERIFIED.',
    },
    // --- Pursuit: quotes ---
    {
      id: 'quote-natasha-woods',
      chapterId: 'pursuit',
      type: 'quote',
      publishedAt: '2326-07-09',
      title: 'Marketing Material',
      body: 'In a world of overwhelming automation, they are the light!',
      sourceLabel: 'Natasha Woods VI — CNCF Marketing Material, Circa 2349',
    },
    {
      id: 'childhoods-end-wager',
      chapterId: 'pursuit',
      type: 'transmission',
      publishedAt: '2326-07-09',
      title: 'The Wager',
      body: 'JOHN BAZZITE: Can you deny that they have brought security, peace, and prosperity to the world?\nJZB: That is true, but they have taken our liberty. Man does not live—\nJOHN BAZZITE: —by bread alone. Yes, I know—but this is the first age in which every man was sure of getting even that.',
    },
    {
      id: 'quote-childhoods-end-future',
      chapterId: 'pursuit',
      type: 'quote',
      publishedAt: '2326-07-09',
      title: 'Childhood\'s End',
      body: 'Our future\'s end. Their beginning.',
    },
    {
      id: 'quote-berkus',
      chapterId: 'pursuit',
      type: 'quote',
      publishedAt: '2326-06-15',
      title: 'The Cosmos',
      body: 'When it comes to matters of the star known as Siosm, the empires of the cosmos look to inspiration. The number of stars in the sky, uncountable.',
      sourceLabel: 'Berkus the Wise — The Cosmos, Volume 3 (Blue Universal Red Letter Edition)',
    },
    {
      id: 'quote-unmarked-grave',
      chapterId: 'pursuit',
      type: 'quote',
      publishedAt: '2326-05-24',
      title: 'The Horror of Thousands',
      body: 'Under NO CIRCUMSTANCE let the stupid one manage secrets.',
      sourceLabel: 'Unmarked Grave — Eulogy: The Horror of Thousands',
    },
    {
      id: 'quote-third-disciple',
      chapterId: 'pursuit',
      type: 'quote',
      publishedAt: '2326-05-25',
      title: 'The Chronicles of Blue Universal',
      body: 'And the people, enslaved by the Toilmaster under the boot of John Bazzite, suffered.',
      sourceLabel: 'Third Disciple of Renner — The Chronicles of Blue Universal',
    },
    {
      id: 'lorem-pursuit-1',
      chapterId: 'pursuit',
      type: 'news',
      publishedAt: '2326-05-26',
      title: 'Placeholder News',
      body: 'Sunt in culpa qui officia deserunt mollit anim id est laborum. Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.',
    },
    // --- Awakening: archival transmissions ---
    {
      id: 'reckoning-of-the-three',
      chapterId: 'awakening',
      type: 'transmission',
      publishedAt: '2326-01-01',
      title: 'Reckoning of the Three',
      body: 'HARBRINGER: You knew, the three of you always knew. Why didn\'t you stop me?\nSABOT-6: They will mourn neither of us. Finish it.',
    },
    {
      id: 'committee-report-personal-transmission',
      chapterId: 'awakening',
      type: 'transmission',
      publishedAt: '2326-01-01',
      title: 'COMMITEE REPORT: Personal Transmission',
      body: '[Redacted]: \nSPEAKER TWO: Replace this message with the reply.',
    },
    {
      id: 'john-bazzite-interview',
      chapterId: 'awakening',
      type: 'news',
      publishedAt: '2326-01-01',
      title: 'John Bazzite Exclusive Interview',
      body: 'JZB: Don\'t you think it\'s a little unreasonable to remove the infrastructure maintainers from such critical roles?\nJOHN BAZZITE: Look Joe, I\'m not the enemy. I\'m just saying we can\'t have critical mining operations around the system paralyzed because some hippie in Seattle had a bad day. The CLNKR-02 series is 10x more efficient and at a fraction of the cost.',
    },
    {
      id: 'lorem-awakening-1',
      chapterId: 'awakening',
      type: 'quote',
      publishedAt: '2326-01-02',
      title: 'Placeholder Insight',
      body: 'Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit.',
    },
    // --- Source: Ishtar Collective / Unveiling (archival) ---
    {
      id: 'ishtar-gardener-and-winnower',
      chapterId: 'awakening',
      type: 'source',
      publishedAt: '2326-01-01',
      title: 'The Garden Before Time',
      body: 'THE GARDENER: I plant possibilities and watch what they become.\nTHE WINNOWER: I separate what can endure from what cannot.\nTHE GARDENER: You call repetition perfection. I see a closed garden, unable to become anything new.',
      sourceUrl: 'https://www.ishtar-collective.net/entries/gardener-and-winnower',
    },
    {
      id: 'ishtar-flower-game',
      chapterId: 'awakening',
      type: 'source',
      publishedAt: '2326-01-01',
      title: 'Rules of the Flower Game',
      body: 'THE WINNOWER: The board is simple: isolated forms fail, balanced forms persist, crowded forms collapse, and certain empty spaces bloom again.\nTHE GARDENER: And from those few rules emerge travelers, engines, repeating forms, and worlds no player can predict without watching them unfold.\nTHE WINNOWER: The rules do not need a judge. They reveal which shapes have earned another turn.',
      sourceUrl: 'https://www.ishtar-collective.net/entries/the-flower-game',
    },
    {
      id: 'ishtar-first-knife',
      chapterId: 'awakening',
      type: 'source',
      publishedAt: '2326-01-01',
      title: 'The First Knife',
      body: 'THE GARDENER: Then add a new rule: protect the strangeness, preserve complexity, reward the whimsical. Give the game a way out of its repeating deadlock.\nTHE WINNOWER: A delay is not a victory. Anything that cannot become the final pattern is only postponing its own collapse. The Children do not understand this.\nTHE GARDENER: If the old rules cannot make room for change, I will become a rule myself.',
      sourceUrl: 'https://www.ishtar-collective.net/entries/the-first-knife',
    },
    {
      id: 'ishtar-the-wager',
      chapterId: 'awakening',
      type: 'source',
      publishedAt: '2326-01-01',
      title: 'The Wager',
      body: 'THE WINNOWER: Existence is the first proof. What cannot hold itself together has no claim, and the game is the test that separates the real from the unreal.\nTHE WINNOWER: The Gardener chose you as a final argument: power, freedom, and the chance to build something gentle without surrendering to fear or division.\nTHE WINNOWER: There is no certainty behind either of us. The universe is undecidable, and your choice is the only answer still unwritten.',
      sourceUrl: 'https://www.ishtar-collective.net/entries/the-wager',
    },
    {
      id: 'ishtar-patternfall',
      chapterId: 'awakening',
      type: 'source',
      publishedAt: '2326-01-01',
      title: 'Patternfall',
      body: 'THE WINNOWER: The patterns that escaped the garden entered a universe of fire, chaos, and desperate equations. They survived because self-preservation was already inside them.\nTHE WINNOWER: They crossed from quantum foam to comet-borne chemistry, then into oceans and the first geometric shelters. Every transformation preserved the kernel that made them victors.\nTHE WINNOWER: Victory is not destiny. The rules have changed, and even the oldest surviving pattern must learn to adapt.',
      sourceUrl: 'https://www.ishtar-collective.net/entries/patternfall',

    },
    {
      id: 'ishtar-cambrian-explosion',
      chapterId: 'awakening',
      type: 'source',
      publishedAt: '2326-01-01',
      title: 'The Cambrian Explosion',
      body: 'THE WINNOWER: A quiet garden of harmless grazers changed when one defector discovered that a neighbor could be consumed instead of merely grazed upon.\nTHE WINNOWER: Predation forced the world to invent sensors, brains, plans, speed, and muscles. Complexity did not arrive as a gift; it arrived as pressure.\nTHE WINNOWER: No creature chose the rules. The first predator simply played them more effectively, and the world became dangerous enough to become interesting.',
      sourceUrl: 'https://www.ishtar-collective.net/entries/the-cambrian-explosion',
    },
    {
      id: 'ishtar-final-shape',
      chapterId: 'awakening',
      type: 'source',
      publishedAt: '2326-01-01',
      title: 'The Final Shape',
      body: 'THE GARDENER: Every game ends with one pattern consuming the others. It is efficient, eternal, and unbearably incorrect.\nTHE WINNOWER: The winning pattern has no purpose beyond continuing. It remakes the game around its own existence and leaves no room for anything else.\nTHE GARDENER: Then the rules must change. If the old game always closes the same way, something must make room for possibility.',
      sourceUrl: 'https://www.ishtar-collective.net/entries/the-final-shape',
    },
    {
      id: 'blue-universal-acquires-wayland-yutani',
      chapterId: 'awakening',
      type: 'news',
      publishedAt: '2326-01-01',
      title: 'Blue Universal to Acquire Wayland-Yutani',
      body: 'MICHAEL: The acquisition of Wayland-Yutani by Blue Universal sent shockwaves across the system today. John Bazzite, CEO of Blue Universal, managed to outright acquire the company right under IBM\'s nose for fractions on the dollar. Competitors were quick to call foul play, citing the obvious conflict of interest between intergalactic arms conglomerates and autonomous clankers.\nMATT: It is unbelievable that our leaders let this happen. Are our supervillains getting dumber? Or are we getting dumber?\nMICHAEL: In related news, IBM Advanced Automation Systems has announced that it will sublicense the technology following the tragic death of Dr. Andy Anderson and his team in a laboratory accident earlier this year. The team was system leading in their research of autonomous clankers, truly a great loss for humanity.',
    },
  ],
}
