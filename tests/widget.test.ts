import { describe, expect, it } from 'vitest'

import {
  WidgetError,
  embedHeaders,
  parseOrigin,
  parseWidgetContext,
} from '@/server/widget'

describe('parseOrigin', () => {
  it('turns what an owner types into an https origin', () => {
    expect(parseOrigin('conclave.click')).toBe('https://conclave.click')
    expect(parseOrigin(' https://app.example.com/settings?tab=1 ')).toBe(
      'https://app.example.com',
    )
    expect(parseOrigin('https://example.com:8443')).toBe(
      'https://example.com:8443',
    )
  })

  it('drops a trailing dot, as browsers do', () => {
    expect(parseOrigin('Example.COM.')).toBe('https://example.com')
  })

  it('allows plain http only for a local dev server', () => {
    expect(parseOrigin('http://localhost:3000')).toBe('http://localhost:3000')
    expect(parseOrigin('http://app.localhost:4321')).toBe(
      'http://app.localhost:4321',
    )
    expect(() => parseOrigin('http://example.com')).toThrow(WidgetError)
  })

  it.each([
    '',
    'not a url at all',
    'ftp://example.com',
    'javascript:alert(1)',
    'https://user:pass@example.com',
    'https://intranet',
    '*.example.com',
    'https://com.',
    // CSP can't express IPv6 hosts, so framing from one could never work.
    'http://[::1]:3000',
  ])('refuses %j', (input) => {
    expect(() => parseOrigin(input)).toThrow(WidgetError)
  })
})

describe('parseWidgetContext', () => {
  it('keeps known fields, trimmed and capped, and only the page path', () => {
    const context = parseWidgetContext(
      JSON.stringify({
        page: 'https://conclave.click/memo/42?token=secret#notes',
        title: '  Memo   42 ',
        referrer: 'https://google.com/search?q=private',
        browser: 'Firefox 140 on macOS',
        appVersion: '1.4.0',
        userEmail: 'person@example.test',
        custom: { plan: 'pro', 'bad key!': 'x', empty: '  ' },
        injected: '<script>',
      }),
    )
    expect(context).toEqual({
      page: '/memo/42',
      title: 'Memo 42',
      referrer: 'https://google.com',
      browser: 'Firefox 140 on macOS',
      appVersion: '1.4.0',
      userEmail: 'person@example.test',
      custom: { plan: 'pro' },
    })
  })

  it('drops unsafe custom keys, arrays and non-string values', () => {
    expect(
      parseWidgetContext(
        '{"custom":{"__proto__":"x","constructor":"y","plan":"pro"},"title":42}',
      ),
    ).toEqual({ custom: { plan: 'pro' } })
    expect(
      parseWidgetContext(JSON.stringify({ custom: ['a', 'b'] })),
    ).toBeNull()
  })

  it('keeps a page only when it is a web address or path', () => {
    expect(parseWidgetContext(JSON.stringify({ page: '/settings' }))).toEqual({
      page: '/settings',
    })
    expect(
      parseWidgetContext(JSON.stringify({ page: 'javascript:alert(1)' })),
    ).toBeNull()
  })

  it('caps how many custom fields are kept', () => {
    const custom = Object.fromEntries(
      Array.from({ length: 15 }, (_, i) => [`field${i}`, 'value']),
    )
    expect(
      Object.keys(parseWidgetContext(JSON.stringify({ custom }))?.custom ?? {}),
    ).toHaveLength(10)
  })

  it.each([
    undefined,
    '',
    'not json',
    '[]',
    '"a string"',
    '{}',
    JSON.stringify({ referrer: 'javascript:alert(1)' }),
    'x'.repeat(5000),
  ])('ignores %j', (raw) => {
    expect(parseWidgetContext(raw)).toBeNull()
  })
})

describe('embedHeaders', () => {
  it('lets only the listed sites frame the widget', () => {
    const headers = embedHeaders([
      'https://conclave.click',
      'https://a.example',
    ])
    expect(headers['Content-Security-Policy']).toBe(
      'frame-ancestors https://conclave.click https://a.example',
    )
    expect(headers['Permissions-Policy']).toContain('microphone=(self)')
  })

  it('lets nobody frame it when no sites are listed', () => {
    expect(embedHeaders([])['Content-Security-Policy']).toBe(
      "frame-ancestors 'none'",
    )
  })
})
