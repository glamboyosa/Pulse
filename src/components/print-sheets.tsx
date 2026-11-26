'use client'

import { useState, useSyncExternalStore } from 'react'
import { ArrowLeft, Printer } from 'lucide-react'
import Link from 'next/link'
import QRCodeSVG from 'react-qr-code'

import type { Spot } from '@/server/spots'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Button } from '@/components/ui/button'

type Layout = 'tent' | 'stickers'

const subscribeOrigin = () => () => {}

// Not a possible spot slug, so a spot named "All" can't clash with it.
const EVERY_SPOT = '*'
// The Select can't use '' for the main code; slugs never contain '~'.
const MAIN_CODE = '~'
const LAYOUTS: Record<Layout, string> = {
  tent: 'Table tent (folds in half)',
  stickers: 'Stickers, 6 per sheet',
}

type Label = { url: string; spotName: string | null }

/** Question size by length, so up to 120 characters fit on a tent or sticker. */
const questionSize = (question: string, compact: boolean) => {
  if (compact) return question.length > 60 ? 'text-[8pt]' : 'text-[11pt]'
  if (question.length > 90) return 'text-[14pt]'
  if (question.length > 50) return 'text-[18pt]'
  return 'text-[24pt]'
}

/** One side of a tent, or one sticker: logo, question, QR, a short instruction. */
function Card({
  label,
  businessName,
  question,
  logoUrl,
  compact,
}: {
  label: Label
  businessName: string
  question: string | null
  logoUrl: string | null
  compact: boolean
}) {
  const text = question ?? 'How did we do?'
  return (
    <div
      data-print-card
      className={`flex h-full flex-col items-center justify-center overflow-hidden text-center text-black ${compact ? 'gap-[1.5mm] p-[4mm]' : 'gap-[4mm] p-[10mm]'}`}
    >
      <div className="flex max-w-full items-center gap-[3mm]">
        {logoUrl && (
          <img
            src={logoUrl}
            alt=""
            className={`shrink-0 object-contain ${compact ? 'size-[8mm]' : 'size-[14mm]'}`}
          />
        )}
        <span
          className={`min-w-0 font-black leading-tight break-words ${compact ? 'text-[8pt] line-clamp-1' : 'text-[16pt] line-clamp-2'}`}
        >
          {businessName}
        </span>
      </div>
      <p
        className={`max-w-full font-black leading-tight text-balance break-words ${questionSize(text, compact)}`}
      >
        {text}
      </p>
      <div
        className={`shrink-0 border-[1.5mm] border-black bg-white p-[2.5mm] ${compact ? 'w-[28mm]' : 'w-[56mm]'}`}
      >
        <QRCodeSVG
          value={label.url}
          level="H"
          style={{ width: '100%', height: 'auto' }}
        />
      </div>
      <p className={`font-bold ${compact ? 'text-[7pt]' : 'text-[13pt]'}`}>
        Scan and tell us in a quick voice note. No app needed.
      </p>
      {/* For phones that won't scan: the address to type. */}
      <p
        data-print-url
        className={`max-w-full font-mono break-all ${compact ? 'text-[6pt]' : 'text-[9pt]'}`}
      >
        {label.url.replace(/^https?:\/\/(www\.)?/, '')}
      </p>
      {label.spotName && (
        <p
          className={`max-w-full truncate border-[0.6mm] border-black px-[3mm] py-[0.5mm] font-bold uppercase ${compact ? 'text-[7pt]' : 'text-[10pt]'}`}
        >
          {label.spotName}
        </p>
      )}
    </div>
  )
}

/**
 * Print-ready table tents and stickers. The browser's print dialog saves them
 * as a PDF; the sizes are in millimetres for A4.
 */
