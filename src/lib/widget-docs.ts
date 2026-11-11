// The widget guide, written once: the /docs/widget page renders it and
// /docs/widget.md serves it as Markdown for people and AI assistants.
import {
  DEFAULT_WIDGET_OPTIONS,
  FRAMEWORKS,
  frameworkExample,
} from './widget-snippet'

export type DocBlock =
  | { kind: 'text'; text: string }
  | { kind: 'list'; items: Array<string> }
  | { kind: 'code'; language: string; code: string }
  | { kind: 'question'; text: string }
  /** Install code for each framework: tabs on the page, one block each in Markdown. */
  | { kind: 'install' }

export type DocSection = { id: string; title: string; blocks: Array<DocBlock> }

export const DOCS_KEY = 'pk_your_key'

const IDENTIFY_NEXT = `// app/pulse-user.tsx
'use client'

import { useEffect } from 'react'

declare global {
  interface Window {
    PulseQueue?: { push(call: [string, unknown?]): unknown }
  }
}

export function PulseUser({ id, email }: { id: string; email?: string }) {
  useEffect(() => {
    window.PulseQueue ??= []
    window.PulseQueue.push(['identify', { id, email }])
  }, [id, email])
  return null
}`

export const widgetDocs = (appUrl: string): Array<DocSection> => [
  {
    id: 'install',
    title: 'Install',
    blocks: [
      {
        kind: 'text',
        text: 'In Pulse, open Settings and turn on the website widget. List the sites that may show it, one per line, such as `https://example.com` or `http://localhost:3000`. Then add the script to every page. Settings shows this code with your own key filled in.',
      },
      { kind: 'install' },
    ],
  },
  {
    id: 'options',
    title: 'Options',
    blocks: [
      {
        kind: 'text',
        text: 'Set these as attributes on the script tag. Settings has a preview and writes them for you.',
      },
      {
        kind: 'list',
        items: [
          '`data-label`: the button text, up to 40 characters. Default "Feedback".',
          '`data-shape`: `pill` (default), `square`, `circle` (a microphone icon, with the label read out by screen readers) or `bubble`.',
          '`data-color`: `auto` (default) is black or white, whichever stands out against the page background, read from `<html>`, `<body>` or a full-page wrapper. It switches when your site changes theme on `<html>` or `<body>`. Any CSS colour also works, and the text turns black or white to stay readable.',
          '`data-position`: `right` (default) or `left`.',
          '`data-heading`: the title above the recorder, up to 120 characters. Default: the question from your feedback page settings.',
        ],
      },
      {
        kind: 'code',
        language: 'html',
        code: `<script src="${appUrl}/widget.js" data-key="${DOCS_KEY}" data-label="Ask a question" data-shape="bubble" data-color="#e11d48" data-position="left" data-heading="What can we help with?" async></script>`,
      },
    ],
  },
  {
    id: 'users',
    title: 'Say who is leaving feedback',
    blocks: [
      {
        kind: 'text',
        text: 'Each note already comes with the page path, page title, referring site, browser, screen size and language. You can add who the user is and anything else that helps, such as the app version or plan. Push calls to `PulseQueue`: they work before the script has loaded, and run straight away after.',
      },
      {
        kind: 'code',
        language: 'js',
        code: `window.PulseQueue = window.PulseQueue || []
PulseQueue.push(['identify', { id: '42', email: 'ada@example.com' }])
PulseQueue.push(['setContext', { appVersion: '3.1.0', plan: 'pro' }])`,
      },
      {
        kind: 'text',
        text: 'Each call replaces what the last one set. `setContext` keeps up to 10 fields besides `appVersion`. Field names can use letters, numbers, `_`, `.` and `-`, up to 40 characters; values are cut to 200 characters. Keep it small: if everything together passes 4 KB, the note arrives without any page or user details. In Next.js, call it from a Client Component and render it in your layout once you know the user:',
      },
      { kind: 'code', language: 'tsx', code: IDENTIFY_NEXT },
      {
        kind: 'text',
        text: 'Once loaded, `window.Pulse` has the same calls plus `Pulse.open()` and `Pulse.close()`, so your own "Send feedback" link can open the panel.',
      },
    ],
  },
  {
    id: 'single-page-apps',
    title: 'Single-page apps',
    blocks: [
      {
        kind: 'text',
        text: 'Nothing to set up. The widget follows route changes made with the History API (Next.js, React Router, Vue Router, SvelteKit and others), so a note records the page the user is on when they send it. If your router replaces `<body>` (Astro view transitions, Turbo), the button is put back on the new page.',
      },
      {
        kind: 'text',
        text: 'Server Components are fine too: the script runs in the browser, and `next/script` can sit in a Server Component layout.',
      },
    ],
  },
  {
    id: 'troubleshooting',
    title: 'Troubleshooting',
    blocks: [
      { kind: 'question', text: "The button doesn't appear" },
      {
        kind: 'list',
        items: [
          'Open the browser console. A Content-Security-Policy error means your site blocks the script: see below.',
          'Some ad and tracker blockers hide third-party widgets. Try a private window without extensions.',
        ],
      },
      {
        kind: 'question',
        text: 'The panel is blank or says the page refused to connect',
      },
      {
        kind: 'list',
        items: [
          'The widget is turned off in Settings, or the key on your site is not the one in Settings. Making a new key stops the old one.',
          "The site isn't in your list in Settings. It must match exactly: `https://www.example.com` and `https://example.com` are different sites, and so are different ports.",
          "Your Content-Security-Policy doesn't allow the frame. Add Pulse to `frame-src`.",
        ],
      },
      { kind: 'question', text: 'My site has a Content-Security-Policy' },
      {
        kind: 'text',
        text: 'Add Pulse to your existing `script-src` and `frame-src` directives, keeping what is already there:',
      },
      {
        kind: 'code',
        language: 'text',
        code: `script-src 'self' ${appUrl};\nframe-src ${appUrl};`,
      },
      {
        kind: 'text',
        text: "If your policy uses a nonce or `'strict-dynamic'`, the list of sites is ignored for scripts: give the widget's script tag your page's nonce instead. With `next/script`, pass it as the `nonce` prop.",
      },
      { kind: 'question', text: 'Recording says the microphone is blocked' },
      {
        kind: 'list',
        items: [
          `If your site sends a Permissions-Policy header, it must allow the microphone for Pulse: \`microphone=("${appUrl}")\`. Add \`self\` too if your own pages use the microphone.`,
          'The visitor may have blocked the microphone for your site. They can allow it from the icon in the address bar.',
        ],
      },
      { kind: 'question', text: 'Testing on localhost' },
      {
        kind: 'text',
        text: 'Add `http://localhost:3000` (with your port) to the list in Settings. Notes from localhost spend pulses like any other.',
      },
    ],
  },
  {
    id: 'security',
    title: 'Security and privacy',
    blocks: [
      {
        kind: 'list',
        items: [
          "The recorder runs in an iframe served by Pulse. Your page's scripts can't read recordings. The widget script runs on your page like any other script; it reads only what this guide lists and adds only its own button and panel, and wraps `history.pushState` and `replaceState` to notice route changes.",
          'Only the sites in your list can open the panel. Browsers refuse to load it anywhere else.',
          "The key is public, like a publishable API key. It can only open your widget on your listed sites; it can't read feedback.",
          'Pulse only gets the page path, never the query string or fragment, which often hold tokens. Referring sites are cut to their origin.',
          "`identify` and `setContext` aren't verified. Treat them as hints, not proof of who someone is.",
          'The microphone is only used after the visitor taps record. Closing the panel stops the recording and releases the microphone.',
          'A bot check (Cloudflare Turnstile) runs before each note is accepted.',
        ],
      },
      {
        kind: 'text',
        text: 'Each note spends one pulse. See the privacy policy for what Pulse keeps and for how long.',
      },
    ],
  },
]

/** The whole guide as Markdown, with every framework's install code. */
export const widgetDocsMarkdown = (appUrl: string) => {
  const lines = [
    '# Pulse website widget',
    '',
    'A voice feedback button for your website or app.',
  ]
  for (const section of widgetDocs(appUrl)) {
    lines.push('', `## ${section.title}`)
    for (const block of section.blocks) {
      if (block.kind === 'text') lines.push('', block.text)
      if (block.kind === 'question') lines.push('', `### ${block.text}`)
      if (block.kind === 'list') {
        lines.push('', ...block.items.map((item) => `- ${item}`))
      }
      if (block.kind === 'code') {
        lines.push('', '```' + block.language, block.code, '```')
      }
      if (block.kind === 'install') {
        for (const framework of FRAMEWORKS) {
          lines.push(
            '',
            `### ${framework.name}`,
            '',
            '```',
            frameworkExample(
              framework.id,
              appUrl,
              DOCS_KEY,
              DEFAULT_WIDGET_OPTIONS,
            ),
            '```',
          )
        }
      }
    }
  }
  return lines.join('\n') + '\n'
}
