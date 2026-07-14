# Wolves Incoming Signal Sequence

## Purpose

Make the Universal Blue thesis text editable as a plain one-message-per-line
source and cycle it after the immersive HUD becomes `Incoming Signal:
Universal Blue`.

## Source

- Add `src/data/wolves-incoming-signal.txt`.
- Each non-empty line is one message, in presentation order.
- The file is the sole editable message source. Its initial contents use the
  approved thesis phrases without ellipsis-based truncation.

## Presentation

- The existing Track 0 thesis window remains 5:45 through 7:05.
- At 5:45, the HUD changes to `Incoming Signal: Universal Blue` before the
  cycling sequence begins.
- Track 0 uses its verified 152 BPM tempo. The active line advances every
  eight soundtrack beats, starting with the first line at 5:45. The selection
  is deterministic and wraps to the first line after the final line.
- Existing day-pulse, corruption, and legend modes remain intact. During the
  active thesis window, their displayed text is supplied by the editable
  sequence.

## Data Flow

- The thesis data module imports and parses the text file into an ordered,
  immutable list of non-empty lines.
- The thesis-state resolver calculates each phrase from Track 0 playback time,
  using `floor((time - 345) * 152 / 60 / 8) % messageCount`.

## Empty Source

If the file has no non-empty lines, the thesis overlay text is blank. The HUD
and existing presentation modes remain active; the application does not create
a substitute message.

## Validation

Tests cover parsing and ordering, every-eight-beat advancement, wrapping, the
existing time window and HUD change, and preservation of the day pulse,
corruption, and legend modes. A component-level test covers forwarding the
playback beat to the thesis resolver.
