'use client'

import { useEffect, useRef } from 'react'

declare global {
  interface Window {
    turnstile?: {
      render: (
        container: HTMLElement,
        options: {
          sitekey: string
          callback: (token: string) => void
          'expired-callback': () => void
          'error-callback': () => void
        },
      ) => string
      remove: (widgetId: string) => void
    }
  }
}

const SCRIPT_URL =
  'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit'

let scriptLoad: Promise<void> | null = null

const loadScript = () => {
  scriptLoad ??= new Promise<void>((resolve, reject) => {
    const script = document.createElement('script')
    script.src = SCRIPT_URL
    script.async = true
    script.onload = () => resolve()
    script.onerror = () => {
      scriptLoad = null
      reject(new Error('Turnstile failed to load'))
    }
    document.head.appendChild(script)
  })
  return scriptLoad
}

/**
 * Cloudflare's bot check. Calls onToken with a token once the visitor passes,
 * and with '' when the token expires. onError runs when the check can't load
 * or fails. Tokens work once, so remount the widget (change its key) after each
 * use or to retry.
 */
export const TurnstileWidget = ({
  siteKey,
  onToken,
  onError,
}: {
  siteKey: string
  onToken: (token: string) => void
  onError: () => void
}) => {
  const container = useRef<HTMLDivElement>(null)
  const onTokenRef = useRef(onToken)
  onTokenRef.current = onToken
  const onErrorRef = useRef(onError)
  onErrorRef.current = onError

  useEffect(() => {
    let widgetId: string | undefined
    let cancelled = false
    loadScript()
      .then(() => {
        if (cancelled || !container.current || !window.turnstile) return
        widgetId = window.turnstile.render(container.current, {
          sitekey: siteKey,
          callback: (token) => onTokenRef.current(token),
          'expired-callback': () => onTokenRef.current(''),
          'error-callback': () => {
            onTokenRef.current('')
            onErrorRef.current()
          },
        })
      })
      .catch(() => {
        onTokenRef.current('')
        onErrorRef.current()
      })
    return () => {
      cancelled = true
      if (widgetId) window.turnstile?.remove(widgetId)
    }
  }, [siteKey])

  return <div ref={container} className="min-h-[65px]" />
}
