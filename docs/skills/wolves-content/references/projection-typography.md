# Projection typography

How Wolves text is paged, measured, and fitted so the back row can read it. Loaded from the `wolves-content` skill when a change affects how words are set on screen.

Back to [`../SKILL.md`](../SKILL.md).

## Pages break at thoughts, not at character counts

`splitReadableBeats()` splits on sentence punctuation and then on a character
budget. Left alone, that budget breaks wherever the count runs out — after
`Dr.`, or on a stranded preposition. Both happened in the closing bulletin and
between them they cut the show's central reveal into pieces.

`readable-beats.ts` guards this in three stages:

- `mergeAbbreviationSplits()` rejoins sentences split at a title's period.
- `fuseTitledNames()` fuses a title with the capitalised words after it into one
  unbreakable token, so "Dr. Andy Anderson" is laid out as a single unit.
- `settleBreaks()` repairs a page that ends on a dangling function word by
  moving the whole trailing phrase to the next page. It only touches pages that
  end badly; a page ending on a complete thought is already a good page.

The measurable target: **no page ends on a dangling function word.** At the time
of writing that holds for all 338 pages in the show.

When touching this file, verify no page overflows its budget afterwards. A fuse
that is too greedy silently produces pages too tall to read from the back row:

```bash
npx vite-node <probe that pages every record and compares against
PROSE_PAGE_CHARACTERS / CHAT_PAGE_CHARACTERS>
```

At the time of writing: 338 pages, zero over budget, zero ending on a dangling
word, worst page 150 characters against a 190 budget.

`src/tests/wolvesFinaleReveal.test.ts` asserts the dangling-word rule across
every record, so a greedy change to the splitter fails immediately.

## A photo that is the slide needs different fitting than a backdrop

`.wolves-intro-overlay-background` sets `object-fit: cover`. That is right for a
backdrop and wrong when the photo is the subject. Cover scales the image to fill
the frame and throws away whatever overflows, so a 3:2 stage photo in a 16:9
frame loses its top and bottom, which is exactly where a speaker's gesture and
headroom live.

`contain` fixes landscape but destroys portrait: in a tall phone viewport the
same photo shrinks to a stamp floating in black. Scope it:

- Default (portrait) keeps `cover` with `object-position` biased up the frame, so
  the crop lands on the subject rather than the ceiling.
- `@media (min-aspect-ratio: 4 / 3)` switches to `contain`. That is the projector
  case, and the pillarbox reads as intentional letterboxing on a dark stage.

Check both orientations. A landscape screenshot cannot show you the portrait
failure, and the portrait failure is the ugly one.

## Projected body copy is capped by measure, not by container width

The plate is as wide as the frame allows, but the text must not be. At `68rem`
of container the title card body ran to roughly 90 characters per line; an
audience tracks about 50 to 75. Cap the paragraph itself with `max-width` in
`ch` and centre it with `margin: 0 auto`, leaving the panel free to stay wide.

Add `text-wrap: balance` to the paragraph. Without it the last line collapses to
a one-word orphan, which is the most distracting artefact in projected text.

`balance` has a trap: Chromium applies it only to blocks of **six lines or
fewer** and silently falls back to normal wrapping above that. It costs nothing
and warns about nothing, so a beat that grows past six lines loses the balancing
without any visible signal in the source. If a paragraph outgrows that budget,
either split it into another beat or switch that rule to `text-wrap: pretty`,
which has no line cap but only tidies the last few lines.

Measure the result in the browser rather than trusting the CSS: divide
`getBoundingClientRect().height` by the computed `line-height` for the line
count, then divide the character count by that. Assert both the count and the
resulting characters-per-line for every beat at both orientations.

## An overlay panel can hold contrast without painting a box

A solid `background-color` plus a border plus a drop shadow reads as a lit UI
box sitting on top of the picture. To recede while staying legible, replace the
flat fill with a `radial-gradient` that falls off toward the panel edges, drop
the border and the shadow to `0`/`none`, and raise `backdrop-filter: blur()`.
Contrast then comes from the blur and the existing `text-shadow` instead of from
an opaque rectangle.

## Allocating readability inside a locked range

- Fast music or slideshow slots must not accelerate ordinary chat typing; keep
  explicitly approved dialogue cadence anchors unchanged.
- For a locked chat window, use its full player-clock duration when it exceeds
  the minimum readability estimate. This retains the final sentence through
  the authored endpoint instead of releasing a couch-readable chat early.
- When a narrative range is constrained, allocate chatlog readability before
  static quote or source records; preserve explicitly approved cadence locks.
- Derive Track 0's rotating HUD queue directly from the authored plan and keep
  duplicate status lines; deduping breaks the approved finale cadence.


