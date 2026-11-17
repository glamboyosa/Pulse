import { env } from '@/env'

const llmsTxt = (appUrl: string) => `# Pulse

> Voice feedback for businesses. Customers record a short voice note from a QR code, a website button or a mobile app, and the business reads it transcribed and translated.

Pulse costs nothing to start (5 free pulses), then pay per piece of feedback with no subscription. Customers need no app or account, and can speak in their own language.

Agents adding the feedback widget to a website or React Native app for a user should follow the setup guide below.

## Pages

- [Pulse for restaurants](${appUrl}/restaurants): QR code voice feedback on every table, in their own language
- [Pulse for software](${appUrl}/software): a voice feedback button for websites and React Native apps
- [Pulse vs Google reviews](${appUrl}/compare/google-reviews): private feedback to improve vs public reviews to be found, and how they work together

## Docs

- [Setup guide for coding agents](${appUrl}/agents.md): getting the key, website and React Native install, permissions, checks
- [Widget guide](${appUrl}/docs/widget.md): options, identifying users, single-page apps, mobile apps, troubleshooting, security
`

export const GET = () =>
  new Response(llmsTxt(env.SERVER_URL ?? 'https://www.pulseapp.click'), {
    headers: { 'content-type': 'text/plain; charset=utf-8' },
  })
