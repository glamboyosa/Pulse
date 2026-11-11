import { describe, expect, it } from 'vitest'

import { FRAMEWORKS } from '@/lib/widget-snippet'
import { widgetDocsMarkdown } from '@/lib/widget-docs'

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
