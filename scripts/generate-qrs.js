import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import qrcode from 'qrcode'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const targetDir = path.resolve(__dirname, '../src/assets/svg')

// Ensure target directory exists
if (!fs.existsSync(targetDir)) {
  fs.mkdirSync(targetDir, { recursive: true })
}

const qrTargets = [
  ['https://store.projectbluefin.io', 'qr-store.svg'],
  ['#', 'qr-donate.svg'],
  ['https://donate.gnome.org/', 'qr-gnome-donate.svg'],
  ['https://flathub.org/en/donate', 'qr-flathub-donate.svg'],
  ['https://kde.org/donate/', 'qr-kde-donate.svg'],
  [
    'https://events.linuxfoundation.org/kubecon-cloudnativecon-japan/?utm_source=artifacthub&utm_campaign=KubeCon-Japan-2026',
    'qr-kubecon-japan-2026.svg',
  ],
]

async function generateQR(text, filename) {
  const svgString = await qrcode.toString(text, {
    type: 'svg',
    color: {
      dark: '#ffffff', // White QR code foreground for dark theme compatibility
      light: '#00000000', // Fully transparent background
    },
    margin: 1,
  })
  const outputPath = path.join(targetDir, filename)
  fs.writeFileSync(outputPath, svgString, 'utf8')
  console.info(`Successfully generated QR code for ${text} at ${outputPath}`)
}

async function main() {
  await Promise.all(qrTargets.map(([url, filename]) => generateQR(url, filename)))
}

await main()
