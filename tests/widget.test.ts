import { describe, expect, it } from 'vitest'

import { WidgetError, parseOrigin } from '@/server/widget'

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
    expect(parseOrigin('http://[::1]:3000')).toBe('http://[::1]:3000')
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
  ])('refuses %j', (input) => {
    expect(() => parseOrigin(input)).toThrow(WidgetError)
  })
})
