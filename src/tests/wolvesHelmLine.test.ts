import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import WolvesHelmLine from '../components/wolves/WolvesHelmLine.vue'

const LINE = 'SEVEN PILLARS · ONE COMMUNITY · ONE DESTINY'

function source(path: string): string {
  return readFileSync(resolve(process.cwd(), path), 'utf8')
}

describe('helm-separated standfirst', () => {
  it('draws one helm for each authored separator', () => {
    const wrapper = mount(WolvesHelmLine, {
      props: { text: LINE }
    })
    const marks = wrapper.findAll('.wc-helm-sep')

    expect(marks).toHaveLength(2)
    for (const mark of marks) {
      expect(mark.attributes('src')).toContain('brands/kubernetes-icon-white.svg')
    }
  })

  // The copy is not edited, only painted: the phrases and their spacing survive
  // verbatim, and only the separator glyph is gone from the rendered text.
  it('keeps the authored copy and drops only the separator glyph', () => {
    const wrapper = mount(WolvesHelmLine, {
      props: { text: LINE }
    })

    expect(wrapper.text()).not.toContain('·')
    expect(wrapper.text().replace(/\s+/g, ' ').trim())
      .toBe('SEVEN PILLARS ONE COMMUNITY ONE DESTINY')
  })

  // A separator is not content. Announcing a mark between phrases that are
  // already separated in the text adds nothing to read.
  it('hides the mark from assistive technology', () => {
    const mark = mount(WolvesHelmLine, {
      props: { text: LINE }
    }).get('.wc-helm-sep')

    expect(mark.attributes('alt')).toBe('')
    expect(mark.attributes('aria-hidden')).toBe('true')
  })

  it('leaves a line without separators untouched', () => {
    const wrapper = mount(WolvesHelmLine, {
      props: { text: 'ONE DESTINY' }
    })

    expect(wrapper.findAll('.wc-helm-sep')).toHaveLength(0)
    expect(wrapper.text()).toBe('ONE DESTINY')
  })

  // Tailwind's preflight sets `img { display: block }`. A block-level separator
  // takes its own line and breaks the phrase across three lines.
  it('keeps the mark inline against preflight', () => {
    expect(source('src/components/wolves/WolvesHelmLine.vue'))
      .toMatch(/\.wc-helm-sep\s*\{[\s\S]*?display: inline;/)
  })

  // The mark is CNCF's published white symbolic icon. Asserted on the rendered
  // element rather than the source, so a comment naming another path cannot
  // trip it.
  it('draws the published white symbolic icon', () => {
    const src = mount(WolvesHelmLine, {
      props: { text: LINE }
    }).get('.wc-helm-sep').attributes('src')

    expect(src).toMatch(/brands\/kubernetes-icon-white\.svg$/)
  })

  // Both standfirsts are the same line; neither may drift back to a bare glyph
  // or grow a second, hand-rolled copy of the treatment.
  it('is the only way either standfirst draws that line', () => {
    for (const path of ['src/WolvesTeaserApp.vue', 'src/components/wolves/cinematic/CinematicLobby.vue']) {
      const text = source(path)

      expect(text, `${path} routes the line through the component`).toMatch(/<WolvesHelmLine/)
      expect(text, `${path} keeps the authored copy verbatim`).toContain(LINE)
      expect(text.match(/SEVEN PILLARS · ONE COMMUNITY · ONE DESTINY/g), `${path} states the line once`)
        .toHaveLength(1)
    }
  })
})
