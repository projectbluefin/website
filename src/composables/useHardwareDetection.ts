// Privacy: all processing is client-side, no data transmitted

export type OS = 'windows' | 'linux' | 'mac' | 'unknown'
export type Arch = 'x86_64' | 'arm64'
export type GPUClass = 'nvidia' | 'nvidia-legacy' | 'nvidia-nouveau' | 'amd' | 'intel' | 'other'
export type DetectionState = 'idle' | 'detecting' | 'done'

export interface GPUResult {
  vendor: string | null
  renderer: string | null
  confidence: 'high' | 'none'
  reason?: 'software-renderer' | 'no-webgl' | 'no-debug-ext'
}

export interface DetectionResult {
  state: DetectionState
  os: OS
  arch: Arch
  gpu: GPUResult
}

// Ambient interface for navigator.userAgentData (not in TS standard lib)
interface UADataHighEntropy {
  architecture?: string
  platform?: string
}
interface UAData {
  platform?: string
  getHighEntropyValues?: (hints: string[]) => Promise<UADataHighEntropy>
}

function detectGPU(): GPUResult {
  const canvas = document.createElement('canvas')
  const gl = (canvas.getContext('webgl2') || canvas.getContext('webgl')) as WebGLRenderingContext | WebGL2RenderingContext | null
  if (!gl) {
    return { vendor: null, renderer: null, confidence: 'none', reason: 'no-webgl' }
  }

  const ext = gl.getExtension('WEBGL_debug_renderer_info')
  // ext is null under Firefox privacy.resistFingerprinting — do not access its properties
  if (!ext) {
    gl.getExtension('WEBGL_lose_context')?.loseContext()
    return { vendor: null, renderer: null, confidence: 'none', reason: 'no-debug-ext' }
  }

  const renderer = gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) as string
  const vendor = gl.getParameter(ext.UNMASKED_VENDOR_WEBGL) as string

  // Release the GPU context immediately after reading — we don't need it beyond this point.
  // Browsers limit concurrent WebGL contexts (Chrome: 16, Safari: 8); explicit release avoids
  // accumulation if detection is ever called more than once.
  gl.getExtension('WEBGL_lose_context')?.loseContext()

  if (/llvmpipe|SwiftShader|softpipe/i.test(renderer)) {
    return { vendor: null, renderer, confidence: 'none', reason: 'software-renderer' }
  }

  return { vendor, renderer, confidence: 'high' }
}

function detectOS(): OS {
  const uaData = (navigator as Navigator & { userAgentData?: UAData }).userAgentData
  if (uaData?.platform) {
    const p = uaData.platform
    if (p === 'Windows') {
      return 'windows'
    }
    if (p === 'Linux') {
      return 'linux'
    }
    if (p === 'macOS') {
      return 'mac'
    }
  }
  const ua = navigator.userAgent
  if (/Windows NT/i.test(ua)) {
    return 'windows'
  }
  if (/Linux/i.test(ua) && !/Android/i.test(ua)) {
    return 'linux'
  }
  if (/Macintosh|Mac OS X/i.test(ua)) {
    return 'mac'
  }
  return 'unknown'
}

async function detectArch(): Promise<Arch> {
  const uaData = (navigator as Navigator & { userAgentData?: UAData }).userAgentData
  if (uaData?.getHighEntropyValues) {
    try {
      const hints = await uaData.getHighEntropyValues(['architecture'])
      const arch = hints.architecture?.toLowerCase()
      if (arch === 'arm' || arch === 'arm64' || arch === 'aarch64') {
        return 'arm64'
      }
      // On Windows ARM with an x86-emulated browser, Client Hints reports 'x86'
      // because that is the browser's compiled target, not the hardware arch.
      // No early return for x86 — always fall through to the UA string check below
      // so a native ARM64 Chromium UA token ('ARM64') can still be detected.
    }
    catch {
      // fall through to UA string fallback
    }
  }
  const ua = navigator.userAgent
  // Check for ARM markers in the UA string.
  // - Linux/Android: 'aarch64' or 'arm64' are standard
  // - Windows ARM with native ARM64 browser: UA includes 'ARM64' as a platform token
  //   e.g. "Mozilla/5.0 (Windows NT 10.0; Win64; ARM64) AppleWebKit/..."
  //   The /arm64/i match covers this case (case-insensitive).
  // - Firefox on Windows ARM: reports 'x86_64' with no ARM marker (Bugzilla #1763310)
  //   This case cannot be detected from browser APIs alone.
  if (/aarch64|arm64/i.test(ua)) {
    return 'arm64'
  }
  return 'x86_64'
}

