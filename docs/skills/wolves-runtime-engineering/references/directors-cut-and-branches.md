# Director's Cut entry points and branch archaeology

Entry points, the production wall, autoplay resilience, and how to check whether a surface already exists on another branch before rebuilding it.

Back to [`../SKILL.md`](../SKILL.md).

## Director's Cut entry points, the production wall, and autoplay resilience

The Director's Cut has two entrances, and they are gated together by
`DIRECTORS_CUT_ENABLED` in `src/config/wolves-directors-cut-gate.ts`:

1. **Lobby click** — `CinematicLobby` emits `enter-directors-cut`, which calls
   `enterIntro(null, true)`. The click satisfies browser autoplay policy.
2. **Deep link** — `/wolves/?directors-cut` auto-starts the cut on mount. This is
   intended for projection / recording workflows, but it may lack a user gesture,
   so the browser may block autoplay.

Gate both or neither. Hiding the button while the parameter still works is not a
wall: the link outlives the button in URLs, chat logs, and recording scripts.
`src/tests/wolvesDirectorsCutGate.test.ts` mocks the gate off and asserts both
entrances are shut, so the pair cannot drift apart.

The gate is `import.meta.env.DEV`, which Vite statically replaces at build time.
Verify it by inspecting the built bundle, not just the test: the deep-link branch
should be gone entirely (`URLSearchParams` drops to its one unrelated use) and the
lobby block should compile behind a literal-false condition. Dead-branch *strings*
surviving minification is expected and harmless — grep for the compiled condition,
not for the copy.

If the scored prologue's background-audio embed or the Destiny trailer video is
blocked, `currentTime` stops advancing and the show hangs. The intro overlay
handles this with two bounded fallbacks, deliberately given different thresholds
because their costs are not symmetric:

- **Text/audio segments** — `BLOCKED_AUDIO_SECONDS` (5s). A clock pinned at
  exactly `0` this long calls `releaseAudioClock()`, handing the card to its own
  wall clock. Short, because the decision is *reversible*: the existing recovery
  check snaps back to the music the instant the player's clock moves. This is not
  a second transport — it reuses the release mechanism the end-of-track backstop
  already owns, so there is still exactly one thing deciding a card is over.
- **Video segments** — `BLOCKED_VIDEO_SECONDS` (15s). Three times as long,
  because advancing *discards a segment* and cannot be taken back. It must outlast
  a cold buffer on a bad conference network, not merely a hesitation.

An ad does not look like either case: during a pre-roll the embed reports the ad's
own advancing time, so it never sits frozen on exactly `0`. A freeze *inside* the
piece is an ad and must be waited out — that is what the separate
`TEXT_SEGMENT_STALL_GRACE_SECONDS` backstop is for, and it only fires inside the
track's measured end window.

These fallbacks are last-resort unattended behavior. For normal projection, prefer
a real user gesture so the authored music and trailer play as intended.

### Testing a blocked-clock fallback

Give the card a duration comfortably longer than
`TEXT_SEGMENT_END_SLACK_SECONDS`. On a 1-second card the *whole card* is inside
the track-end window, so the stall backstop completes it at its 3s grace and the
blocked-autoplay path never runs — the test passes green while asserting nothing
about the thing it names.

## Before rebuilding a Wolves surface, look for it on another branch

This runtime is developed across several long-lived worktrees
(`git worktree list`). A surface can be fully built, measured, and tested on one
of them while `main` still shows the old version, and nothing in `main` hints
that the work exists.

That has already cost a full rebuild. The Director's Cut prologue was recut
against measured sources on `wolves/directors-cut` — full-length scored track, a
derived cue grid, a varied concept-art montage — and a later session, seeing only
`main`, rebuilt it from scratch as a short excerpt with one background image
repeated four times and hand-picked text windows. The reimplementation reproduced
the exact defects the branch had already fixed, and the two then conflicted in
five files because both had rewritten the same modules.

Before rebuilding any Wolves surface, run `git worktree list` and
`git log --oneline main..<branch>` on anything Wolves-related. If the surface
already exists elsewhere, integrate that work rather than re-authoring it: the
branch version carries measurement evidence that a fresh implementation cannot
reconstruct from the rendered result.

## A matching subject line is not matching work

The same archaeology cuts the other way once the work *has* been integrated. Four
Wolves worktrees carried commits whose subjects were identical to commits already
in the Director's Cut line — `complete Director's Cut finale remediation`,
`finish Director's Cut Track 0 remediation`, `add curated silent scene masters` —
because they had been cherry-picked or re-authored, so the subject matched while
the SHA did not.

Ask git, not the subject line:

```bash
git cherry -v <integrated-branch> <old-branch>   # '-' already applied, '+' unique
git diff --stat <integrated-branch> <old-branch>
```

`git cherry` compares patch ids, so it answers "is this content already in" for
a cherry-pick that a SHA comparison calls unique. Where it still reports `+`,
diff the trees before believing it: two of the three "unique" branches were
simply old snapshots, tens of commits behind, whose one commit had been redone
in the live line.

Retire the checkout, not the commits. `git worktree remove` deletes the working
copy and leaves the branch ref, so the history survives even for a local-only
branch — and `git branch -d` refuses anything unmerged, which makes it the safe
way to sweep the leftovers.

## Worktrees are expensive here, and the expense is not git

This repository tracks `*.mp4` through LFS, so **every worktree materialises its
own copy of the video payload** on top of `public/` and its own `node_modules`.
Six worktrees reached 8.4G, of which `.worktrees` was ~6.2G; removing three
reclaimed 3.6G without losing a single commit.

Do not reach for history surgery to fix that. Measure first — `du -sh .git/*`
separates the LFS cache from the object store — and expect both to be **live
data rather than junk**: `git lfs prune` reclaimed nothing here because every
object was still referenced, and the pack is concept-art history that only a
history rewrite could shrink, which would break every open PR. The reclaimable
space is duplicated checkouts, not the repository.

