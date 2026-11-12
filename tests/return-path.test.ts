import { describe, expect, it } from 'vitest'

import { dashboardReturnPath } from '@/lib/return-path'

describe('the page to return to after signing in', () => {
  it('keeps a dashboard page and its query, such as a voucher link', () => {
    expect(dashboardReturnPath('/dashboard/vouchers?code=K7PQ4X')).toBe(
      '/dashboard/vouchers?code=K7PQ4X',
    )
    expect(dashboardReturnPath('/dashboard?tab=insights')).toBe(
      '/dashboard?tab=insights',
    )
  })

  it('sends anything else to the dashboard', () => {
    for (const value of [
      undefined,
      ['/dashboard/vouchers'],
      'https://evil.test/dashboard',
      '//evil.test/dashboard',
      '/dashboardevil',
      '/dashboard/../settings',
      '/dashboard\\@evil.test',
      '/dashboard?a=\r\nX:y',
    ]) {
      expect(dashboardReturnPath(value)).toBe('/dashboard')
    }
  })
})
