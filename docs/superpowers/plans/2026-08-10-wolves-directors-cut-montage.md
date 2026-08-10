# Wolves Director's Cut Montage Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Render a 70-second local-review-only Wolves Director's Cut montage
from the seven approved storyboard clips with the owner-authorized local remix
track.

**Architecture:** FFmpeg's concat demuxer supplies the seven unchanged clip
streams in storyboard order. Homebrew FFmpeg maps that video with a 70-second
audio range, starting at 08:17, from the owner-authorized local Wolves remix
source, then encodes a compatible H.264/AAC review artifact without touching
the Wolves website or its media registry.

**Tech Stack:** FFmpeg 7.1+, FFprobe, H.264 (`libx264`), AAC.

## Global Constraints

- Preserve each supplied storyboard filename and its embedded original-source
  timestamp; do not rename, regenerate, move, or replace source clips.
- Use the supplied clip order with hard cuts only: no transitions, overlays,
  titles, effects, speed changes, or authored copy.
- Remove all source audio.
- Render 640x360 video at 24 fps with an AAC audio stream and a total duration
  of 70 seconds.
- Use `/var/home/jorge/Videos/wolves-directors-cut/Beauty Of The Beast
  [X3WrCzLIIvk].webm` as the owner-authorized local remix source, starting its
  audio at source timestamp 08:17. Do not download media.
- The artifact is `local review` only and must not change the Wolves website,
  register an asset, or imply approval for integration.

---

## File structure

| Path | Responsibility |
|---|---|
| `/var/home/jorge/Videos/wolves-directors-cut/h-5S82ETKvI_*.mp4` | Immutable source clips, identified by storyboard filename. |
| `/var/tmp/website-agent/wolves-directors-cut-concat.txt` | Temporary FFmpeg concat manifest. Remove after rendering. |
| `/var/home/jorge/Videos/wolves-directors-cut/Beauty Of The Beast [X3WrCzLIIvk].webm` | Owner-authorized local remix source. |
| `/var/home/jorge/Videos/wolves-directors-cut/wolves-directors-cut-mockup.mp4` | Local-review output artifact. |

### Task 1: Render the scored storyboard montage

**Files:**
- Create: `/var/tmp/website-agent/wolves-directors-cut-concat.txt`
- Create: `/var/home/jorge/Videos/wolves-directors-cut/wolves-directors-cut-mockup.mp4`
- Delete: `/var/tmp/website-agent/wolves-directors-cut-concat.txt`

**Interfaces:**
- Consumes: Seven 640x360, 24 fps storyboard clips with the exact filenames
  listed in the manifest below, plus the owner-authorized local remix source.
- Produces: `wolves-directors-cut-mockup.mp4`, a 70-second, 640x360, 24 fps
  H.264 video with 48 kHz stereo AAC audio beginning at source timestamp
  08:17 of the authorized remix.

- [ ] **Step 1: Verify every source clip exists and has the expected video stream**

  Run:

  ```bash
  cd /var/home/jorge/Videos/wolves-directors-cut
  for clip in \
    h-5S82ETKvI_0000-0015.mp4 \
    h-5S82ETKvI_0019-0027.mp4 \
    h-5S82ETKvI_0030-0055.mp4 \
    h-5S82ETKvI_0060-0066.mp4 \
    h-5S82ETKvI_0069-0075.mp4 \
    h-5S82ETKvI_0082-0088.mp4 \
    h-5S82ETKvI_0104-0108.mp4
  do
    ffprobe -v error -select_streams v:0 \
      -show_entries stream=codec_name,width,height,r_frame_rate \
      -of default=noprint_wrappers=1 "$clip"
  done
  ```

  Expected: Seven video-stream reports, each showing `width=640`,
  `height=360`, and `r_frame_rate=24/1`.

- [ ] **Step 2: Create the ordered temporary concat manifest**

  Run:

  ```bash
  mkdir -p /var/tmp/website-agent
  cat > /var/tmp/website-agent/wolves-directors-cut-concat.txt <<'EOF'
  file '/var/home/jorge/Videos/wolves-directors-cut/h-5S82ETKvI_0000-0015.mp4'
  file '/var/home/jorge/Videos/wolves-directors-cut/h-5S82ETKvI_0019-0027.mp4'
  file '/var/home/jorge/Videos/wolves-directors-cut/h-5S82ETKvI_0030-0055.mp4'
  file '/var/home/jorge/Videos/wolves-directors-cut/h-5S82ETKvI_0060-0066.mp4'
  file '/var/home/jorge/Videos/wolves-directors-cut/h-5S82ETKvI_0069-0075.mp4'
  file '/var/home/jorge/Videos/wolves-directors-cut/h-5S82ETKvI_0082-0088.mp4'
  file '/var/home/jorge/Videos/wolves-directors-cut/h-5S82ETKvI_0104-0108.mp4'
  EOF
  ```

  Expected: The manifest contains seven `file` lines in the approved
  chronological order.

- [ ] **Step 3: Render the scored H.264/AAC review artifact**

  Run:

  ```bash
  /home/linuxbrew/.linuxbrew/bin/ffmpeg -y \
    -f concat -safe 0 \
    -i /var/tmp/website-agent/wolves-directors-cut-concat.txt \
    -ss 497 -t 70 \
    -i '/var/home/jorge/Videos/wolves-directors-cut/Beauty Of The Beast [X3WrCzLIIvk].webm' \
    -map 0:v:0 -map 1:a:0 \
    -c:v libx264 -preset medium -crf 18 -pix_fmt yuv420p -r 24 \
    -c:a aac -b:a 192k -t 70 -movflags +faststart \
    /var/home/jorge/Videos/wolves-directors-cut/wolves-directors-cut-mockup.mp4
  ```

  Expected: FFmpeg exits successfully and writes the output file. Its video
  contains the seven source ranges with no inserted transition frames; its
  audio is the authorized local source from 08:17 through 09:27.

- [ ] **Step 4: Verify the rendered media properties and decode it fully**

  Run:

  ```bash
  output=/var/home/jorge/Videos/wolves-directors-cut/wolves-directors-cut-mockup.mp4
  ffprobe -v error \
    -show_entries format=duration:stream=codec_type,codec_name,width,height,r_frame_rate,sample_rate,channels \
    -of default=noprint_wrappers=1 "$output"
  ffmpeg -v error -i "$output" -f null -
  ```

  Expected: Duration is 70 seconds (within one frame), video is H.264 at
  640x360 and 24 fps, audio is AAC at 48 kHz stereo, and the complete decode
  emits no errors.

- [ ] **Step 5: Remove the temporary concat manifest**

  Run:

  ```bash
  rm /var/tmp/website-agent/wolves-directors-cut-concat.txt
  ```

  Expected: Only the review artifact remains; no temporary render inputs are
  left in the source-clip directory.
