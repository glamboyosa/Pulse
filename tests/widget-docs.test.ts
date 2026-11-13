import { describe, expect, it } from 'vitest'

import { widgetAgentsMarkdown } from '@/lib/widget-agents'
import { widgetDocsMarkdown } from '@/lib/widget-docs'
import { FRAMEWORKS } from '@/lib/widget-snippet'

describe('widgetDocsMarkdown', () => {
  const markdown = widgetDocsMarkdown('https://www.pulseapp.click')

  it('includes install code for every framework', () => {
    for (const framework of FRAMEWORKS) {
      expect(markdown).toContain(`### ${framework.name}`)
    }
    expect(markdown).toContain(
      '<script src="https://www.pulseapp.click/widget.js" data-key="pk_your_key" async></script>',
    )
  })

  it('closes every code fence it opens', () => {
    expect(markdown.match(/^```/gm)?.length ?? 0).toSatisfy(
      (fences: number) => fences > 0 && fences % 2 === 0,
    )
  })
})

describe('widgetAgentsMarkdown', () => {
  const markdown = widgetAgentsMarkdown('https://www.pulseapp.click')

  it('gives agents the website snippet and the React Native component', () => {
    expect(markdown).toContain(
      '<script src="https://www.pulseapp.click/widget.js" data-key="pk_your_key" async></script>',
    )
    expect(markdown).toContain('export function PulseFeedback')
    expect(markdown).toContain('NSMicrophoneUsageDescription')
  })

  it('closes every code fence it opens', () => {
    expect(markdown.match(/^```/gm)?.length ?? 0).toSatisfy(
      (fences: number) => fences > 0 && fences % 2 === 0,
    )
  })

  it('covers every stack an agent can edit, not the no-code builders', () => {
    for (const framework of FRAMEWORKS) {
      expect(markdown.includes(`### ${framework.name}`)).toBe(
        framework.id !== 'nocode',
      )
    }
  })
})
