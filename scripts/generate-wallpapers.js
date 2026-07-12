import { readdir, writeFile } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT_DIR = resolve(__dirname, '..')
const PUBLIC_DIR = join(ROOT_DIR, 'public')
const BASE_WALLPAPERS_DIR = join(PUBLIC_DIR, 'img/wallpapers/wolves')

// Curated dictionary of known filename basenames to their titles
const curatedTitles = {
  // Story illustrations
  'bluefin-huntress': 'Huntress',
  'bluefin-dusk': 'Dusk (Day & Night)',
  'bluefin-lazy-days': 'Lazy Days',
  'bluefin-chicken': 'Chicken',
  'bluefin-eyes': 'Eyes',
  'bluefin-duality': 'Duality (Day & Night)',
  'bluefin-prey': 'Prey (Day & Night)',
  'bluefin-collapse': 'Collapse (Day & Night)',
  'bluefin-xe_red_tulip': 'Red Tulip',
  'bluefin-tenacious': 'Tenacious Pterosaur (Day & Night)',

  // Showcase
  'showcase-1': 'Community Showcase by ki',
  'showcase-2': 'Community Showcase by ki',
  'showcase-3': 'Community Showcase by ki',
  'showcase-4': 'Community Showcase by ki',
  'showcase-5': 'Community Showcase by Killishness',
  'showcase-6': 'Community Showcase by ki',
  'showcase-7': 'Community Showcase by ki',
  'showcase-8': 'Community Showcase by ki',
  'showcase-9': 'Community Showcase by AlgoCompSynth by znmeb',
  'showcase-10': 'Community Showcase by David',
  'showcase-11': 'Community Showcase by Corpacra',
  'showcase-12': 'Community Showcase by Falco404',
  'showcase-13': 'Community Showcase by Amy',
  'showcase-14': 'Community Showcase by Pires',
  'showcase-15': 'Community Showcase by Idris',
  'showcase-16': 'Community Showcase by G. Murdzheff',
  'showcase-17': 'Community Showcase by JumpyVi',
  'showcase-18': 'Community Showcase by Giklab',
  'showcase-19': 'Community Showcase by CTW',
  'showcase-20': 'Community Showcase by AlgoCompSynth by znmeb',

  // People / KubeCon / Flickr curated titles
  'kubecon-55164225841': 'Maintainer Summit Evening Reception - 043 MN',
  'kubecon-55164388368': 'Maintainer Summit Evening Reception - 040 MN',
  'kubecon-55163325182': 'Maintainer Summit Evening Reception - 030 MN',
  'kubecon-55164226026': 'Maintainer Summit Evening Reception - 029 MN',
  'kubecon-55164388473': 'Maintainer Summit Evening Reception - 026 MN',
  'kubecon-55164226136': 'Maintainer Summit Evening Reception - 018 MN',
  'kubecon-55164467034': 'Maintainer Summit Group Photo - LM 002',
  'kubecon-55164225526': 'Maintainer Summit Group Photo - LM 003',
  'kubecon-55164467009': 'Maintainer Summit Group Photo - LM 005',
  'kubecon-55164225566': 'Maintainer Summit Group Photo - LM 004',
  'kubecon-55164225551': 'Maintainer Summit Group Photo - LM 006',
  'kubecon-55164225541': 'Maintainer Summit Group Photo - LM 007',
  'kubecon-55164387143': 'Maintainer Summit Breaks & Lunch - MN 041',
  'kubecon-55164603055': 'Maintainer Summit Breaks & Lunch - MN 031',
  'kubecon-55164387268': 'Maintainer Summit Breaks & Lunch - MN 022',
  'kubecon-55164224866': 'Maintainer Summit Breaks & Lunch - MN 023',
  'kubecon-55164466314': 'Maintainer Summit Breaks & Lunch - MN 025',
  'kubecon-55163324057': 'Maintainer Summit Breaks & Lunch - MN 014',
  'kubecon-55164466149': 'Maintainer Summit Breaks & Lunch - MN 010',
  'kubecon-55164387493': 'Maintainer Summit Breaks & Lunch - LM 024',
  'kubecon-55164466574': 'Maintainer Summit Breaks & Lunch - LM 018',
  'kubecon-55164385253': 'Maintainer Summit Breakouts - MN 048',
  'kubecon-55164222611': 'Maintainer Summit Breakouts - MN 041',
  'kubecon-55164464359': 'Maintainer Summit Breakouts - LM 025',
  'kubecon-55164384988': 'Maintainer Summit Breakouts - LM 009',
  'kubecon-55168545299': 'KubeCon Europe 2026 Daily Highlights - 053',
  'kubecon-55168295426': 'KubeCon + CloudNativeCon Europe 2026',
  'kubecon-55168973792': 'KubeCon Europe 2026 TOP12 006',
  'kubecon-55170037858': 'KubeCon Europe 2026 TOP12 005',
  'kubecon-55169871651': 'KubeCon Europe 2026 TOP12 008',
  'kubecon-55170264275': 'KubeCon Europe 2026 TOP12 010',
  'kubecon-55169871616': 'KubeCon Europe 2026 TOP12 011',
  'kubecon-55168973742': 'KubeCon Europe 2026 TOP12 012',
  'kubecon-55177195819': 'Solutions Showcase MN 041',
  'kubecon-55176943506': 'T-Shirt Pick-up DN 011',
  'kubecon-55177109048': 'Project PavilionTours LM 006',
  'kubecon-55177108798': 'Project PavilionTours LM 012',
  'kubecon-55177342820': 'Project Pavilion LM 027',
  'kubecon-55176938501': 'Project Pavilion LM 028',
  'kubecon-55177342795': 'Project Pavilion LM 030',
  'kubecon-55176938461': 'Project Pavilion LM 032',
  'kubecon-55177110598': 'Learning Lounge MN 028',
  'kubecon-55176938596': 'Learning Lounge MN 030',
  'kubecon-55177109118': 'Project Pavilion Tours DN 013',
  'kubecon-55176036272': 'Keynote DK 068',
  'kubecon-55177329375': 'Keynote DK 099',
  'kubecon-55176925196': 'Keynote DK 102',
  'kubecon-55176035967': 'Keynote DK 104',
  'kubecon-55177329325': 'Keynote DK 105',
  'kubecon-55177098053': 'Keynote DK 012',
  'kubecon-55177098028': 'Keynote DK 016',
  'kubecon-55177097253': 'Keynote DK 019',
  'kubecon-55177329145': 'Keynote DK 037',
  'kubecon-55167395267': 'Daily Highlights - 005',
  'kubecon-55168460993': 'Daily Highlights - 021',
  'kubecon-55168460833': 'Daily Highlights - 027',
  'kubecon-55168684055': 'Daily Highlights - 029',
  'kubecon-55168545279': 'Daily Highlights - 052',
  'kubecon-55386335785': 'KubeCon + CloudNativeCon India 2026 - Day 2 at Jio World Convention Centre',
  'kubecon-55386311935': 'KubeCon + CloudNativeCon India 2026 - Day 2 at Jio World Convention Centre',
  'kubecon-55386056978': 'KubeCon + CloudNativeCon India 2026 - Day 2 at Jio World Convention Centre',
  'kubecon-54927728075': 'Maintainer Summit North America 2025',
  'kubecon-54926533692': 'Maintainer Summit North America 2025 Maintainer Summit Badgepickup+Welcome ML-MN',
  'kubecon-54927705495': 'Maintainer Summit North America 2025 Maintainer Summit Badgepickup+Welcome ML-MN',
  'kubecon-54927401871': 'Maintainer Summit North America 2025 Maintainer Summit Keynote ML-MN 004',
  'kubecon-54927401811': 'Maintainer Summit North America 2025 Maintainer Summit Keynote ML-MN 006',
  'kubecon-54927600273': 'Maintainer Summit North America 2025 Maintainer Summit Keynote ML-MN 005',
  'kubecon-54927402146': 'Maintainer Summit North America 2025 Maintainer Summit Keynote ML-MN 008',
  'kubecon-54927620483': 'Maintainer Summit North America 2025 Maintainer Summit GroupPhoto ML-MN 012',
  'kubecon-54926555242': 'Maintainer Summit North America 2025 Maintainer Summit GroupPhoto ML-MN 011',
  'kubecon-54926555137': 'Maintainer Summit North America 2025 Maintainer Summit GroupPhoto ML-MN 009',
  'kubecon-54927727820': 'Maintainer Summit North America 2025 Maintainer Summit GroupPhoto ML-MN 010',
  'kubecon-54927669159': 'Maintainer Summit North America 2025 Maintainer Summit GroupPhoto ML-MN 008',
  'kubecon-54927422306': 'Maintainer Summit North America 2025 Maintainer Summit EveningReception ML-MN 05',
  'kubecon-54927620538': 'Maintainer Summit North America 2025 Maintainer Summit EveningReception ML-MN 04',
  'kubecon-54925330750': 'KubeCon North America 2025 TOP12 005',
  'kubecon-54926587622': 'ArgoCon North America 2025 ArgoCon BF 001',
  'kubecon-54924155702': 'KubeCon North America 2025 TOP12 012',
  'kubecon-54924155737': 'KubeCon North America 2025 TOP12 004',
  'flickr-53608872377': 'KC+CNC_EU_240319_KCS_Breakouts_MN_024',
  'flickr-53608873387': 'KC+CNC_EU_240319_KCS_Welcome_MN_034',
  'flickr-53608873717': 'KC+CNC_EU_240319_KCS_MN_030',
  'flickr-53609959643': 'KC+CNC_EU_240319_KCS_BreaksLunch_MN_002',
  'flickr-53610085829': 'KC+CNC_EU_240319_KCS_Breakouts_MN_056',
  'flickr-53610201620': 'KC+CNC_EU_240319_KCS_Breakouts_MN_034',
  'flickr-53610201845': 'KC+CNC_EU_240319_KCS_GroupPhoto_MN_001',
  'flickr-53610202870': 'KC+CNC_EU_240319_KCS_MN_001',
  'flickr-53775762912': '2024-06-06_OHSNAP_KuberTENes_BirthdayBash_HL_0145',
  'flickr-53776677826': '2024-06-06_OHSNAP_KuberTENes_BirthdayBash_HL_0038',
  'flickr-53776677901': '2024-06-06_OHSNAP_KuberTENes_BirthdayBash_HL_0058',
  'flickr-53776677906': '2024-06-06_OHSNAP_KuberTENes_BirthdayBash_HL_0057',
  'flickr-53776678026': '2024-06-06_OHSNAP_KuberTENes_BirthdayBash_HL_0096',
  'flickr-53776883538': '2024-06-06_OHSNAP_KuberTENes_BirthdayBash_HL_0070',
  'flickr-53777005074': '2024-06-06_OHSNAP_KuberTENes_BirthdayBash_HL_0029',
  'flickr-53777005474': '2024-06-06_OHSNAP_KuberTENes_BirthdayBash_HL_0135',
  'flickr-53777101875': '2024-06-06_OHSNAP_KuberTENes_BirthdayBash_HL_0034',
  'flickr-53777102280': '2024-06-06_OHSNAP_KuberTENes_BirthdayBash_HL_0120',
  'flickr-54136482862': 'KC+CNC_NA_241111_BF_KCS_evening_218',
  'flickr-54137323246': 'KC+CNC_NA_241111_BF_KCS_003',
  'flickr-54137326101': 'KC+CNC_NA_241111_BF_KCS_088',
  'flickr-54137330521': 'KC+CNC_NA_241111_BF_KCS_185',
  'flickr-54137331261': 'KC+CNC_NA_241111_BF_KCS_196',
  'flickr-54137613073': 'KC+CNC_NA_241111_BF_KCS_evening_240',
  'flickr-54137616178': 'KC+CNC_NA_241111_BF_KCS_181',
  'flickr-54137617973': 'KC+CNC_NA_241111_BF_KCS_evening_220',
  'flickr-54137658664': 'KC+CNC_NA_241111_BF_KCS_119',
  'flickr-54137664384': 'KC+CNC_NA_241111_BF_KCS_evening_229',
  'flickr-54137782045': 'KC+CNC_NA_241111_BF_KCS_012',
  'flickr-54137782365': 'KC+CNC_NA_241111_BF_KCS_026',
  'flickr-54137788650': 'KC+CNC_NA_241111_BF_KCS_177',
  'flickr-54137791405': 'KC+CNC_NA_241111_BF_KCS_evening_227',
  'flickr-54434769392': 'KC+CNC_EU_2025_Top12_010',
  'flickr-54435630036': 'KC+CNC_EU_2025_Top12_011',
  'flickr-54435630091': 'KC+CNC_EU_2025_Top12_004',
  'flickr-54435873223': 'KC+CNC_EU_2025_Top12_007',
  'flickr-54435998180': 'KC+CNC_EU_2025_Top12_006',
  'flickr-54435998240': 'KC+CNC_EU_2025_Top12_002',
  'flickr-55343975781': '0R0A9083',
  'flickr-55343977496': '0R0A9009',
  'flickr-55344127313': '0R0A9020',
  'flickr-55344186409': 'DSC04181',
}

