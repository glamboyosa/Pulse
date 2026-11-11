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
