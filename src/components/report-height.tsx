'use client'

import { useEffect, useRef } from 'react'

/**
 * Tells the website widget how tall the panel's content is, so the panel can
 * fit it instead of covering the visitor's whole screen. Only when framed.
 */
export const ReportHeight = ({ children }: { children: React.ReactNode }) => {
  const content = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const element = content.current
    if (!element || window.parent === window) return
    const report = () => {
      // The page's own padding (p-4) sits outside this element.
      const height = Math.ceil(element.getBoundingClientRect().height) + 32
      window.parent.postMessage({ type: 'pulse:height', height }, '*')
    }
    const observer = new ResizeObserver(report)
    observer.observe(element)
    return () => observer.disconnect()
  }, [])

  return <div ref={content}>{children}</div>
}
