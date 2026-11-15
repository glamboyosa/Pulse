import { describe, expect, it } from 'vitest'

import { parseSignupSource, signupSourceFrom } from '@/lib/signup-source'

const from = (query: string) => signupSourceFrom(new URLSearchParams(query))

describe('signupSourceFrom', () => {
  it('joins source and campaign, lower-cased', () => {
    expect(from('utm_source=Meta&utm_campaign=ZA-Founders')).toBe(
      'meta/za-founders',
    )
  })

  it('keeps the source alone when the campaign is missing or odd', () => {
    expect(from('utm_source=x')).toBe('x')
    expect(from('utm_source=x&utm_campaign=a/b')).toBe('x')
  })

  it('ignores links without a usable source', () => {
    expect(from('utm_campaign=only')).toBeNull()
    expect(from(`utm_source=${'a'.repeat(41)}`)).toBeNull()
  })
})

describe('parseSignupSource', () => {
  it.each(['meta', 'meta/ng-founders'])('accepts %s', (value) => {
    expect(parseSignupSource(value)).toBe(value)
  })

  it.each([undefined, '', 'a/b/c', 'meta/<x>', 'Meta'])(
    'rejects %s',
    (value) => {
      expect(parseSignupSource(value)).toBeNull()
    },
  )
})
