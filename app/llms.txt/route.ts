import { env } from '@/env'

const llmsTxt = (appUrl: string) => `# Pulse

> Voice feedback for businesses. Customers record a short voice note from a QR code, a website button or a mobile app, and the business reads it transcribed and translated.

Agents adding the feedback widget to a website or React Native app for a user should follow the setup guide below.

## Docs

- [Setup guide for coding agents](${appUrl}/agents.md): getting the key, website and React Native install, permissions, checks
- [Widget guide](${appUrl}/docs/widget.md): options, identifying users, single-page apps, mobile apps, troubleshooting, security
`

export const GET = () =>
  new Response(llmsTxt(env.SERVER_URL ?? 'https://www.pulseapp.click'), {
    headers: { 'content-type': 'text/plain; charset=utf-8' },
  })
