'use client'

import { useEffect, useRef, useSyncExternalStore } from 'react'
import type { ReactNode } from 'react'

// Bars are springs tied to their neighbours.
const STIFFNESS = 220
const COUPLING = STIFFNESS * 3
const DAMPING = 7
const SUBSTEPS = 4
// How hard the playhead pushes on a full-height bar, per second it spends
// over it. A steady push, so it feels the same at any frame rate.
const KICK = 840
// The row is 36px tall inside its padding; bars may push past it to 52px and
// the shell bulges around them.
const INNER = 36
const MAX_BAR = 52
const BARREL = 2.5
const RADIUS = 7
const SAMPLES = 36
// Below this the springs are at rest and the loop can sleep.
const SETTLED = 0.002

type JellyWaveProps = {
  /** Resting bar heights in px, at most 34. */
  heights: Array<number>
  /** How much has played, 0 to 1. Read every frame, so it can follow audio. */
  getProgress: () => number
  /** Shown before the first frame, so the page loads with the right bars filled. */
  restingProgress?: number
  /** While true, the playhead kicks the bars it passes. */
  playing: boolean
  /** False keeps the bars still: no wobble, no dragging. */
  motion: boolean
  /** Changes when progress moved without playing (a seek), to redraw it. */
  progressVersion?: number
  /** The play button, or whatever sits left of the bars. */
  children?: ReactNode
}

/** The box at rest: a slight barrel, like a cylinder seen from the side. */
const restingShell = (width: number, height: number) => {
  const swell = (x: number) => BARREL * Math.sin(Math.PI * (x / width))
  let d = `M ${RADIUS} 0`
  for (let i = 0; i <= SAMPLES; i++) {
    const x = RADIUS + ((width - 2 * RADIUS) * i) / SAMPLES
    d += ` L ${x.toFixed(1)} ${(-swell(x)).toFixed(1)}`
  }
  d += ` Q ${width} 0 ${width} ${RADIUS} L ${width} ${height - RADIUS} Q ${width} ${height} ${width - RADIUS} ${height}`
  for (let i = SAMPLES; i >= 0; i--) {
    const x = RADIUS + ((width - 2 * RADIUS) * i) / SAMPLES
    d += ` L ${x.toFixed(1)} ${(height + swell(x)).toFixed(1)}`
  }
  return `${d} Q 0 ${height} 0 ${height - RADIUS} L 0 ${RADIUS} Q 0 0 ${RADIUS} 0 Z`
}

/**
 * A voice-note waveform drawn as springy bars in a slightly barrel-shaped box.
 * Playing kicks each bar as the playhead passes; dragging across it stretches
 * the bars, and the box bulges to hold them. Animation runs outside React and
 * sleeps whenever nothing is moving.
 */
