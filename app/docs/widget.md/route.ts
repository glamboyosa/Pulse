import { env } from '@/env'
import { widgetDocsMarkdown } from '@/lib/widget-docs'

export const GET = () =>
  new Response(
    widgetDocsMarkdown(env.SERVER_URL ?? 'https://www.pulseapp.click'),
    {
      headers: { 'content-type': 'text/markdown; charset=utf-8' },
    },
  )
