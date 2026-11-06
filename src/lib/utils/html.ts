const ESCAPES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
}

/** Escapes text for interpolation into email HTML. */
export const escapeHtml = (value: string): string =>
  value.replace(/[&<>"']/g, (char) => ESCAPES[char])
