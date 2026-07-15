import { createRequire } from 'node:module'
import { describe, expect, it } from 'vitest'

const require = createRequire(import.meta.url)
const { selectVideoCodec } = require('../../record-wolves.cjs')

describe('record-wolves encoder selection', () => {
  it('prefers hevc_vaapi in auto mode when VAAPI is available', () => {
    const encoders = '... hevc_vaapi ... h264_vaapi ... libvpx-vp9 ...'
    expect(selectVideoCodec('auto', encoders, true)).toBe('hevc_vaapi')
  })

  it('falls back to libx264 when VAAPI is unavailable but x264 exists', () => {
    const encoders = '... libx264 ... libvpx-vp9 ...'
    expect(selectVideoCodec('auto', encoders, false)).toBe('libx264')
  })

  it('falls back to libvpx-vp9 when neither VAAPI nor x264 are available', () => {
    const encoders = '... libvpx-vp9 ...'
    expect(selectVideoCodec('auto', encoders, false)).toBe('libvpx-vp9')
  })
})
