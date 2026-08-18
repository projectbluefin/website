# Wolves Director's Cut Destiny Concept Montage Design

## Goal

Add a ten-image sequence of bleak Destiny environment concept art to the
Director's Cut Gayane prologue, immediately before the Ikora-voiced Destiny
segment. The montage shows the cost of the Collapse through ruined Golden Age
ambition, Europa's ice, corrupted worlds, and wrecked ships.

The standard Wolves intro remains unchanged.

## Editorial Direction

The montage carries recurring complete thoughts from the existing authored
prologue. No new lore is written, no sentence is split across cards, and no
painting is left inside a long textless middle movement.

The selected order is:

1. `Destiny_2_Beyond_Light_Europa_Environment_01.jpg` — Europa environment
2. `mark-goldsworthy-europa-landscape-v1-copy.jpg` — abandoned Europa city
3. `destiny-2020-jessevandijk-030.jpg` — underneath Europa's ice
4. `destiny-2020-jessevandijk-010.jpg` — early Europa concept
5. `destiny-2020-jessevandijk-020.jpg` — Europa cryovolcanoes
6. `mark-goldsworthy-markg-mars-farm-collapse-concept.jpg` — Mars farm collapse
7. `mark-goldsworthy-fallen-citadel-oct-1.jpg` — Fallen Citadel
8. `destiny-2020-jessevandijk-079.jpg` — Europa ice-shelf shapes
9. `mark-goldsworthy-markg-citadel-concept.jpg` — early Throne World citadel
10. `jvd_cabalshipcrashintrohiveship_1920.jpg` — Crash

E1 is the owner-approved visual reference. The remaining selections are
credited concept paintings from Bungie artists. Gameplay screenshots,
in-engine press renders, and character key art are excluded.

## Musical Structure

The sequence is part of the full existing Gayane track, not a silent bridge and
not an overlap with the Ikora audio.

Use a hybrid crescendo:

- Images 1-5 form the Europa movement. They receive the longest holds and slow
  dissolves, with no crop motion.
- Image 6, Mars Farm Collapse, begins the acceleration from natural desolation
  into destroyed civilization.
- Images 7-9 tighten on measured musical phrases.
- Image 10, Crash, is the shortest and hardest final image before the handoff
  to the Ikora-voiced Destiny segment.

Cue boundaries are derived from the full Gayane source's measured musical
sections. Do not use equal slices or a second clock. Every cue remains driven by
the intro player's active media clock.

## Runtime Shape

Keep the sequence in the Director-specific intro data surface. Reuse the
existing `IntroOverlayTextCue` capabilities:

- `backgroundImage` for each painting;
- a complete recurring authored thought for each painting;
- `backgroundFraming: { fit: 'contain', sourceWidth, sourceHeight }` so each
  painting is framed whole at its own geometry; preserve source sharpness, never
  crop or enlarge, and never animate the frame;
- the existing background transition rather than a new gallery component.

The montage must not add controls, input requirements, scrolling, or a new
transport. The audience receives the complete sequence unattended.

## Asset Sources and Credits

Store approved assets locally at their source geometry. Do not upscale, redraw,
recolor, remove signatures, or generate derivative replacement art. Format
conversion may preserve geometry and visible content when the repository's
asset pipeline requires it.

| Image | Artist/source | Authoritative URL |
|---|---|---|
| Europa environment | Bungie Press Room | <https://press.bungie.com/Go-Beyond-the-Light-Destiny-2-Beyond-Light-Arrives-On-September-22> |
| Europa Landscape V1 | Mark Goldsworthy | <https://magazine.artstation.com/2024/09/bungie-10-year-destiny-art-blast/> |
| Underneath the ice on Europa | Jesse van Dijk | <https://www.artstation.com/jessevandijk> |
| Early Europa concept | Jesse van Dijk | <https://www.artstation.com/jessevandijk> |
| Cryovolcanoes | Jesse van Dijk | <https://www.artstation.com/jessevandijk> |
| Mars Farm Collapse | Mark Goldsworthy | <https://www.artstation.com/arasaka> |
| Fallen Citadel | Mark Goldsworthy | <https://www.artstation.com/arasaka> |
| Ice-shelf shapes | Jesse van Dijk | <https://www.artstation.com/jessevandijk> |
| Early Throne World citadel | Mark Goldsworthy | <https://www.artstation.com/arasaka> |
| Crash | Jesse van Dijk | <https://www.artstation.com/jessevandijk> |

The implementation must add a machine-readable source ledger containing the
local path, exact upstream URL, artist, work title, retrieval date, and Bungie
policy URL for every asset.

## Bungie Fan-Content Policy

The rights basis is Bungie's official non-commercial fan-created media policy:

<https://help.bungie.net/hc/en-us/articles/360049201911-Intellectual-Property-and-Trademarks>

This is not an open or irrevocable license. Bungie states that:

- the guidelines must not be interpreted as permission to use Bungie IP;
- fan-created work is shared at the creator's risk and may be removed;
- soliciting donations or monetary support is treated as commercial;
- commercial use requires Bungie's permission and a license;
- Bungie retains rights in game scenery and related assets.

This montage is allowed only under the owner's approved non-commercial
fan-content interpretation. It must not be used in a monetized presentation,
paid product, donation solicitation, merchandise, or an experience implying
Bungie sponsorship. A future commercial use requires written Bungie permission.

Credit the work without implying endorsement:

`Destiny 2 and related artwork © Bungie, Inc. Environment concept art by the credited artists.`

## Failure Behavior

- An asset without a recorded authoritative source is rejected.
- An unavailable or corrupt local asset fails validation; it is not replaced by
  another Destiny image.
- A cue that cannot fit its measured musical window is cut from the sequence
  with owner approval; images are not flashed too quickly to force ten entries.
- If the use becomes commercial or donation-supported, the montage is disabled
  until written permission is recorded.

## Verification

Automated checks must assert:

- the Director's Cut contains the exact ten images in the approved order;
- the standard intro contains none of them;
- every local path is unique and loads successfully;
- every asset has artist, source, and policy metadata;
- every montage cue carries a complete authored thought and no cue exceeds the
  projector text ceiling;
- cue windows tile their assigned Gayane interval without gaps or overlaps;
- the sequence hands off to the Ikora source without a black flash or audio
  overlap.

Chromium verification must cover:

- all ten images at a projector-sized viewport;
- crop and motion at a narrow viewport;
- source aspect ratios with no accidental stretching;
- complete Gayane playback and the final Crash-to-Ikora handoff;
- no page errors or failed asset requests.
