'use client'

import { useEffect, useRef, useState } from 'react'
import { Pause, Play, SkipForward, X } from 'lucide-react'

import type { ThemeTrack } from '@/server/insights'

type Playing = {
  theme: string
  tracks: Array<ThemeTrack>
  index: number
  paused: boolean
}

/** A fresh one-hour link for a recording, or null if it can't be had. */
const freshUrl = async (id: string): Promise<string | null> => {
  try {
    const response = await fetch(`/api/feedback/${id}/audio-url`)
    if (!response.ok) return null
    const data = (await response.json()) as { audioUrl?: unknown }
    return typeof data.audioUrl === 'string' ? data.audioUrl : null
  } catch {
    // Offline, or a captive portal answering with a web page.
    return null
  }
}

const playButton = (theme: string) =>
  document.querySelector<HTMLElement>(
    `[data-play-theme="${CSS.escape(theme)}"]`,
  )

/**
 * Plays a theme's recordings back to back on one audio element. Reusing the
 * element matters: Safari lets it start the next recording without a new tap.
 * Each start, skip or stop begins a new run; anything still loading for an
 * older run is dropped, so a slow link can't take playback back.
 */
export const useThemePlaylist = () => {
  const audio = useRef<HTMLAudioElement | null>(null)
  const playingRef = useRef<Playing | null>(null)
  const run = useRef(0)
  const refreshed = useRef<string | null>(null)
  // Links fetched ahead of time, by recording.
  const prefetched = useRef(new Map<string, Promise<string | null>>())
  const [playing, setPlaying] = useState<Playing | null>(null)
  const [skipped, setSkipped] = useState(0)

  const element = () => {
    audio.current ??= new Audio()
    return audio.current
  }

  const update = (next: Playing | null) => {
    playingRef.current = next
    setPlaying(next)
  }

  const setPaused = (paused: boolean) => {
    const current = playingRef.current
    if (current && current.paused !== paused) update({ ...current, paused })
  }

  const begin = () => {
    element()
      .play()
      .catch((error: unknown) => {
        const name = error instanceof DOMException ? error.name : ''
        // A pause or the next recording cut the start short: nothing is wrong.
        if (name === 'AbortError') return
        // The browser wants a tap first: wait, paused, on this recording.
        if (name === 'NotAllowedError') setPaused(true)
        // A recording that can't load also fires 'error', which handles it.
      })
  }

  const stop = () => {
    run.current += 1
    const current = playingRef.current
    // Let go of the recording, so the lock screen and headphones can't
    // replay it with nothing on screen to stop it.
    const media = element()
    media.pause()
    media.removeAttribute('src')
    media.load()
    if ('mediaSession' in navigator) navigator.mediaSession.metadata = null
    const hadFocus = document.activeElement?.closest('[data-now-playing]')
    update(null)
    // The bar is going away; keep the keyboard where the owner was.
    if (current && hadFocus) {
      requestAnimationFrame(() => playButton(current.theme)?.focus())
    }
  }

  const playTrack = async (state: Playing, index: number) => {
    const track = state.tracks.at(index)
    if (!track) {
      stop()
      return
    }
    const thisRun = (run.current += 1)
    refreshed.current = null
    update({ ...state, index, paused: false })
    // Only the first link is signed with the page, so a click can start it
    // straight away (Safari needs that). The rest are fetched while the one
    // before plays, so the next starts the moment the last ends; a locked
    // iPhone can suspend the page in any silent gap.
    let url = track.audioUrl
    if (!url) {
      // Nothing plays meanwhile, not even the last recording from a pause.
      element().removeAttribute('src')
      // A prefetch that hit a blip gets one more try before the skip.
      url =
        (await prefetched.current.get(track.id)) ?? (await freshUrl(track.id))
    }
    if (thisRun !== run.current) return
    if (!url) {
      setSkipped((count) => count + 1)
      void playTrack(state, index + 1)
      return
    }
    element().src = url
    begin()
  }

  const skip = () => {
    const current = playingRef.current
    if (current) void playTrack(current, current.index + 1)
  }

  // Links last an hour; a recording that stops loading gets one fresh link,
  // picking up where it left off.
  const recover = async () => {
    const current = playingRef.current
    const track = current?.tracks.at(current.index)
    if (!current || !track) return
    if (refreshed.current === track.id) {
      setSkipped((count) => count + 1)
      skip()
      return
    }
    refreshed.current = track.id
    const thisRun = run.current
    const resumeAt = element().currentTime
    const url = await freshUrl(track.id)
    if (thisRun !== run.current) return
    if (!url) {
      setSkipped((count) => count + 1)
      skip()
      return
    }
    const media = element()
    media.src = url
    if (resumeAt > 0) {
      media.addEventListener(
        'loadedmetadata',
        () => {
          // Only for this recording, not whatever loads next.
          if (thisRun === run.current) media.currentTime = resumeAt
        },
        { once: true },
      )
    }
    begin()
  }

  const prefetchNext = () => {
    const current = playingRef.current
    const next = current?.tracks.at(current.index + 1)
    if (next && !next.audioUrl && !prefetched.current.has(next.id)) {
      prefetched.current.set(next.id, freshUrl(next.id))
    }
  }

  useEffect(() => {
    const media = element()
    const onEnded = () => skip()
    const onError = () => void recover()
    // Follow the element, so pausing from headphones or the lock screen
    // shows too. A recording that finished isn't paused; the next one starts.
    const onPlay = () => {
      if (playingRef.current) setPaused(false)
      else media.pause()
    }
    const onPlaying = () => prefetchNext()
    const onPause = () => {
      if (!media.ended) setPaused(true)
    }
    media.addEventListener('ended', onEnded)
    media.addEventListener('error', onError)
    media.addEventListener('play', onPlay)
    media.addEventListener('playing', onPlaying)
    media.addEventListener('pause', onPause)
    return () => {
      run.current += 1
      media.removeEventListener('ended', onEnded)
      media.removeEventListener('error', onError)
      media.removeEventListener('play', onPlay)
      media.removeEventListener('playing', onPlaying)
      media.removeEventListener('pause', onPause)
      media.pause()
      media.removeAttribute('src')
      media.load()
    }
    // Registered once; the handlers read the latest state through refs.
  }, [])

  // The lock screen and Control Center show what's playing, with next.
  useEffect(() => {
    if (!('mediaSession' in navigator) || !playing) return
    const track = playing.tracks[playing.index]
    navigator.mediaSession.metadata = new MediaMetadata({
      title: track.summary ?? 'Voice note',
      artist: track.customerName ?? 'A customer',
      album: playing.theme,
    })
    navigator.mediaSession.setActionHandler('nexttrack', skip)
    return () => navigator.mediaSession.setActionHandler('nexttrack', null)
    // skip reads the latest state through refs.
  }, [playing])

  return {
    playing,
    skipped,
    /** Starts from the click itself: Safari refuses play() after an await. */
    start: (theme: string, tracks: Array<ThemeTrack>) => {
      setSkipped(0)
      // Links last an hour; fetch afresh for each new queue.
      prefetched.current.clear()
      void playTrack({ theme, tracks, index: 0, paused: false }, 0)
    },
    togglePause: () => {
      // Waiting for the next link: nothing to pause or resume yet.
      if (!playingRef.current || !element().getAttribute('src')) return
      if (element().paused) begin()
      else element().pause()
    },
    skip,
    stop,
  }
}