export function PrintSheets({
  code,
  businessName,
  question,
  logoUrl,
  spots,
  initialSpot,
}: {
  code: string
  businessName: string
  question: string | null
  logoUrl: string | null
  spots: Array<Spot>
  /** '' for the main QR code, or one spot's slug. */
  initialSpot: string
}) {
  const origin = useSyncExternalStore(
    subscribeOrigin,
    () => window.location.origin,
    () => null,
  )
  const [layout, setLayout] = useState<Layout>('tent')
  const [spot, setSpot] = useState(initialSpot)

  const labelFor = (s: Spot | null): Label => ({
    url: `${origin}/f/${code}${s ? `?spot=${s.slug}` : ''}`,
    spotName: s?.name ?? null,
  })
  const labels: Array<Label> =
    spot === EVERY_SPOT
      ? spots.map(labelFor)
      : [labelFor(spots.find((s) => s.slug === spot) ?? null)]
  // Stickers: six to a sheet, repeating a single code to fill the page.
  const stickers =
    labels.length === 1
      ? Array.from({ length: 6 }, (_, slot) => ({
          id: `${labels[0].url}#${slot}`,
          label: labels[0],
        }))
      : labels.map((label) => ({ id: label.url, label }))
  const stickerPages = Array.from(
    { length: Math.ceil(stickers.length / 6) },
    (_, page) => ({
      id: `page-${page + 1}`,
      number: page + 1,
      items: stickers.slice(page * 6, page * 6 + 6),
    }),
  )

  const card = (label: Label, compact: boolean) => (
    <Card
      label={label}
      businessName={businessName}
      question={question}
      logoUrl={logoUrl}
      compact={compact}
    />
  )

  return (
    <main id="main" className="min-h-dvh bg-secondary print:bg-white">
      <style>{'@page { size: A4; margin: 0 }'}</style>

      <div className="mx-auto max-w-3xl p-4 md:p-8 print:hidden">
        <Link
          href="/dashboard"
          className="mb-6 inline-flex items-center gap-2 font-bold"
        >
          <ArrowLeft className="size-4" />
          Back to Dashboard
        </Link>
        <h1 className="mb-2 text-4xl font-black">PRINT YOUR QR CODES</h1>
        <p className="mb-6 font-semibold text-muted-foreground">
          Print on A4, or choose “Save as PDF” to send to a print shop. Fold
          tents along the middle.
        </p>
        <div className="flex flex-wrap items-end gap-4 border-4 border-foreground bg-card p-4 shadow-brutal">
          <div className="flex flex-col gap-1">
            <label htmlFor="print-layout" className="font-bold">
              Layout
            </label>
            <Select
              value={layout}
              onValueChange={(value) => setLayout(value as Layout)}
            >
              <SelectTrigger id="print-layout">
                <SelectValue>{LAYOUTS[layout]}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                {Object.entries(LAYOUTS).map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="print-code" className="font-bold">
              QR code
            </label>
            <Select
              value={spot || MAIN_CODE}
              onValueChange={(value) =>
                setSpot(value === MAIN_CODE ? '' : value)
              }
            >
              <SelectTrigger id="print-code">
                <SelectValue>
                  {spot === EVERY_SPOT
                    ? 'Every branch & table'
                    : (spots.find((s) => s.slug === spot)?.name ?? 'Main code')}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={MAIN_CODE}>Main code</SelectItem>
                {spots.map((s) => (
                  <SelectItem key={s.id} value={s.slug}>
                    {s.name}
                  </SelectItem>
                ))}
                {spots.length > 1 && (
                  <SelectItem value={EVERY_SPOT}>
                    Every branch &amp; table
                  </SelectItem>
                )}
              </SelectContent>
            </Select>
          </div>
          <Button
            type="button"
            onClick={() => window.print()}
            disabled={!origin}
            className="ml-auto border-4 border-foreground before:-inset-1 px-6 py-5 text-lg font-bold shadow-brutal-sm"
          >
            <Printer className="mr-2 size-5" />
            PRINT
          </Button>
        </div>
      </div>

      {origin && (
        // Sheets are A4-wide; on a phone the preview scrolls sideways.
        <div
          tabIndex={0}
          role="region"
          aria-label="Print preview"
          className="overflow-x-auto pb-12 print:overflow-visible print:p-0"
        >
          <div className="mx-auto flex w-max flex-col gap-8 px-4 print:block print:gap-0 print:px-0">
            {layout === 'tent'
              ? labels.map((label) => (
                  <section
                    key={label.url}
                    aria-label={`Table tent ${label.spotName ?? 'main code'}`}
                    className="grid h-[297mm] w-[210mm] grid-rows-2 bg-white shadow-lg print:break-after-page print:shadow-none"
                  >
                    {/* The top half is upside down, so both faces read upright once folded. */}
                    <div className="rotate-180 overflow-hidden">
                      {card(label, false)}
                    </div>
                    {/* The fold line, on the face that isn't rotated. */}
                    <div className="overflow-hidden border-t border-dashed border-gray-400">
                      {card(label, false)}
                    </div>
                  </section>
                ))
              : stickerPages.map((page) => (
                  <section
                    key={page.id}
                    aria-label={`Sticker sheet ${page.number}`}
                    className="grid h-[297mm] w-[210mm] grid-cols-2 grid-rows-3 gap-[6mm] bg-white p-[12mm] shadow-lg print:break-after-page print:shadow-none"
                  >
                    {page.items.map((item) => (
                      <div
                        key={item.id}
                        className="overflow-hidden border border-dashed border-gray-400"
                      >
                        {card(item.label, true)}
                      </div>
                    ))}
                  </section>
                ))}
          </div>
        </div>
      )}
    </main>
  )
}
