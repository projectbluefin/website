// Privacy: all processing is client-side, no data transmitted

export type OS = 'windows' | 'linux' | 'mac' | 'unknown'
export type Arch = 'x86_64' | 'arm64'
export type GPUClass = 'nvidia' | 'nvidia-legacy' | 'nvidia-nouveau' | 'amd' | 'intel' | 'other'
export type DetectionState = 'idle' | 'detecting' | 'done'

export interface GPUResult {
  vendor: string | null
  renderer: string | null
  confidence: 'high' | 'none'
  reason?: 'rfp-active' | 'software-renderer' | 'no-webgl' | 'no-debug-ext'
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
  const gl = (canvas.getContext('webgl2') || canvas.getContext('webgl')) as WebGLRenderingContext | null
  if (!gl) {
    return { vendor: null, renderer: null, confidence: 'none', reason: 'no-webgl' }
  }

  const ext = gl.getExtension('WEBGL_debug_renderer_info')
  // ext is null under Firefox privacy.resistFingerprinting — do not access its properties
  if (!ext) {
    return { vendor: null, renderer: null, confidence: 'none', reason: 'no-debug-ext' }
  }

  const renderer = gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) as string
  const vendor = gl.getParameter(ext.UNMASKED_VENDOR_WEBGL) as string

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
      if (hints.architecture === 'arm') {
        return 'arm64'
      }
      if (hints.architecture === 'x86') {
        return 'x86_64'
      }
    }
    catch {
      // fall through to UA string fallback
    }
  }
  const ua = navigator.userAgent
  if (/aarch64|arm64/i.test(ua)) {
    return 'arm64'
  }
  return 'x86_64'
}

export function classifyGPU(renderer: string): GPUClass {
  if (/^NV[0-9A-F]{2,3}$/i.test(renderer.trim())) {
    return 'nvidia-nouveau'
  }
  if (/NVIDIA/i.test(renderer) && /RTX/i.test(renderer)) {
    return 'nvidia' // Turing+ (RTX): supported by nvidia-open kernel module
  }
  if (/NVIDIA/i.test(renderer)) {
    return 'nvidia-legacy' // Pre-Turing (GTX and older): not supported by nvidia-open
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
  // All async work completes before state is returned (atomic update)
  const [gpu, os, arch] = await Promise.all([
    Promise.resolve(detectGPU()),
    Promise.resolve(detectOS()),
    detectArch(),
  ])
  return { state: 'done', os, arch, gpu }
}
