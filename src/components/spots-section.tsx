'use client'

import { useEffect, useRef, useState } from 'react'
import { Download, Link2, MapPin, Plus, Printer, Trash2 } from 'lucide-react'
import Link from 'next/link'
import QRCodeSVG from 'react-qr-code'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import type { Spot } from '@/server/spots'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { downloadQrPng } from '@/lib/qr-download'

const spotUrl = (origin: string, code: string, slug: string) =>
  `${origin}/f/${code}?spot=${slug}`

const readError = async (response: Response) =>
  ((await response.json().catch(() => ({}))) as { error?: string }).error ??
  'Something went wrong. Try again.'

function SpotRow({
  spot,
  origin,
  code,
  onRemove,
  removing,
}: {
  spot: Spot
  /** Null until mounted; copy and download need it. */
  origin: string | null
  code: string
  onRemove: () => void
  removing: boolean
}) {
  const qrRef = useRef<HTMLDivElement>(null)
  const [status, setStatus] = useState<string | null>(null)
  const url = origin ? spotUrl(origin, code, spot.slug) : null

  useEffect(() => {
    if (!status) return
    const clear = setTimeout(() => setStatus(null), 2500)
    return () => clearTimeout(clear)
  }, [status])

  return (
    <li className="flex items-center gap-2 border-2 border-foreground bg-background p-2">
      <span className="flex-1 min-w-0 truncate font-bold" title={spot.name}>
        {spot.name}
      </span>
      <span role="status" className="text-xs font-bold whitespace-nowrap">
        {status}
      </span>
      {/* Rendered off-screen at full size for the PNG download. */}
      <div ref={qrRef} className="sr-only" aria-hidden="true">
        {url && <QRCodeSVG value={url} size={256} level="H" />}
      </div>
      <Button
        size="icon"
        variant="ghost"
        aria-label={`Copy link for ${spot.name}`}
        disabled={!url}
        onClick={() =>
          url &&
          navigator.clipboard
            .writeText(url)
            .then(() => setStatus('Copied'))
            .catch(() => setStatus("Couldn't copy"))
        }
      >
        <Link2 className="size-4" />
      </Button>
      <Button
        size="icon"
        variant="ghost"
        aria-label={`Download QR code for ${spot.name}`}
        disabled={!url}
        onClick={() =>
          qrRef.current &&
          downloadQrPng(qrRef.current, `pulse-qr-${code}-${spot.slug}.png`)
            .then(() => setStatus('Saved'))
            .catch(() => setStatus("Couldn't save"))
        }
      >
        <Download className="size-4" />
      </Button>
      <Button asChild size="icon" variant="ghost">
        <Link
          href={`/print?spot=${spot.slug}`}
          aria-label={`Print table tents for ${spot.name}`}
        >
          <Printer className="size-4" />
        </Link>
      </Button>
      <Button
        size="icon"
        variant="ghost"
        aria-label={`Remove ${spot.name}`}
        disabled={removing}
        onClick={() => {
          if (
            window.confirm(
              `Remove ${spot.name}? Its printed QR code will still work but stop tagging feedback.`,
            )
          ) {
            onRemove()
          }
        }}
      >
        <Trash2 className="size-4" />
      </Button>
    </li>
  )
}

/** Extra QR codes for branches, tables or events, each tagging its feedback. */
export function SpotsSection({
  code,
  initialSpots,
}: {
  code: string
  initialSpots: Array<Spot>
}) {
  const queryClient = useQueryClient()
  // Same address as the main QR code: the one this dashboard is open on.
  const [origin, setOrigin] = useState<string | null>(null)
  useEffect(() => setOrigin(window.location.origin), [])
  const [name, setName] = useState('')
  const [error, setError] = useState<string | null>(null)

  const { data: spots } = useQuery({
    queryKey: ['spots'],
    queryFn: async () => {
      const response = await fetch('/api/spots')
      if (!response.ok) throw new Error(await readError(response))
      return ((await response.json()) as { spots: Array<Spot> }).spots
    },
    initialData: initialSpots,
  })

  const refresh = () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: ['spots'] }),
      queryClient.invalidateQueries({ queryKey: ['feedback'] }),
    ])

  const add = useMutation({
    mutationFn: async (spotName: string) => {
      const response = await fetch('/api/spots', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: spotName }),
      })
      if (!response.ok) throw new Error(await readError(response))
    },
    onSuccess: async (_, added) => {
      // Keep anything typed for the next spot while this one was saving.
      setName((current) => (current === added ? '' : current))
      setError(null)
      await refresh()
    },
    onError: (e: Error) => setError(e.message),
  })

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const response = await fetch(`/api/spots/${id}`, { method: 'DELETE' })
      if (!response.ok) throw new Error(await readError(response))
    },
    onSuccess: async () => {
      setError(null)
      await refresh()
    },
    onError: (e: Error) => setError(e.message),
  })

  return (
    <Card className="p-6 border-4 border-foreground shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] bg-card">
      <div className="flex items-center gap-3 mb-2">
        <MapPin className="size-6" strokeWidth={2.5} />
        <h2 className="text-2xl font-black">SPOTS</h2>
      </div>
      <p className="text-sm font-semibold text-muted-foreground mb-4">
        A QR code per branch, table or event. Feedback from each is tagged so
        you can filter by it.
      </p>

      <form
        className="flex gap-2 mb-4"
        onSubmit={(event) => {
          event.preventDefault()
          if (name.trim()) add.mutate(name)
        }}
      >
        <label htmlFor="spot-name" className="sr-only">
          New spot name
        </label>
        <Input
          id="spot-name"
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="Table 4, Lekki branch…"
          maxLength={60}
          className="border-4 border-foreground font-semibold text-base"
        />
        <Button
          type="submit"
          disabled={add.isPending || !name.trim()}
          className="border-4 border-foreground font-bold"
        >
          <Plus className="size-4 mr-1" />
          ADD
        </Button>
      </form>

      {error && (
        <p role="alert" className="text-sm font-bold text-red-700 mb-3">
          {error}
        </p>
      )}

      {spots.length > 0 && (
        <ul className="space-y-2">
          {spots.map((spot) => (
            <SpotRow
              key={spot.id}
              spot={spot}
              origin={origin}
              code={code}
              onRemove={() => remove.mutate(spot.id)}
              removing={remove.isPending && remove.variables === spot.id}
            />
          ))}
        </ul>
      )}
    </Card>
  )
}
