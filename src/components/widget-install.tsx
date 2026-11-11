'use client'

import { useState } from 'react'
import { Check, Copy, Mic } from 'lucide-react'

import type {
  Framework,
  WidgetOptions,
  WidgetShape,
} from '@/lib/widget-snippet'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  DEFAULT_WIDGET_OPTIONS,
  FRAMEWORKS,
  LABEL_SUGGESTIONS,
  frameworkExample,
} from '@/lib/widget-snippet'

const SHAPES: Array<{ id: WidgetShape; name: string }> = [
  { id: 'pill', name: 'Pill' },
  { id: 'square', name: 'Square' },
  { id: 'circle', name: 'Round icon' },
  { id: 'bubble', name: 'Message bubble' },
]

/** Black or white for a #rrggbb fill, the same rule widget.js uses. */
const textOn = (hex: string) => {
  const [r, g, b] = [1, 3, 5].map((at) =>
    Number.parseInt(hex.slice(at, at + 2), 16),
  )
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255 > 0.6 ? '#111111' : '#ffffff'
}

const toggleClass = (on: boolean) =>
  `border-2 border-foreground px-3 py-2 text-sm font-bold transition-colors ${
    on ? 'bg-foreground text-background' : 'bg-background hover:bg-muted'
  }`

/** What the button will look like, drawn the way widget.js draws it. */
function Preview({ options }: { options: WidgetOptions }) {
  const auto = options.color === 'auto'
  const radius = {
    pill: '999px',
    square: '6px',
    circle: '999px',
    bubble:
      options.position === 'right'
        ? '20px 20px 4px 20px'
        : '20px 20px 20px 4px',
  }[options.shape]
  const button = (dark: boolean) => (
    <span
      className="absolute bottom-3 inline-flex items-center justify-center border-2 font-bold"
      style={{
        [options.position]: '12px',
        borderRadius: radius,
        background: auto ? (dark ? '#fff' : '#111') : options.color,
        color: auto ? (dark ? '#111' : '#fff') : textOn(options.color),
        borderColor: auto && dark ? '#fff' : '#111',
        padding: options.shape === 'circle' ? 0 : '10px 16px',
        width: options.shape === 'circle' ? 48 : undefined,
        height: options.shape === 'circle' ? 48 : undefined,
        fontSize: 14,
      }}
    >
      {options.shape === 'circle' ? (
        <Mic className="size-5" aria-hidden="true" />
      ) : (
        options.label.trim() || DEFAULT_WIDGET_OPTIONS.label
      )}
    </span>
  )
  return (
    <div
      aria-hidden="true"
      className="grid select-none grid-cols-2 gap-3 pointer-events-none"
    >
      <div className="relative h-28 rounded-md border-2 border-foreground bg-white">
        <span className="absolute top-2 left-3 text-xs font-bold text-neutral-500">
          Light page
        </span>
        {button(false)}
      </div>
      <div className="relative h-28 rounded-md border-2 border-foreground bg-neutral-900">
        <span className="absolute top-2 left-3 text-xs font-bold text-neutral-400">
          Dark page
        </span>
        {button(true)}
      </div>
    </div>
  )
}

