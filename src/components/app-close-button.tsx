'use client'

/**
 * The × inside a React Native app, where the page fills the sheet. On a
 * website the widget draws its own over the frame instead.
 */
export function AppCloseButton() {
  return (
    <button
      type="button"
      aria-label="Close"
      onClick={() =>
        window.ReactNativeWebView?.postMessage(
          JSON.stringify({ type: 'pulse:close' }),
        )
      }
      className="absolute top-1.5 right-2 flex size-11 items-center justify-center text-2xl leading-none font-bold"
    >
      ×
    </button>
  )
}
