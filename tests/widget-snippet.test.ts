import { describe, expect, it } from 'vitest'

import {
  DEFAULT_WIDGET_OPTIONS,
  FRAMEWORKS,
  frameworkExample,
  widgetSnippet,
} from '@/lib/widget-snippet'

const url = 'https://www.pulseapp.click'

describe('widgetSnippet', () => {
  it('writes only the key when every option is the default', () => {
    expect(widgetSnippet(url, 'pk_abc', DEFAULT_WIDGET_OPTIONS)).toBe(
      '<script src="https://www.pulseapp.click/widget.js" data-key="pk_abc" async></script>',
    )
  })

  it('writes each changed option as a data attribute', () => {
    const snippet = widgetSnippet(url, 'pk_abc', {
      label: 'Ask a question',
      shape: 'bubble',
      color: '#e11d48',
      position: 'left',
      heading: 'What can we help with?',
    })
    expect(snippet).toContain('data-label="Ask a question"')
    expect(snippet).toContain('data-shape="bubble"')
    expect(snippet).toContain('data-color="#e11d48"')
    expect(snippet).toContain('data-position="left"')
    expect(snippet).toContain('data-heading="What can we help with?"')
  })

  it('escapes quotes so a label cannot break out of the attribute', () => {
    const snippet = widgetSnippet(url, 'pk_abc', {
      ...DEFAULT_WIDGET_OPTIONS,
      label: 'Say "hi" <now>',
    })
    expect(snippet).toContain('data-label="Say &quot;hi&quot; &lt;now>"')
  })
})

describe('frameworkExample', () => {
  it('includes the key and the chosen options for every framework', () => {
    const options = { ...DEFAULT_WIDGET_OPTIONS, shape: 'circle' as const }
    for (const { id } of FRAMEWORKS) {
      const example = frameworkExample(id, url, 'pk_abc', options)
      expect(example).toContain('pk_abc')
      expect(example).toContain('circle')
    }
  })
})
