import { describe, expect, it } from 'vitest'

import { mailboxOf, networkOf } from '@/server/free-pulses'

describe('mailboxOf', () => {
  it('treats Gmail dots, plus tags and googlemail as one inbox', () => {
    for (const address of [
      'Ada.Lovelace@gmail.com',
      'adalovelace+cafe@gmail.com',
      ' a.d.a.lovelace@GoogleMail.com ',
    ]) {
      expect(mailboxOf(address)).toBe('adalovelace@gmail.com')
    }
  })

  it('drops plus tags but keeps dots elsewhere', () => {
    expect(mailboxOf('ada.lovelace+two@example.test')).toBe(
      'ada.lovelace@example.test',
    )
  })
})

describe('networkOf', () => {
  it('keeps an IPv4 address as it is', () => {
    expect(networkOf('198.51.100.7')).toBe('198.51.100.7')
  })

  it('groups IPv6 addresses by their /64 block, however they are written', () => {
    for (const ip of [
      '2001:db8:a:b::1',
      '2001:0DB8:000a:000b:1:2:3:4',
      '2001:db8:a:b:ffff::2',
    ]) {
      expect(networkOf(ip)).toBe('2001:db8:a:b::/64')
    }
    expect(networkOf('::1')).toBe('0:0:0:0::/64')
  })

  it('reads an IPv4 address written in IPv6 form as IPv4', () => {
    expect(networkOf('::ffff:198.51.100.7')).toBe('198.51.100.7')
  })
})