export const JellyWave = ({
  heights,
  getProgress,
  restingProgress = 0,
  playing,
  motion,
  progressVersion = 0,
  children,
}: JellyWaveProps) => {
  const rowRef = useRef<HTMLDivElement>(null)
  const barsRef = useRef<HTMLDivElement>(null)
  const svgRef = useRef<SVGSVGElement>(null)
  const shellRef = useRef<SVGPathElement>(null)
  const playingRef = useRef(playing)
  const progressRef = useRef(getProgress)
  const wakeRef = useRef<() => void>(() => {})

  useEffect(() => {
    playingRef.current = playing
    progressRef.current = getProgress
  })

  // Playing, stopping or seeking all need a fresh frame.
  useEffect(() => {
    wakeRef.current()
  }, [playing, progressVersion])

  useEffect(() => {
    const row = rowRef.current
    const box = barsRef.current
    const svg = svgRef.current
    const shell = shellRef.current
    if (!row || !box || !svg || !shell) return
    const bars = [...box.children] as Array<HTMLElement>
    const n = bars.length
    const offset = new Float32Array(n)
    const velocity = new Float32Array(n)
    const push = new Float32Array(n)
    const soft = new Float32Array(n)
    let geometry = { width: 0, height: 0, centres: [] as Array<number> }

    const measure = () => {
      const rect = row.getBoundingClientRect()
      // From here on the shell is drawn in the row's own pixels.
      svg.setAttribute('viewBox', `0 0 ${rect.width} ${rect.height}`)
      geometry = {
        width: rect.width,
        height: rect.height,
        centres: bars.map((bar) => {
          const r = bar.getBoundingClientRect()
          return r.left - rect.left + r.width / 2
        }),
      }
    }

    const bulgeAt = (x: number) => {
      const { centres } = geometry
      if (x <= centres[0] - 8 || x >= centres[n - 1] + 8) return 0
      let k = 0
      while (k < n - 2 && centres[k + 1] < x) k++
      const t = Math.min(
        1,
        Math.max(0, (x - centres[k]) / (centres[k + 1] - centres[k] || 1)),
      )
      const eased = t * t * (3 - 2 * t)
      return soft[k] + (soft[k + 1] - soft[k]) * eased
    }

    // The resting barrel, plus wherever the bars push past it.
    const drawShell = () => {
      const { width, height } = geometry
      if (!width) return
      for (let k = 0; k < n; k++) {
        let sum = 0
        let weights = 0
        for (let j = Math.max(0, k - 4); j <= Math.min(n - 1, k + 4); j++) {
          const w = Math.exp(-((k - j) ** 2) / 6)
          sum += push[j] * w
          weights += w
        }
        soft[k] = Math.max((sum / weights) * 1.4, push[k])
      }
      const top: Array<[number, number]> = []
      const bottom: Array<[number, number]> = []
      for (let i = 0; i <= SAMPLES; i++) {
        const x = RADIUS + ((width - 2 * RADIUS) * i) / SAMPLES
        const swell = BARREL * Math.sin(Math.PI * (x / width)) + bulgeAt(x)
        top.push([x, -swell])
        bottom.push([x, height + swell])
      }
      const end = top[SAMPLES]
      let d = `M ${top[0][0]} ${top[0][1].toFixed(1)}`
      for (const [x, y] of top) d += ` L ${x.toFixed(1)} ${y.toFixed(1)}`
      d += ` Q ${width} ${end[1].toFixed(1)} ${width} ${RADIUS} L ${width} ${height - RADIUS}`
      d += ` Q ${width} ${bottom[SAMPLES][1].toFixed(1)} ${width - RADIUS} ${bottom[SAMPLES][1].toFixed(1)}`
      for (let i = SAMPLES; i >= 0; i--)
        d += ` L ${bottom[i][0].toFixed(1)} ${bottom[i][1].toFixed(1)}`
      d += ` Q 0 ${bottom[0][1].toFixed(1)} 0 ${height - RADIUS} L 0 ${RADIUS} Q 0 ${top[0][1].toFixed(1)} ${RADIUS} ${top[0][1].toFixed(1)} Z`
      shell.setAttribute('d', d)
    }

    const paint = () => {
      const played = Math.round(progressRef.current() * n)
      for (let k = 0; k < n; k++) {
        const scale = Math.max(
          3 / heights[k],
          Math.min(MAX_BAR / heights[k], 1 + offset[k]),
        )
        push[k] = Math.max(0, (heights[k] * scale - INNER) / 2)
        bars[k].style.transform = `scaleY(${scale.toFixed(3)})`
        bars[k].style.opacity = k < played ? '1' : '0.25'
      }
      drawShell()
    }

    const kick = (index: number, amount: number, spread: number) => {
      for (let k = 0; k < n; k++) {
        velocity[k] +=
          amount * Math.exp(-((k - index) ** 2) / (2 * spread * spread))
      }
    }

    // Dragging stretches the bars near the finger; a mouse sweep ripples them.
    let held: { x: number; y: number } | null = null
    let last: { x: number; y: number } | null = null
    const indexAt = (x: number) => {
      const r = box.getBoundingClientRect()
      return Math.max(
        0,
        Math.min(n - 1, Math.floor(((x - r.left) / r.width) * n)),
      )
    }

    let frame = 0
    let lastTime = 0
    const step = (now: number) => {
      // The first frame after waking can start before wake() ran.
      const dt = Math.max(0, Math.min(0.033, (now - lastTime) / 1000))
      lastTime = now
      if (motion) {
        if (playingRef.current) {
          const at = Math.floor(progressRef.current() * n)
          if (at < n) kick(at, (heights[at] / 34) * KICK * dt, 1.2)
        }
        if (held) {
          const r = box.getBoundingClientRect()
          const i = indexAt(held.x)
          const pull = Math.min(
            1.6,
            Math.abs(held.y - (r.top + r.height / 2)) / 16,
          )
          for (let k = 0; k < n; k++) {
            const w = Math.exp(-((k - i) ** 2) / 24)
            offset[k] += (pull * w - offset[k]) * 0.3 * w
          }
        }
        const h = dt / SUBSTEPS
        for (let s = 0; s < SUBSTEPS; s++) {
          for (let k = 0; k < n; k++) {
            const left = k > 0 ? offset[k - 1] : 0
            const right = k < n - 1 ? offset[k + 1] : 0
            velocity[k] +=
              (COUPLING * (left + right - 2 * offset[k]) -
                STIFFNESS * offset[k] -
                DAMPING * velocity[k]) *
              h
          }
          for (let k = 0; k < n; k++) offset[k] += velocity[k] * h * 0.05
        }
      }
      paint()
      let energy = 0
      for (let k = 0; k < n; k++)
        energy += Math.abs(offset[k]) + Math.abs(velocity[k]) * 0.05
      const busy =
        playingRef.current || held !== null || (motion && energy > SETTLED)
      if (busy) frame = requestAnimationFrame(step)
      else {
        // Settle exactly at rest before sleeping.
        offset.fill(0)
        velocity.fill(0)
        paint()
        frame = 0
      }
    }
    const wake = () => {
      if (frame) return
      lastTime = performance.now()
      frame = requestAnimationFrame(step)
    }
    wakeRef.current = wake

    const onDown = (e: PointerEvent) => {
      held = { x: e.clientX, y: e.clientY }
      box.setPointerCapture(e.pointerId)
      wake()
    }
    const onMove = (e: PointerEvent) => {
      const p = { x: e.clientX, y: e.clientY }
      if (held) held = p
      else if (last && e.pointerType === 'mouse') {
        const speed = Math.abs(p.x - last.x) + Math.abs(p.y - last.y)
        kick(indexAt(p.x), Math.min(speed, 40) * 0.6, 2.5)
        wake()
      }
      last = p
    }
    const onUp = () => {
      held = null
    }
    const onLeave = () => {
      last = null
    }

    measure()
    const resize = new ResizeObserver(() => {
      measure()
      paint()
    })
    resize.observe(row)
    if (motion) {
      box.addEventListener('pointerdown', onDown)
      box.addEventListener('pointermove', onMove)
      box.addEventListener('pointerup', onUp)
      box.addEventListener('pointercancel', onUp)
      box.addEventListener('pointerleave', onLeave)
    }
    wake()

    return () => {
      cancelAnimationFrame(frame)
      wakeRef.current = () => {}
      resize.disconnect()
      box.removeEventListener('pointerdown', onDown)
      box.removeEventListener('pointermove', onMove)
      box.removeEventListener('pointerup', onUp)
      box.removeEventListener('pointercancel', onUp)
      box.removeEventListener('pointerleave', onLeave)
    }
  }, [heights, motion])

  const restingPlayed = Math.round(restingProgress * heights.length)
  return (
    <div
      ref={rowRef}
      className="relative isolate flex items-center gap-3 px-3 py-2"
    >
      <svg
        ref={svgRef}
        aria-hidden="true"
        viewBox="0 0 400 52"
        preserveAspectRatio="none"
        className="pointer-events-none absolute inset-0 -z-10 size-full overflow-visible"
      >
        {/* A nominal shape, stretched to fit until the row is measured. */}
        <path
          ref={shellRef}
          d={restingShell(400, 52)}
          strokeWidth={2}
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
          style={{ fill: 'var(--secondary)', stroke: 'var(--foreground)' }}
        />
      </svg>
      {children}
      <div
        ref={barsRef}
        aria-hidden="true"
        className={`flex h-9 flex-1 items-center justify-between gap-[3px] ${motion ? 'cursor-grab touch-pan-y active:cursor-grabbing' : ''}`}
      >
        {heights.map((height, position) => (
          <span
            // Bars never reorder, so their place in the wave identifies them.
            key={`bar-${String(position)}`}
            className="w-full max-w-3 rounded-full bg-foreground will-change-transform"
            style={{ height, opacity: position < restingPlayed ? 1 : 0.25 }}
          />
        ))}
      </div>
    </div>
  )
}

