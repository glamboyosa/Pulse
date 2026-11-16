'use client'

import { useState } from 'react'
import QRCodeSVG from 'react-qr-code'

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

type Note = { name: string; time: string; summary: string }

const PLACES: Array<{ name: string; notes: [Note, Note] }> = [
  {
    name: 'Lekki',
    notes: [
      {
        name: 'Tobi',
        time: '6 min ago',
        summary: 'Great jollof, but the air conditioning was off.',
      },
      {
        name: 'Kemi',
        time: '2 hr ago',
        summary: 'Waited twenty minutes to pay at the counter.',
      },
    ],
  },
  {
    name: 'Manchester',
    notes: [
      {
        name: 'Hannah',
        time: '4 min ago',
        summary: 'The queue at the till was too long at lunch.',
      },
      {
        name: 'Priya',
        time: '1 hr ago',
        summary: 'Friendly staff, and the room was nice and cool.',
      },
    ],
  },
  {
    name: 'Table 4',
    notes: [
      {
        name: 'Marco',
        time: '12 min ago',
        summary: 'Our waiter checked on us often. Lovely evening.',
      },
      {
        name: 'Sofia',
        time: '3 hr ago',
        summary: 'The table wobbled the whole time we ate.',
      },
    ],
  },
  {
    name: 'Cape Town',
    notes: [
      {
        name: 'Thabo',
        time: '9 min ago',
        summary: 'The coffee was cold by the time it arrived.',
      },
      {
        name: 'Lerato',
        time: '5 hr ago',
        summary: 'Great music, and the staff remembered my order.',
      },
    ],
  },
]

/**
 * One QR code per place, and the dashboard's "Left at" filter showing that
 * place's notes. Picking a code or a filter option selects the same place.
 */
export function BranchesMock() {
  const [picked, setPicked] = useState(() =>
    PLACES.findIndex((place) => place.name === 'Manchester'),
  )

  return (
    <div>
      <ul
        aria-label="Show notes left at"
        className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4 md:grid-cols-2 xl:grid-cols-4"
      >
        {PLACES.map((place, i) => (
          <li key={place.name}>
            <button
              type="button"
              aria-pressed={i === picked}
              onClick={() => setPicked(i)}
              className={`relative w-full cursor-pointer rounded-lg border-2 border-foreground p-2 transition-[transform,box-shadow] duration-150 ease-out before:absolute before:-inset-0.5 sm:p-3 ${
                i === picked
                  ? 'bg-accent shadow-brutal'
                  : 'bg-card shadow-brutal hover:-translate-y-0.5 hover:shadow-brutal-lg hover:before:translate-y-0.5 active:translate-x-[2px] active:translate-y-[2px] active:shadow-none active:before:-translate-x-[2px] active:before:-translate-y-[2px]'
              }`}
            >
              <span
                aria-hidden="true"
                className="block rounded-sm bg-white p-1.5"
              >
                {/* Each code opens the homepage; the fragment only varies the pattern. */}
                <QRCodeSVG
                  value={`https://www.pulseapp.click/#${place.name}`}
                  size={256}
                  style={{ width: '100%', height: 'auto', display: 'block' }}
                />
              </span>
              <span className="mt-2 block truncate text-center text-sm font-bold">
                {place.name}
              </span>
            </button>
          </li>
        ))}
      </ul>

      <div className="rounded-lg border-2 border-foreground bg-card p-4 shadow-brutal-lg sm:p-5">
        <div className="mb-4 flex items-center gap-3">
          <label
            htmlFor="branches-filter"
            className="text-sm font-bold uppercase"
          >
            Left at
          </label>
          <Select
            value={String(picked)}
            onValueChange={(value) => setPicked(Number(value))}
          >
            {/* As wide as "Manchester", so switching places doesn't move it. */}
            <SelectTrigger id="branches-filter" className="min-w-40">
              {/* Given directly, so the server-rendered page shows it too. */}
              <SelectValue>{PLACES[picked].name}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              {PLACES.map((place, i) => (
                <SelectItem key={place.name} value={String(i)}>
                  {place.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {/* Every place's notes share one cell, so the card keeps the height
            of the tallest and the page doesn't jump when switching. */}
        <div className="grid">
          {PLACES.map((place, i) => (
            <ul
              key={place.name}
              className={`col-start-1 row-start-1 space-y-3 ${i === picked ? '' : 'invisible'}`}
            >
              {place.notes.map((note) => (
                <li
                  key={note.name}
                  className="rounded-md border-2 border-foreground p-3"
                >
                  <p className="text-sm font-semibold text-muted-foreground">
                    <span className="font-bold text-foreground">
                      {note.name}
                    </span>{' '}
                    · {note.time}
                  </p>
                  <p className="mt-1 font-display font-bold leading-snug">
                    {note.summary}
                  </p>
                  <span className="mt-2 inline-block border-2 border-foreground bg-foreground px-2 py-0.5 text-xs font-bold uppercase text-background">
                    {place.name}
                  </span>
                </li>
              ))}
            </ul>
          ))}
        </div>
        {/* The lists swap by visibility, which screen readers don't announce. */}
        <p role="status" className="sr-only">
          Showing notes left at {PLACES[picked].name}
        </p>
      </div>
    </div>
  )
}
