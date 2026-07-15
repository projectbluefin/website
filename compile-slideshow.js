/* eslint-disable no-console */
import { execSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { wallpapers } from './src/components/wolves/wallpapers-list.ts'

function deterministicShuffle(array, seed = 42) {
  const copy = [...array]
  let currentSeed = seed
  const random = () => {
    const x = Math.sin(currentSeed++) * 10000
    return x - Math.floor(x)
  }
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]]
  }
  return copy
}

// Compute the exact same timelineSlides logic from WolvesComicReader.vue
const localShowcase = wallpapers.filter((wp) => {
  const isPeople = wp.name?.includes('/people/') || wp.dayName?.includes('/people/') || wp.nightName?.includes('/people/')
  return !isPeople
}).map(wp => ({
  id: wp.name || wp.dayName || wp.nightName || '',
  isLocal: true,
  path: wp.name,
  title: wp.title,
  type: wp.type,
  dayName: wp.dayName,
  nightName: wp.nightName
}))

const localPeople = wallpapers.filter((wp) => {
  const isPeople = wp.name?.includes('/people/') || wp.dayName?.includes('/people/') || wp.nightName?.includes('/people/')
  return isPeople
}).map(wp => ({
  id: wp.name || wp.dayName || wp.nightName || '',
  isLocal: true,
  path: wp.name,
  title: wp.title,
  type: wp.type,
  dayName: wp.dayName,
  nightName: wp.nightName
}))

const daynightShowcase = localShowcase.filter(wp => wp.type === 'daynight')
const normalShowcase = localShowcase.filter(wp => wp.type !== 'daynight')

const pivotalTarget = 'wolves/people/kubecon-54927705495.webp'
const targetIndex = localPeople.findIndex(wp => wp.id === pivotalTarget)
let pivotalPhoto = null
if (targetIndex !== -1) {
  pivotalPhoto = localPeople.splice(targetIndex, 1)[0]
}

const bkTarget = 'wolves/people/bketelsen.webp'
const bkTargetIndex = localPeople.findIndex(wp => wp.id === bkTarget)
let bkPhoto = null
if (bkTargetIndex !== -1) {
  bkPhoto = localPeople.splice(bkTargetIndex, 1)[0]
}

const heartTarget = 'wolves/people/kubecon-55168460993.webp'
const heartTargetIndex = localPeople.findIndex(wp => wp.id === heartTarget)
let heartPhoto = null
if (heartTargetIndex !== -1) {
  heartPhoto = localPeople.splice(heartTargetIndex, 1)[0]
}

const finaleTarget = 'wolves/people/kubecon-55164466314.webp'
const finaleTargetIndex = localPeople.findIndex(wp => wp.id === finaleTarget)
let finalePhoto = null
if (finaleTargetIndex !== -1) {
  finalePhoto = localPeople.splice(finaleTargetIndex, 1)[0]
}

const shuffledDaynight = deterministicShuffle(daynightShowcase, 101)
const shuffledNormalShowcase = deterministicShuffle(normalShowcase, 202)
const shuffledPeople = deterministicShuffle(localPeople, 303)

const result = []
let currentTime = 0

// 1. Ambient Intro [0, 42]
const dnPool = shuffledDaynight.slice(0, 5)
const sec1BaseDuration = 42 / dnPool.length
for (const item of dnPool) {
  const duration = sec1BaseDuration
  result.push({ ...item, startTime: currentTime, duration, endTime: currentTime + duration })
  currentTime += duration
}

// 2. Heavy Driving Verse 1 [42, 127]
const normalPool1 = shuffledNormalShowcase.slice(0, 22)
const sec2BaseDuration = 85 / normalPool1.length
for (const item of normalPool1) {
  const duration = sec2BaseDuration
  result.push({ ...item, startTime: currentTime, duration, endTime: currentTime + duration })
  currentTime += duration
}

// 3. Heavy Chorus 1 [127, 229]
const normalPool2 = shuffledNormalShowcase.slice(22, 39)
const peoplePool1 = shuffledPeople.slice(0, 15)
const sec3Items = [...normalPool2, ...peoplePool1]
const sec3BaseDuration = 102 / sec3Items.length
for (const item of sec3Items) {
  const duration = sec3BaseDuration
  result.push({ ...item, startTime: currentTime, duration, endTime: currentTime + duration })
  currentTime += duration
}

// 4. Chanting Bridge [229, 277]
const peoplePool2 = shuffledPeople.slice(15, 39)
const sec4BaseDuration = 48 / peoplePool2.length
for (const item of peoplePool2) {
  const duration = sec4BaseDuration
  result.push({ ...item, startTime: currentTime, duration, endTime: currentTime + duration })
  currentTime += duration
}

