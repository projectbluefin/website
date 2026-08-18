# Wolves Director's Cut Quality Variants Design

## Scope

Download the indexed YouTube source `h-5S82ETKvI` at its native 1080p/24 AVC
quality, then create two local-review derivatives using the approved source
ranges. Both retain the seven-clip order, hard cuts, 24 fps cadence, and
owner-authorized audio range. Neither derivative changes the Wolves website or
registers an asset.

## Outputs

- `wolves-directors-cut-master.mp4`: source-faithful 1920x1080 H.264 master
  encoded at CRF 14 with the veryslow preset and 192 kb/s AAC. It uses only
  native 1080p source frames; no synthetic detail is added.
- `wolves-directors-cut-social-10mb.mp4`: H.264/AAC social version encoded in
  two passes at 1,000 kb/s video and 160 kb/s audio, scaled to 1280x720 using
  Lanczos downscaling. Its final size must not exceed 10 MiB (10,485,760
  bytes).

## Validation

Both outputs must fully decode, have 70-second H.264 video at 24 fps, and
preserve 48 kHz stereo AAC audio. The master must be 1920x1080; the social
derivative must be 1280x720 and at or below the stated byte limit.