function formatTitle(filename) {
  const base = filename.replace(/\.[^/.]+$/, '')
  if (curatedTitles[base]) {
    return curatedTitles[base]
  }

  // Generate a friendly name if not found in curated list
  return base
    .split(/[-_]+/)
    .map((word) => {
      if (word.toUpperCase() === 'KC' || word.toUpperCase() === 'CNC') {
        return word.toUpperCase()
      }
      return word.charAt(0).toUpperCase() + word.slice(1)
    })
    .join(' ')
}

async function scanDirectory(subfolder) {
  try {
    const dirPath = join(BASE_WALLPAPERS_DIR, subfolder)
    const files = await readdir(dirPath)
    // Filter out directories and non-image files
    return files.filter(file => /\.(?:webp|png|jpg|jpeg)$/i.test(file)).sort()
  }
  catch (err) {
    console.warn(`Warning: Could not read directory ${subfolder}:`, err.message)
    return []
  }
}

async function generate() {
  console.info('Generating wallpapers list...')

  const storyFiles = await scanDirectory('wolves')
  const showcaseFiles = await scanDirectory('showcase')
  const peopleFiles = await scanDirectory('people')

  const wallpapers = []

  // 1. Process Story Illustrations (group Day & Night pairs)
  const processedStory = new Set()
  for (const file of storyFiles) {
    if (processedStory.has(file)) {
      continue
    }

    const base = file.replace(/\.[^/.]+$/, '')
    if (base.endsWith('-day')) {
      const stem = base.substring(0, base.length - 4)
      const nightFile = storyFiles.find(f => f.replace(/\.[^/.]+$/, '') === `${stem}-night`)
      if (nightFile) {
        wallpapers.push({
          type: 'daynight',
          name: stem,
          dayName: `wolves/wolves/${file}`,
          nightName: `wolves/wolves/${nightFile}`,
          title: formatTitle(stem)
        })
        processedStory.add(file)
        processedStory.add(nightFile)
        continue
      }
    }
    else if (base.endsWith('-night')) {
      const stem = base.substring(0, base.length - 6)
      const dayFile = storyFiles.find(f => f.replace(/\.[^/.]+$/, '') === `${stem}-day`)
      if (dayFile) {
        wallpapers.push({
          type: 'daynight',
          name: stem,
          dayName: `wolves/wolves/${dayFile}`,
          nightName: `wolves/wolves/${file}`,
          title: formatTitle(stem)
        })
        processedStory.add(dayFile)
        processedStory.add(file)
        continue
      }
    }

    // Single story file
    wallpapers.push({
      type: 'single',
      name: `wolves/wolves/${file}`,
      title: formatTitle(base)
    })
    processedStory.add(file)
  }

  // 2. Process Showcase Screenshots
  for (const file of showcaseFiles) {
    const base = file.replace(/\.[^/.]+$/, '')
    wallpapers.push({
      type: 'single',
      name: `wolves/showcase/${file}`,
      title: formatTitle(base)
    })
  }

  // 3. Process People Photos
  for (const file of peopleFiles) {
    const base = file.replace(/\.[^/.]+$/, '')
    wallpapers.push({
      type: 'single',
      name: `wolves/people/${file}`,
      title: formatTitle(base)
    })
  }

  const outputPath = join(ROOT_DIR, 'src/components/wolves/wallpapers-list.ts')
  const tsContent = `// Automatically generated by scripts/generate-wallpapers.js. Do not edit directly.
export interface Wallpaper {
  type: 'single' | 'daynight'
  name: string
  dayName?: string
  nightName?: string
  title: string
}

export const wallpapers: Wallpaper[] = ${JSON.stringify(wallpapers, null, 2)}
`
  await writeFile(outputPath, tsContent)
  console.info(`Successfully generated playlist with ${wallpapers.length} wallpapers at ${outputPath}`)
}

generate().catch((err) => {
  console.error('Error generating wallpapers playlist:', err)
  process.exit(1)
})
