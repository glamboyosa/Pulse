'use client'

import { useEffect, useRef, useState } from 'react'
import { Check, Copy } from 'lucide-react'

import type { WidgetSettings as Settings } from '@/server/widget'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Label } from '@/components/ui/label'

const readError = async (response: Response | null) =>
  response
    ? (((await response.json().catch(() => ({}))) as { error?: string })
        .error ?? 'Something went wrong. Try again.')
    : 'Check your connection and try again.'

/** Settings for the website widget: turn it on, install it, list the sites. */
export function WidgetSettings({
  initial,
  appUrl,
}: {
  initial: Settings
  appUrl: string
}) {
  const [key, setKey] = useState(initial.key)
  const [sites, setSites] = useState(initial.origins.join('\n'))
  const [saved, setSaved] = useState(false)
  const [copied, setCopied] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const card = useRef<HTMLDivElement>(null)

  // Onboarding sends website owners here to set the widget up first.
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get('setup') === 'widget') {
      card.current?.scrollIntoView({ block: 'start' })
    }
  }, [])

  const snippet = key
    ? `<script src="${appUrl}/widget.js" data-key="${key}" async></script>`
    : ''

  const request = async (method: string, path: string, body?: unknown) => {
    setBusy(true)
    setError(null)
    const response = await fetch(path, {
      method,
      headers: { 'Content-Type': 'application/json' },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    }).catch(() => null)
    setBusy(false)
    if (response?.ok) return (await response.json()) as Record<string, unknown>
    setError(await readError(response))
    return null
  }

  const createKey = async () => {
    const result = await request('POST', '/api/settings/widget/key')
    if (typeof result?.key === 'string') setKey(result.key)
  }

  const replaceKey = async () => {
    if (
      !window.confirm(
        'Make a new key? The current snippet stops working until you paste the new one.',
      )
    )
      return
    await createKey()
  }

  const turnOff = async () => {
    if (!window.confirm('Turn the widget off on every site that uses it?')) {
      return
    }
    if (await request('DELETE', '/api/settings/widget/key')) setKey(null)
  }

  const saveSites = async (event: React.FormEvent) => {
    event.preventDefault()
    const result = await request('PUT', '/api/settings/widget/origins', {
      origins: sites.split('\n'),
    })
    if (Array.isArray(result?.origins)) {
      setSites((result.origins as Array<string>).join('\n'))
      setSaved(true)
    }
  }

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(snippet)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      setError("Couldn't copy here. Select the snippet and copy it instead.")
    }
  }

  return (
    <Card
      ref={card}
      className="scroll-mt-6 p-6 border-2 border-foreground shadow-brutal bg-card space-y-4"
    >
      <div>
        <h2 className="text-2xl font-black">Website widget</h2>
        <p className="font-semibold text-muted-foreground">
          A feedback button for your website or app. Each note arrives with the
          page it was left on, and spends one pulse.
        </p>
      </div>

      {!key ? (
        <Button onClick={createKey} disabled={busy}>
          Turn on the widget
        </Button>
      ) : (
        <>
          <div className="space-y-2">
            <Label className="font-bold">
              1. Paste this before &lt;/body&gt; on your site
            </Label>
            <pre className="overflow-x-auto border-2 border-foreground bg-secondary p-3 text-sm">
              <code>{snippet}</code>
            </pre>
            <Button variant="outline" onClick={copy}>
              {copied ? (
                <Check className="size-4" />
              ) : (
                <Copy className="size-4" />
              )}
              {copied ? 'Copied' : 'Copy snippet'}
            </Button>
          </div>

          <form onSubmit={saveSites} className="space-y-2">
            <Label htmlFor="widget-sites" className="font-bold">
              2. Websites allowed to show it, one per line
            </Label>
            <textarea
              id="widget-sites"
              value={sites}
              onChange={(event) => {
                // One site per line: a typed or pasted comma becomes a new line.
                const field = event.target
                const before = field.value.slice(0, field.selectionStart)
                const toNewLines = (text: string) =>
                  text.replace(/[ \t]*,[ \t]*/g, '\n')
                const cursor = toNewLines(before).length
                setSites(toNewLines(field.value))
                setSaved(false)
                // Keep the cursor where the person was typing.
                requestAnimationFrame(() =>
                  field.setSelectionRange(cursor, cursor),
                )
              }}
              rows={3}
              placeholder={'example.com\napp.example.com'}
              className="w-full border-2 border-foreground bg-background p-3 font-semibold text-base"
            />
            <Button type="submit" disabled={busy}>
              {saved ? 'Saved' : 'Save websites'}
            </Button>
          </form>

          <div className="flex flex-wrap gap-3 border-t-2 border-foreground pt-4">
            <Button variant="outline" onClick={replaceKey} disabled={busy}>
              Make a new key
            </Button>
            <Button variant="outline" onClick={turnOff} disabled={busy}>
              Turn off
            </Button>
          </div>
        </>
      )}

      {error && (
        <p role="alert" className="font-bold text-destructive">
          {error}
        </p>
      )}
    </Card>
  )
}
