import { describe, expect, it } from 'vitest'
import { classifyGPU } from './useHardwareDetection'

describe('classifyGPU — nvidia-open supported (Turing+)', () => {
  it('classifies NVIDIA RTX as nvidia', () => {
    expect(classifyGPU('NVIDIA GeForce RTX 3080/PCIe/SSE2')).toBe('nvidia')
  })

  it('classifies NVIDIA GTX 16xx as nvidia', () => {
    expect(classifyGPU('NVIDIA GeForce GTX 1660 Ti/PCIe/SSE2')).toBe('nvidia')
  })

  it('classifies ANGLE (Windows D3D11) RTX renderer as nvidia', () => {
    expect(classifyGPU('ANGLE (NVIDIA, NVIDIA GeForce RTX 3080 Direct3D11 vs_5_0 ps_5_0, D3D11-27.21.14.6109)')).toBe('nvidia')
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

  it('classifies MX150 as nvidia-legacy (Pascal laptop)', () => {
    expect(classifyGPU('NVIDIA GeForce MX150/PCIe/SSE2')).toBe('nvidia-legacy')
  })

  it('classifies MX330 as nvidia-legacy (Pascal laptop)', () => {
    expect(classifyGPU('NVIDIA GeForce MX330/PCIe/SSE2')).toBe('nvidia-legacy')
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
