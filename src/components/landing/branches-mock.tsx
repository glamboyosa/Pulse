import QRCodeSVG from 'react-qr-code'

const PLACES = ['Lekki', 'Manchester', 'Table 4', 'Cape Town']
const PICKED = 'Manchester'

const NOTES = [
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
]

/**
 * A code-built picture of one QR code per place, and the dashboard filtered to
 * one of them. Decorative: the section's text says the same thing.
 */
export function BranchesMock() {
  return (
    <div aria-hidden="true">
      <ul className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4 md:grid-cols-2 xl:grid-cols-4">
        {PLACES.map((place) => (
          <li
            key={place}
            className={`rounded-lg border-2 border-foreground p-2 shadow-brutal sm:p-3 ${place === PICKED ? 'bg-accent' : 'bg-card'}`}
          >
            <div className="rounded-sm bg-white p-1.5">
              {/* Each code opens the homepage; the fragment only varies the pattern. */}
              <QRCodeSVG
                value={`https://www.pulseapp.click/#${place}`}
                size={256}
                style={{ width: '100%', height: 'auto', display: 'block' }}
              />
            </div>
            <p className="mt-2 truncate text-center text-sm font-bold">
              {place}
            </p>
          </li>
        ))}
      </ul>

      <div className="rounded-lg border-2 border-foreground bg-card p-4 shadow-brutal-lg sm:p-5">
        <div className="mb-4 flex items-center gap-3">
          <span className="text-sm font-bold uppercase">Left at</span>
          <span className="flex items-center gap-2 border-2 border-foreground bg-card px-3 py-1 font-bold">
            {PICKED}
            <svg viewBox="0 0 10 6" className="size-2.5">
              <path d="M0 0l5 6 5-6z" fill="currentColor" />
            </svg>
          </span>
        </div>
        <ul className="space-y-3">
          {NOTES.map((note) => (
            <li
              key={note.name}
              className="rounded-md border-2 border-foreground p-3"
            >
              <p className="text-sm font-semibold text-muted-foreground">
                <span className="font-bold text-foreground">{note.name}</span> ·{' '}
                {note.time}
              </p>
              <p className="mt-1 font-display font-bold leading-snug">
                {note.summary}
              </p>
              <span className="mt-2 inline-block border-2 border-foreground bg-foreground px-2 py-0.5 text-xs font-bold uppercase text-background">
                {PICKED}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