const REDUCED = '(prefers-reduced-motion: reduce)'
const subscribeReduced = (onChange: () => void) => {
  const query = window.matchMedia(REDUCED)
  query.addEventListener('change', onChange)
  return () => query.removeEventListener('change', onChange)
}

/** True when the visitor's device asks for less motion. */
export const usePrefersReducedMotion = () =>
  useSyncExternalStore(
    subscribeReduced,
    () => window.matchMedia(REDUCED).matches,
    () => false,
  )

const MOTION_KEY = 'pulse:wave-motion'
const subscribeMotion = (onChange: () => void) => {
  window.addEventListener('storage', onChange)
  window.addEventListener(MOTION_KEY, onChange)
  return () => {
    window.removeEventListener('storage', onChange)
    window.removeEventListener(MOTION_KEY, onChange)
  }
}
// Used when storage is blocked (private mode, strict settings): the choice
// lasts until the page reloads.
let unsavedMotion: string | null = null
const storedMotion = () => {
  try {
    return window.localStorage.getItem(MOTION_KEY) ?? unsavedMotion
  } catch {
    return unsavedMotion
  }
}

const saveWaveMotion = (next: boolean) => {
  unsavedMotion = next ? 'on' : 'off'
  try {
    window.localStorage.setItem(MOTION_KEY, unsavedMotion)
  } catch {
    // Blocked: unsavedMotion carries it for this visit.
  }
  window.dispatchEvent(new Event(MOTION_KEY))
}

/**
 * Whether players wobble, as the owner last chose on this device. Defaults to
 * on, or off when the device asks for less motion.
 */
export const useWaveMotion = () => {
  const reduced = usePrefersReducedMotion()
  const stored = useSyncExternalStore(subscribeMotion, storedMotion, () => null)
  const motion = stored === null ? !reduced : stored === 'on'
  return [motion, saveWaveMotion] as const
}
