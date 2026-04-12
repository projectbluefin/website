import { describe, expect, it } from 'vitest'
import { classifyGPU } from './useHardwareDetection'

describe('classifyGPU — nvidia-open supported (Turing+)', () => {
  // Regression guards — these already pass
  it('classifies RTX series as nvidia', () => {
    expect(classifyGPU('NVIDIA GeForce RTX 3080/PCIe/SSE2')).toBe('nvidia')
    expect(classifyGPU('NVIDIA GeForce RTX 2070 SUPER/PCIe/SSE2')).toBe('nvidia')
    expect(classifyGPU('NVIDIA GeForce RTX 4090/PCIe/SSE2')).toBe('nvidia')
  })

  it('classifies GTX 1650/1660 as nvidia', () => {
    expect(classifyGPU('NVIDIA GeForce GTX 1660 Ti/PCIe/SSE2')).toBe('nvidia')
    expect(classifyGPU('NVIDIA GeForce GTX 1650/PCIe/SSE2')).toBe('nvidia')
  })

  it('classifies ANGLE (Windows D3D11) RTX renderer as nvidia', () => {
    expect(classifyGPU('ANGLE (NVIDIA, NVIDIA GeForce RTX 3080 Direct3D11 vs_5_0 ps_5_0, D3D11-27.21.14.6109)')).toBe('nvidia')
  })

  // Failing tests — T-series Turing workstation GPUs
  it('classifies T400 as nvidia (Turing workstation)', () => {
    expect(classifyGPU('NVIDIA T400/PCIe/SSE2')).toBe('nvidia')
  })

  it('classifies T600 as nvidia (Turing workstation)', () => {
    expect(classifyGPU('NVIDIA T600/PCIe/SSE2')).toBe('nvidia')
  })

  it('classifies T1000 as nvidia (Turing workstation)', () => {
    expect(classifyGPU('NVIDIA T1000/PCIe/SSE2')).toBe('nvidia')
  })

  it('classifies T1200 as nvidia (Turing workstation)', () => {
    expect(classifyGPU('NVIDIA T1200/PCIe/SSE2')).toBe('nvidia')
  })

  // Failing tests — MX-series Turing/Ampere laptop GPUs
  it('classifies MX350 as nvidia (Turing laptop)', () => {
    expect(classifyGPU('NVIDIA GeForce MX350/PCIe/SSE2')).toBe('nvidia')
  })

  it('classifies MX450 as nvidia (Turing laptop)', () => {
    expect(classifyGPU('NVIDIA GeForce MX450/PCIe/SSE2')).toBe('nvidia')
  })

  it('classifies MX550 as nvidia (Ampere laptop)', () => {
    expect(classifyGPU('NVIDIA GeForce MX550/PCIe/SSE2')).toBe('nvidia')
  })

  it('classifies MX570 as nvidia (Ampere laptop)', () => {
    expect(classifyGPU('NVIDIA GeForce MX570/PCIe/SSE2')).toBe('nvidia')
  })

  // ANGLE-wrapped variants for MX-series
  it('classifies ANGLE-wrapped MX350 as nvidia', () => {
    expect(classifyGPU('ANGLE (NVIDIA, NVIDIA GeForce MX350 Direct3D11 vs_5_0 ps_5_0, D3D11-27.21.14.6109)')).toBe('nvidia')
  })
})

describe('classifyGPU — nvidia-legacy (pre-Turing, not supported by nvidia-open)', () => {
  it('classifies GTX 10xx as nvidia-legacy', () => {
    expect(classifyGPU('NVIDIA GeForce GTX 1080 Ti/PCIe/SSE2')).toBe('nvidia-legacy')
    expect(classifyGPU('NVIDIA GeForce GTX 1070/PCIe/SSE2')).toBe('nvidia-legacy')
    expect(classifyGPU('NVIDIA GeForce GTX 1060/PCIe/SSE2')).toBe('nvidia-legacy')
  })

  it('classifies GTX 9xx as nvidia-legacy', () => {
    expect(classifyGPU('NVIDIA GeForce GTX 980 Ti/PCIe/SSE2')).toBe('nvidia-legacy')
  })

  it('classifies Quadro P-series as nvidia-legacy', () => {
    expect(classifyGPU('NVIDIA Quadro P2000/PCIe/SSE2')).toBe('nvidia-legacy')
  })

  // MX130/MX150/MX230/MX250/MX330 are Maxwell/Pascal — legacy
  it('classifies MX150 as nvidia-legacy (Pascal laptop)', () => {
    expect(classifyGPU('NVIDIA GeForce MX150/PCIe/SSE2')).toBe('nvidia-legacy')
  })

  it('classifies MX250 as nvidia-legacy (Pascal laptop)', () => {
    expect(classifyGPU('NVIDIA GeForce MX250/PCIe/SSE2')).toBe('nvidia-legacy')
  })

  it('classifies MX330 as nvidia-legacy (Pascal laptop)', () => {
    expect(classifyGPU('NVIDIA GeForce MX330/PCIe/SSE2')).toBe('nvidia-legacy')
  })
})

describe('classifyGPU — nouveau driver', () => {
  it('classifies bare NV hex string as nvidia-nouveau', () => {
    expect(classifyGPU('NV167')).toBe('nvidia-nouveau')
    expect(classifyGPU('NVA8')).toBe('nvidia-nouveau')
    expect(classifyGPU('NV50')).toBe('nvidia-nouveau')
  })

  it('handles leading/trailing whitespace (renderer.trim())', () => {
    expect(classifyGPU('  NVA8  ')).toBe('nvidia-nouveau')
  })

  it('handles lowercase nv hex (case-insensitive flag)', () => {
    expect(classifyGPU('nva8')).toBe('nvidia-nouveau')
  })
})

describe('classifyGPU — AMD and Intel', () => {
  it('classifies AMD Radeon as amd', () => {
    expect(classifyGPU('AMD Radeon RX 7900 XTX (radeonsi, navi31, LLVM 17.0.6, DRM 3.57, 6.7.6-200.fc39.x86_64)')).toBe('amd')
  })

  it('classifies Intel as intel', () => {
    expect(classifyGPU('Mesa Intel(R) UHD Graphics 630 (CFL GT2)')).toBe('intel')
    expect(classifyGPU('Intel(R) Iris(R) Xe Graphics')).toBe('intel')
  })

  it('classifies Apple GPU as other', () => {
    expect(classifyGPU('Apple M2')).toBe('other')
  })
})