// 5. Heavy Build-Up [277, 345]
const peoplePool3 = shuffledPeople.slice(39, 73)
if (heartPhoto) {
  peoplePool3.splice(21, 0, heartPhoto)
}
const sec5BaseDuration = 68 / peoplePool3.length
for (const item of peoplePool3) {
  const duration = sec5BaseDuration
  result.push({ ...item, startTime: currentTime, duration, endTime: currentTime + duration })
  currentTime += duration
}

// 6. Fast Solo Climax & Outro [345, 423]
if (pivotalPhoto) {
  const freezeDuration = 5.5
  result.push({ ...pivotalPhoto, startTime: currentTime, duration: freezeDuration, endTime: currentTime + freezeDuration })
  currentTime += freezeDuration
}

if (bkPhoto) {
  const freezeDuration = 8.5
  result.push({ ...bkPhoto, startTime: currentTime, duration: freezeDuration, endTime: currentTime + freezeDuration })
  currentTime += freezeDuration
}

const peoplePool4 = shuffledPeople.slice(73)
const finaleStartTime = 408
const sec6BaseDuration = (finaleStartTime - currentTime) / peoplePool4.length
for (const item of peoplePool4) {
  const duration = sec6BaseDuration
  result.push({ ...item, startTime: currentTime, duration, endTime: currentTime + duration })
  currentTime += duration
}

if (finalePhoto) {
  result.push({ ...finalePhoto, startTime: currentTime, duration: 423 - currentTime, endTime: 423 })
}

// Build concat demuxer manifest so FFmpeg only opens one image stream at a time
const concatEntries = []

for (const slide of result) {
  const relPath = slide.type === 'daynight' ? slide.dayName : slide.path
  const fullPath = path.join(import.meta.dirname, 'public', 'img', 'wallpapers', relPath)
  if (fs.existsSync(fullPath)) {
    concatEntries.push({ path: fullPath, duration: slide.duration.toFixed(6) })
  }
  else {
    console.warn(`Warning: file not found ${fullPath}`)
  }
}

const audioPath = path.join(import.meta.dirname, 'track0.m4a')
const concatFilePath = path.join(import.meta.dirname, '.tmp-wolves-slides.ffconcat')
const outputPath = '/var/home/jorge/Videos/wolves-first-song-1440p.mp4'

if (concatEntries.length === 0) {
  throw new Error('No valid wallpaper slides found for rendering')
}

const ffconcatLines = ['ffconcat version 1.0']
for (const entry of concatEntries) {
  const escapedPath = entry.path.split('\'').join('\'\\\'\'')
  ffconcatLines.push(`file '${escapedPath}'`)
  ffconcatLines.push(`duration ${entry.duration}`)
}
// Repeat final file per concat demuxer duration rules.
const finalEscapedPath = concatEntries[concatEntries.length - 1].path.split('\'').join('\'\\\'\'')
ffconcatLines.push(`file '${finalEscapedPath}'`)
fs.writeFileSync(concatFilePath, `${ffconcatLines.join('\n')}\n`, 'utf8')

console.log('Compiling offline-native 1440p high-quality VAAPI video for YouTube...')
const vaapiCmd = `systemd-run --user --scope -p MemoryHigh=22G -p MemoryMax=28G ffmpeg -y -safe 0 -f concat -i "${concatFilePath}" -i "${audioPath}" -vaapi_device /dev/dri/renderD128 -vf "scale=2560:1440:force_original_aspect_ratio=decrease,pad=2560:1440:(ow-iw)/2:(oh-ih)/2,setsar=1,format=nv12,hwupload" -map 0:v:0 -map 1:a:0 -c:v h264_vaapi -qp 18 -g 120 -rc_mode CQP -bf 2 -c:a aac -b:a 192k -movflags +faststart -shortest "${outputPath}"`
const vp9FallbackCmd = `systemd-run --user --scope -p MemoryHigh=22G -p MemoryMax=28G ffmpeg -y -safe 0 -f concat -i "${concatFilePath}" -i "${audioPath}" -vf "scale=2560:1440:force_original_aspect_ratio=decrease,pad=2560:1440:(ow-iw)/2:(oh-ih)/2,setsar=1" -map 0:v:0 -map 1:a:0 -c:v libvpx-vp9 -b:v 0 -crf 22 -deadline good -cpu-used 2 -row-mt 0 -tile-columns 1 -frame-parallel 0 -threads 1 -pix_fmt yuv420p -c:a aac -b:a 192k -movflags +faststart -shortest "${outputPath}"`

console.log(`Running FFmpeg...`)
try {
  execSync(vaapiCmd, { stdio: 'inherit' })
}
catch {
  console.warn('VAAPI encode failed, falling back to high-quality VP9 software encode...')
  execSync(vp9FallbackCmd, { stdio: 'inherit' })
}
finally {
  fs.rmSync(concatFilePath, { force: true })
}

console.log('Priscilla compilation completely successful!')
