# Staging and composition

What a harness cannot tell you about the stage, how the finale owns the frame, how projected narration is set, and spending an image once.

Back to [`../SKILL.md`](../SKILL.md).

## A passing geometry harness is not a picture of the stage

Every measurement can be right while the audience sees nothing. Three defects in
one session all reported green from assertions that were themselves correct:

- A panel was mounted, sized to the pixel, positioned in the right corner and
  reported `opacity: 1` — and was invisible, because its ancestor
  `.wc-trackzero` carries `z-index: 10` **and** `contain: layout paint`. Either
  alone confines every descendant to a stacking context below the finale's
  `z-index: 40`, so no `z-index` on the panel itself can lift it over the
  Collapse plate. `getBoundingClientRect()` cannot see paint order.
- The Collapse cross-fade ran *backwards* on stage while every clock assertion
  passed, because the two plates shipped named the wrong way round:
  `bluefin-collapse-night.webp` was the warm sunset and
  `bluefin-collapse-day.webp` was the grey moonlit scene. "Night opacity is
  1.000 at the Become Legend cue" was true and the scene still brightened into
  the closing quote. `wolves-directors-cut-finale.mjs` now decodes both plates
  in the browser and fails if the day plate is the darker one; correct the
  *files* rather than crossing the constants, or the next reader inherits a
  trap.
- A full-stage overlay (`.wc-thesis`) rendered at panel scale and spilled out of
  it, because it lives inside the viewer that was being resized.

So: `WOLVES_SHOT_DIR=/var/tmp/website-agent/finale` writes a screenshot of every
probed anchor from `tests/wolves-directors-cut-finale.mjs`. Look at them. The
assertions answer "is it in the right place"; only the picture answers "can the
back row see it at all".

Two harness details this uncovered, worth keeping in mind whenever a finale
surface animates:

- CSS transitions run on wall-clock time from whenever the class landed, not on
  the show clock. A performance never seeks, but a harness that jumps between
  anchors every few hundred milliseconds re-enters the transition constantly and
  samples mid-motion. Wait for the geometry to stop changing before measuring.
- Never run two browser harnesses against one dev server at the same time; they
  drive the same page and the loser reports phantom failures.

## The finale owns the frame, and that is a composition decision

The ordinary schedule is taken down at `DIRECTORS_CUT_FINALE_START`, not covered
and not shrunk. Keeping it alive through the finale as a small bottom-left panel
mirroring the companion video was built, measured and rejected on sight: beside
the Collapse fade and the closing quote it is one moving picture too many, and a
deck still cutting under the last line reads as something that failed to stop
rather than something that ended.

If that comes up again, the answer is the schedule ends on the finale beat and
the finale carries the rest of the song alone. The reservation in
`DIRECTORS_CUT_RESERVED_FINALE_INTERVAL` is what enforces it, and it is
open-ended on purpose.

## Projected narration is set in lines, not sentences

The prologue type is Michroma across 90vw. Michroma is an extremely wide face,
so a 55-character sentence handed to it as one paragraph fills the frame edge to
edge and wraps wherever the box runs out. From a theater seat that reads as a
wall of text, not a line of narration: the back row is still parsing line one
when the cue changes.

Author the line breaks. Every cue in `wolves-directors-cut-intro.ts` is a
template literal broken at its own phrase boundaries, and
`.wolves-intro-overlay-text` carries `white-space: pre-line` to preserve them.
`DIRECTORS_CUT_MAX_CUE_WORDS` still governs the whole cue — breaking a line does
not license a longer thought.

This does not conflict with "do not invent lore". The *words* are authored
content and may not change; *where a line ends* is a projection decision.
`wolvesDirectorsCutIntro.test.ts` checks both independently: the exact form pins
the breaks, and a whitespace-normalized form pins the wording, so re-cutting a
line passes and editing a word fails.

## Spend an image once, where it means something

The Collapse used to sit under the whole of the prologue's Act I — marks 3-6,
33.03 s to 98.71 s — which put the show's ending on stage a minute into it and
left the finale nothing to arrive at. It plays once now, on the final crescendo,
as the day-to-night `backgroundCrossfade` it always should have been, and the
closing title holds the night plate rather than cutting away from it.

Two rules fell out of that and are enforced by tests:

- Nothing in the prologue may show an unrelated Bluefin desktop wallpaper. Act I
  rode `img/wallpapers/bluefin-06-day/night.webp`, which has no place in this
  story. Every prologue image is approved Destiny concept art or the Collapse.
- "Has a background" cannot be spelled `Boolean(cue.backgroundImage)` any more,
  because a crossfade carries a pair and no single image. A test written that
  way scores a dissolving scene as a black frame.

