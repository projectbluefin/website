# Specification: CNCF Flickr Slideshow with High-Fidelity Tempo Matching

Date: 2026-07-12
Status: Draft
Scope: Repository

This document specifies the technical design for introducing a dynamic slideshow of the CNCF Flickr photostream during the "Seven Days to the Wolves" immersive experience. The slideshow is active for all soundtrack songs after the first track (indices 1-6) and uses real-time, beat-locked tempo matching mapped to the unique emotion of each song.

---

## 1. Data Pipeline: Flickr Photo Harvesting

We will implement an automated build-time pipeline that harvests public photo references from the CNCF Flickr account and caches them as a lightweight, static JSON asset. This avoids large downloads, repository bloat, runtime CORS failures, and unstable client-side dependencies.

### 1.1 Source Account Information
* **Account Name:** Cloud Native Computing Foundation
* **Flickr User NSID:** `143247548@N03`
* **Official Client API Key:** `49dc70cc62bfcbcde55883993d9121ce` (the public site key used in official Flickr page scripts).

### 1.2 Automated Build-Time Script
* **Location:** `scripts/update-flickr-photos.js`
* **Behavior:**
  1. Queries the `flickr.people.getPublicPhotos` endpoint for user `143247548@N03` with a page size of 500 photos.
  2. Parses each photo object to extract:
     * `id`: The unique photo ID.
     * `secret`: The cryptographic secret to construct the image URL.
     * `server`: The server ID where the photo is stored.
     * `title`: The title of the photo.
  3. Writes the compiled array of photo references to `public/flickr-photos.json` in the following format:
     ```json
     [
       {
         "id": "55385931336",
         "server": "65535",
         "secret": "582a6e792f",
         "title": "KubeCon + CloudNativeCon India 2026 - Day 2..."
       }
     ]
     ```
  4. Includes error boundaries to fail gracefully and preserve previous cache states if the network is unavailable.

### 1.3 CI/CD Integration
* **Trigger:** Add `node scripts/update-flickr-photos.js` to `.github/workflows/update-content.yml` daily schedule.
* **Cache/Deploy:** Save `public/flickr-photos.json` to the action cache and restore it in the deployment workflow (`deploy.yml`) to keep the JSON asset deployed on production.

---

## 2. Music Metadata & Track Skipping Controls

We will augment the local soundtrack playlist with emotional pacing configurations and introduce manual track skip buttons to allow users to navigate easily between tracks.

### 2.1 Extended Soundtrack Model
In `public/wolves-playlist.json` (and `src/data/wolves-soundtrack.ts`), each track in the `tracks` array is extended with tempo attributes:
* `bpm`: Beats Per Minute of the song.
* `phraseBeats`: Number of beats to hold a slide (tempo-matched pacing block).
* `fadeDuration`: Time in milliseconds to crossfade between images.

The emotional configuration is mapped as follows:
* **Track 0 (Nightwish - 7 Days to the Wolves):** Handled as story lore (unaffected, tempo is null). This setup is designated as the Alpha 1 Configuration.
* **Track 1 (Unleash The Archers - Ghosts In The Mist):** `bpm: 100`, `phraseBeats: 32` (~19.2s hold), `fadeDuration: 1500` (Smooth, atmospheric).
* **Track 2 (Avatar Metal - Tonight We Must Be Warriors):** `bpm: 168`, `phraseBeats: 48` (~17.1s hold), `fadeDuration: 1000` (Crisp, theatrical).
* **Track 3 (The Dark Element - Not Your Monster):** `bpm: 86`, `phraseBeats: 24` (~16.7s hold), `fadeDuration: 2000` (Dreamy, symphonic).
* **Track 4 (Poppy - End of You):** `bpm: 95`, `phraseBeats: 16` (~10.1s hold), `fadeDuration: 800` (Punchy, industrial).
* **Track 5 (Unleash The Archers - Soulbound):** `bpm: 124`, `phraseBeats: 32` (~15.5s hold), `fadeDuration: 1200` (Balanced, high-energy).
* **Track 6 (Nightwish - Last Ride of the Day):** `bpm: 174`, `phraseBeats: 64` (~22.1s hold), `fadeDuration: 2500` (Epic, sweeping finale).

### 2.2 Manual Skip Buttons
* **Location:** Rendered within the music controls HUD in `src/components/wolves/WolvesSoundtrack.vue`.
* **Visual Style:** Sleek, high-tech terminal buttons placed symmetrically around the central Play/Pause button. No emojis are used.
* **Labels:** `⏮` and `⏭` are prohibited. Instead, use standard text-based symbols `|<` and `>|` or label strings.
* **Actions:**
  * **Prev Track:** Calls `player.previousVideo()` if a playlist player is initialized.
  * **Next Track:** Calls `player.nextVideo()` if a playlist player is initialized.

---

## 3. Real-Time Beat-Locked Slide Synchronization

The slideshow in `WolvesComicReader.vue` will automatically adjust its rendering engine depending on the current track index of the soundtrack.

### 3.1 Content Modes
* **Lore Mode / Alpha 1 Configuration (Track 0):** Shows the 14 static illustrated wallpapers (`wallpapers-list.ts`) matching the custom paced story triggers.
* **Live Gallery Mode (Tracks 1-6):** Swaps the display template from standard illustrations to a fullscreen responsive photo viewport that renders images harvested from `flickr-photos.json` using Flickr's static CDN.

### 3.2 Flickr Image URL Construction
Flickr CDN image sources are resolved using the compiled properties:
`https://live.staticflickr.com/{server}/{id}_{secret}_b.jpg`
Where `_b.jpg` resolves to the high-resolution, optimized 1024px maximum dimension image.

### 3.3 Phase-Locked Tempo Calculations
To keep slide transitions perfectly aligned to the audio stream without drift, the active slide index is derived mathematically from the active YouTube `currentTime`:
1. **Beats Calculation:**
   `currentBeat = Math.floor(playlistCurrentTime * (bpm / 60))`
2. **Slide Selection:**
   `slideIndex = Math.floor(currentBeat / phraseBeats) % flickrPhotos.length`
3. **Double-Buffered Crossfading:**
   * To prevent visual snapping or blank frames, the slideshow leverages the existing double-buffered layout structure (`activeMonth` vs `previousMonth` equivalent, or two opacity layers with transition timing matching `fadeDuration`).
   * Transition styles are dynamically set in line with each track's `fadeDuration` style property.

---

## 4. Verification & Testing

* **Type Safety:** Ensure TypeScript types in `src/data/wolves-soundtrack.ts` include optional properties:
  ```typescript
  export interface SoundtrackTrack {
    id: string
    title: string
    artist: string
    artwork: string
    youtubeVideoId: string
    bpm?: number
    phraseBeats?: number
    fadeDuration?: number
  }
  ```
* **Lint Check:** Ensure no emojis are included in any modified or newly added files, comments, or configurations.
* **Testing:** Add or update vitest specs in `src/tests/` to guarantee that soundtrack progress correctly updates the computed slideshow index.
