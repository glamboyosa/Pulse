'use client'

import { useEffect, useRef, useState } from 'react'

import type { Framework } from '@/lib/widget-snippet'
import { CopyButton } from '@/components/copy-button'
import { DOCS_KEY } from '@/lib/widget-docs'
import {
  DEFAULT_WIDGET_OPTIONS,
  FRAMEWORKS,
  frameworkExample,
} from '@/lib/widget-snippet'

const linkTo = (id: Framework) => `#install-${id}`

/**
 * The install code for each stack, one at a time. A link such as
 * /docs/widget#install-next opens on that stack's code.
 */
export function DocsInstallTabs({ appUrl }: { appUrl: string }) {
  const [framework, setFramework] = useState<Framework>('html')
  const tabs = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const followLink = () => {
      const linked = FRAMEWORKS.find(
        (item) => linkTo(item.id) === window.location.hash,
      )
      if (!linked) return
      setFramework(linked.id)
      tabs.current?.scrollIntoView()
    }
    followLink()
    window.addEventListener('hashchange', followLink)
    return () => window.removeEventListener('hashchange', followLink)
  }, [])

  const code = frameworkExample(
    framework,
    appUrl,
    DOCS_KEY,
    DEFAULT_WIDGET_OPTIONS,
  )

  return (
    <div ref={tabs} className="scroll-mt-6 space-y-3">
      <div
        role="group"
        aria-label="Your stack"
        className="flex flex-wrap gap-2"
      >
        {FRAMEWORKS.map((item) => (
          <button
            key={item.id}
            type="button"
            aria-pressed={framework === item.id}
            onClick={() => {
              setFramework(item.id)
              // So the address bar holds a link to this stack's code.
              history.replaceState(null, '', linkTo(item.id))
            }}
            className={`border-2 border-foreground px-3 py-2 text-sm font-bold transition-colors ${
              framework === item.id
                ? 'bg-foreground text-background'
                : 'bg-background hover:bg-muted'
            }`}
          >
            {item.name}
          </button>
        ))}
      </div>
      <pre className="overflow-x-auto border-2 border-foreground bg-secondary p-4 text-sm leading-relaxed">
        <code>{code}</code>
      </pre>
      <CopyButton text={code} describes="install code" />
    </div>
  )
}