export function classifyGPU(renderer: string): GPUClass {
  if (/^NV[0-9A-F]{2,3}$/i.test(renderer.trim())) {
    return 'nvidia-nouveau'
  }
  if (/NVIDIA/i.test(renderer) && (/RTX/i.test(renderer) || /GTX 16\d{2}/i.test(renderer))) {
    return 'nvidia' // Turing+ (RTX series + GTX 1650/1660): supported by nvidia-open
  }
  if (/NVIDIA/i.test(renderer)) {
    return 'nvidia-legacy' // Pre-Turing (GTX 10xx and older): not supported by nvidia-open
  }
  if (/AMD|Radeon/i.test(renderer)) {
    return 'amd'
  }
  if (/Intel/i.test(renderer)) {
    return 'intel'
  }
  return 'other'
}

export function extractGPUName(renderer: string): string {
  // ANGLE on Windows (Direct3D or Metal backend)
  // Use indexOf to avoid regex backtracking issues
  const angleStart = renderer.indexOf('ANGLE (')
  if (angleStart !== -1) {
    const commaIdx = renderer.indexOf(',', angleStart)
    if (commaIdx !== -1) {
      const d3dIdx = renderer.indexOf('Direct3D', commaIdx)
      const metalIdx = renderer.indexOf('Metal', commaIdx)
      const endIdx = d3dIdx !== -1 ? d3dIdx : metalIdx !== -1 ? metalIdx : -1
      if (endIdx !== -1) {
        return renderer.slice(commaIdx + 1, endIdx).trim()
      }
    }
  }
  // Linux NVIDIA proprietary: "NVIDIA GeForce RTX 4080/PCIe/SSE2"
  const slashIdx = renderer.indexOf('/PCIe')
  if (slashIdx !== -1 && renderer.startsWith('NVIDIA ')) {
    return renderer.slice(0, slashIdx).trim()
  }
  // Mesa: "AMD Radeon RX 7900 XTX (radeonsi, ...)" or "Mesa Intel(R) ..."
  const parenIdx = renderer.indexOf('(')
  if (parenIdx > 0) {
    return renderer.slice(0, parenIdx).trim()
  }
  return renderer
}

export async function runDetection(): Promise<DetectionResult> {
  // detectGPU and detectOS are synchronous; detectArch is async (Client Hints API).
  // Run detectArch in parallel with the sync calls for clean sequencing.
  const gpu = detectGPU()
  const os = detectOS()
  const archRaw = await detectArch()

  // Safari and Firefox on Apple Silicon report "Intel Mac OS X" in the UA and
  // have no Client Hints support, so detectArch() returns 'x86_64' even on M1/M2/M3.
  // The WebGL renderer string reliably identifies Apple Silicon GPUs — use it as a
  // fallback to correct the arch when the UA/Client Hints signal is wrong.
  let arch = archRaw
  if (os === 'mac' && arch === 'x86_64' && gpu.confidence === 'high' && gpu.renderer) {
    if (/Apple\s+M\d+/i.test(gpu.renderer) || /Apple GPU/i.test(gpu.renderer)) {
      arch = 'arm64'
    }
  }

  return { state: 'done', os, arch, gpu }
}
