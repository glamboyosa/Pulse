import { env } from '@/env'
import { widgetAgentsMarkdown } from '@/lib/widget-agents'

export const GET = () =>
  new Response(
    widgetAgentsMarkdown(env.SERVER_URL ?? 'https://www.pulseapp.click'),
    {
      headers: { 'content-type': 'text/markdown; charset=utf-8' },
    },
  )