/** Choose how the widget looks, then copy the install code for your stack. */
export function WidgetInstall({
  widgetKey,
  appUrl,
}: {
  widgetKey: string
  appUrl: string
}) {
  const [options, setOptions] = useState(DEFAULT_WIDGET_OPTIONS)
  const [framework, setFramework] = useState<Framework>('html')
  const [copied, setCopied] = useState(false)
  const [copyFailed, setCopyFailed] = useState(false)
  const set = <TKey extends keyof WidgetOptions>(
    name: TKey,
    value: WidgetOptions[TKey],
  ) => setOptions((current) => ({ ...current, [name]: value }))

  const code = frameworkExample(framework, appUrl, widgetKey, options)

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code)
      setCopyFailed(false)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      setCopyFailed(true)
    }
  }

  return (
    <div className="space-y-6">
      <fieldset className="space-y-4">
        <legend className="mb-2 font-bold">2. Make it yours</legend>

        <div className="space-y-2">
          <Label htmlFor="widget-label">Button text</Label>
          <Input
            id="widget-label"
            value={options.label}
            maxLength={40}
            onChange={(event) => set('label', event.target.value)}
            className="border-2 border-foreground font-semibold text-base"
          />
          <div className="flex flex-wrap gap-2">
            {LABEL_SUGGESTIONS.map((suggestion) => (
              <button
                key={suggestion}
                type="button"
                aria-pressed={options.label === suggestion}
                onClick={() => set('label', suggestion)}
                className={toggleClass(options.label === suggestion)}
              >
                {suggestion}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          <span id="widget-shape" className="text-sm font-bold">
            Shape
          </span>
          <div
            role="group"
            aria-labelledby="widget-shape"
            className="flex flex-wrap gap-2"
          >
            {SHAPES.map((shape) => (
              <button
                key={shape.id}
                type="button"
                aria-pressed={options.shape === shape.id}
                onClick={() => set('shape', shape.id)}
                className={toggleClass(options.shape === shape.id)}
              >
                {shape.name}
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-wrap items-end gap-6">
          <div className="space-y-2">
            <span id="widget-colour" className="text-sm font-bold">
              Colour
            </span>
            <div
              role="group"
              aria-labelledby="widget-colour"
              className="flex flex-wrap items-center gap-2"
            >
              <button
                type="button"
                aria-pressed={options.color === 'auto'}
                onClick={() => set('color', 'auto')}
                className={toggleClass(options.color === 'auto')}
              >
                Match light / dark
              </button>
              <label className="inline-flex items-center gap-2 text-sm font-bold">
                <input
                  type="color"
                  value={options.color === 'auto' ? '#111111' : options.color}
                  onChange={(event) => set('color', event.target.value)}
                  className="size-10 cursor-pointer border-2 border-foreground bg-background"
                />
                Your colour
              </label>
            </div>
          </div>
          <div className="space-y-2">
            <span id="widget-corner" className="text-sm font-bold">
              Corner
            </span>
            <div
              role="group"
              aria-labelledby="widget-corner"
              className="flex gap-2"
            >
              {(['left', 'right'] as const).map((side) => (
                <button
                  key={side}
                  type="button"
                  aria-pressed={options.position === side}
                  onClick={() => set('position', side)}
                  className={toggleClass(options.position === side)}
                >
                  {side === 'left' ? 'Bottom left' : 'Bottom right'}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="widget-heading">Panel title</Label>
          <Input
            id="widget-heading"
            value={options.heading}
            maxLength={120}
            placeholder="Your question from the feedback page settings"
            onChange={(event) => set('heading', event.target.value)}
            className="border-2 border-foreground font-semibold text-base"
          />
        </div>

        <Preview options={options} />
      </fieldset>

      <div className="space-y-3">
        <span id="widget-stack" className="block font-bold">
          3. Add it to your site
        </span>
        <div
          role="group"
          aria-labelledby="widget-stack"
          className="flex flex-wrap gap-2"
        >
          {FRAMEWORKS.map((item) => (
            <button
              key={item.id}
              type="button"
              aria-pressed={framework === item.id}
              onClick={() => setFramework(item.id)}
              className={toggleClass(framework === item.id)}
            >
              {item.name}
            </button>
          ))}
        </div>
        <pre
          aria-label="Install code"
          className="max-h-96 overflow-auto border-2 border-foreground bg-secondary p-3 text-sm"
        >
          <code>{code}</code>
        </pre>
        <div className="flex flex-wrap items-center gap-4">
          <Button
            variant="outline"
            onClick={copy}
            className="active:scale-[0.96] transition-transform"
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
            <span aria-live="polite">{copied ? 'Copied' : 'Copy code'}</span>
          </Button>
          <a
            href="/docs/widget"
            className="font-bold underline underline-offset-4"
          >
            Full guide
          </a>
        </div>
        {copyFailed && (
          <p role="alert" className="font-bold text-destructive">
            Couldn&apos;t copy here. Select the code and copy it instead.
          </p>
        )}
      </div>
    </div>
  )
}
