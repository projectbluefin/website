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

const storeUrl = 'https://store.projectbluefin.io'
// Placeholder donation URL: points to the official Bluefin donations/contributors section
const donateUrl = 'https://docs.projectbluefin.io/donations'

async function generateQR(text, filename) {
  try {
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
  catch (err) {
    console.error(`Error generating QR code for ${text}:`, err)
  }
}

async function main() {
  await generateQR(storeUrl, 'qr-store.svg')
  await generateQR(donateUrl, 'qr-donate.svg')
}

main()
