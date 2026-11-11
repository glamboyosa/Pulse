'use client'

import { useState } from 'react'

import type { Framework } from '@/lib/widget-snippet'
import { CopyButton } from '@/components/copy-button'
import { DOCS_KEY } from '@/lib/widget-docs'
import {
  DEFAULT_WIDGET_OPTIONS,
  FRAMEWORKS,
  frameworkExample,
} from '@/lib/widget-snippet'

/** The install code for each stack, one at a time. */
export function DocsInstallTabs({ appUrl }: { appUrl: string }) {
  const [framework, setFramework] = useState<Framework>('html')
  const code = frameworkExample(
    framework,
    appUrl,
    DOCS_KEY,
    DEFAULT_WIDGET_OPTIONS,
  )

  return (
    <div className="space-y-3">
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
            onClick={() => setFramework(item.id)}
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
