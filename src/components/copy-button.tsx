'use client'

import { useState } from 'react'
import { Check, Copy } from 'lucide-react'

import { Button } from '@/components/ui/button'

/** Copies text, swapping its icon for a tick while "Copied" shows. */
export function CopyButton({
  text,
  label = 'Copy code',
  describes,
}: {
  text: string
  label?: string
  /** Read out after the label when a page has several copy buttons. */
  describes?: string
}) {
  const [copied, setCopied] = useState(false)
  const [failed, setFailed] = useState(false)

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text)
      setFailed(false)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      setFailed(true)
    }
  }

  return (
    <span className="inline-flex flex-wrap items-center gap-3">
      <Button
        variant="outline"
        onClick={copy}
        className="transition-transform active:scale-[0.96]"
      >
        <span className="relative size-4">
          <Copy
            aria-hidden="true"
            className={`absolute inset-0 size-4 transition-[opacity,transform] duration-150 ${copied ? 'scale-50 opacity-0' : 'scale-100 opacity-100'}`}
          />
          <Check
            aria-hidden="true"
            className={`absolute inset-0 size-4 transition-[opacity,transform] duration-150 ${copied ? 'scale-100 opacity-100' : 'scale-50 opacity-0'}`}
          />
        </span>
        <span aria-live="polite">{copied ? 'Copied' : label}</span>
        {describes && <span className="sr-only">: {describes}</span>}
      </Button>
      {failed && (
        <span role="alert" className="font-bold text-destructive">
          Couldn&apos;t copy here. Select the text and copy it instead.
        </span>
      )}
    </span>
  )
}
