import { NextRequest } from 'next/server'
import { beforeEach, describe, expect, it } from 'vitest'

import { proxy } from '../proxy'
import { createBusiness, resetDatabase } from './support/db'
import { db } from '@/db/index'
import { users } from '@/db/schema'

beforeEach(resetDatabase)

const embed = async (path: string) =>
  proxy(new NextRequest(`https://pulse.test${path}`))

describe('the embed page headers', () => {
  it("let only the account's listed sites frame its widget", async () => {
    await createBusiness()
    await db.update(users).set({
      widgetKey: 'pk_test_proxy_key',
      widgetOrigins: ['https://conclave.click', 'http://localhost:4500'],
    })
    const response = await embed('/embed/pk_test_proxy_key')
    expect(response.headers.get('content-security-policy')).toBe(
      'frame-ancestors https://conclave.click http://localhost:4500',
    )
    expect(response.headers.get('permissions-policy')).toContain(
      'microphone=(self)',
    )
  })

  it.each([
    '/embed/pk_unknown',
    '/embed/pk_test_proxy_key/extra',
    '/embed/%E0%A4%A',
  ])('let nobody frame %s', async (path) => {
    await createBusiness()
    await db.update(users).set({
      widgetKey: 'pk_test_proxy_key',
      widgetOrigins: ['https://conclave.click'],
    })
    const response = await embed(path)
    expect(response.headers.get('content-security-policy')).toBe(
      "frame-ancestors 'none'",
    )
  })
})

describe('the signup source cookie', () => {
  const visit = (path: string, cookie?: string) =>
    proxy(
      new NextRequest(`https://pulse.test${path}`, {
        headers: cookie ? { cookie } : {},
      }),
    )

  it('remembers the first tagged link someone arrives from', async () => {
    const response = await visit(
      '/software?utm_source=Meta&utm_campaign=NG-Founders',
    )
    const cookie = response.cookies.get('pulse_ref')
    expect(cookie?.value).toBe('meta/ng-founders')
    expect(cookie?.httpOnly).toBe(true)
  })

  it('keeps the first source when a later link is tagged too', async () => {
    const response = await visit(
      '/?utm_source=x&utm_campaign=later',
      'pulse_ref=meta/us-founders',
    )
    expect(response.cookies.get('pulse_ref')).toBeUndefined()
  })

  it.each(['/', '/?utm_source=a%20b', '/?utm_campaign=only'])(
    'sets nothing for %s',
    async (path) => {
      expect((await visit(path)).cookies.get('pulse_ref')).toBeUndefined()
    },
  )
})