const controlClass =
  'flex size-11 shrink-0 items-center justify-center rounded-md border-2 border-foreground bg-card transition-transform active:scale-[0.96] md:size-10'

/** What's playing, with pause, next and stop. */
export const NowPlaying = ({
  playlist,
}: {
  playlist: ReturnType<typeof useThemePlaylist>
}) => {
  const { playing, skipped } = playlist
  const track = playing ? playing.tracks[playing.index] : null
  const who = track
    ? [track.customerName, track.summary].filter(Boolean).join(': ') ||
      'Voice note'
    : ''
  const skippedNote =
    skipped > 0
      ? `${skipped === 1 ? 'One recording' : `${skipped} recordings`} couldn't be played.`
      : ''

  return (
    <>
      {/* One region that stays on the page, so screen readers hear changes. */}
      <p role="status" className="sr-only">
        {playing && track
          ? `${playing.theme}, ${playing.index + 1} of ${playing.tracks.length}: ${who}. ${skippedNote}`
          : skippedNote}
      </p>
      {playing && track ? (
        // Sticks to the bottom of the screen, so the controls stay in reach
        // after pressing "Play all" near the top of a long list.
        <div
          data-now-playing
          className="sticky bottom-[max(0.75rem,env(safe-area-inset-bottom))] z-10 flex items-center gap-3 rounded-md border-2 border-foreground bg-secondary p-3 shadow-brutal-sm"
        >
          <div className="min-w-0 flex-1 text-sm">
            <p>
              <span className="font-bold uppercase">{playing.theme}</span>
              {' · '}
              <span className="font-bold tabular-nums">
                {playing.index + 1} of {playing.tracks.length}
              </span>
            </p>
            <p className="line-clamp-2 font-semibold text-muted-foreground">
              {who}
            </p>
            {skippedNote && (
              <p className="font-bold text-destructive">{skippedNote}</p>
            )}
          </div>
          <button
            type="button"
            onClick={playlist.togglePause}
            aria-label={playing.paused ? 'Resume recording' : 'Pause recording'}
            className={controlClass}
          >
            {playing.paused ? (
              <Play
                aria-hidden="true"
                className="ml-0.5 size-4"
                fill="currentColor"
              />
            ) : (
              <Pause
                aria-hidden="true"
                className="size-4"
                fill="currentColor"
              />
            )}
          </button>
          <button
            type="button"
            onClick={playlist.skip}
            aria-label="Next recording"
            className={controlClass}
          >
            <SkipForward aria-hidden="true" className="size-4" />
          </button>
          <button
            type="button"
            onClick={playlist.stop}
            aria-label="Stop"
            className={controlClass}
          >
            <X aria-hidden="true" className="size-4" />
          </button>
        </div>
      ) : (
        skippedNote && (
          <p className="text-sm font-bold text-destructive">{skippedNote}</p>
        )
      )}
    </>
  )
}
