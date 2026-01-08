import { treaty } from '@elysiajs/eden'

import type { App } from '../../app/api/[[...slugs]]/route'

// Treaty client for API calls
// In browser, use current origin; in server, use full URL
const getBaseUrl = () => {
  if (typeof window !== 'undefined') {
    // Browser - use current origin (e.g., http://localhost:3000)
    return window.location.origin
  }
  // Server - use full URL (or process.env.NEXT_PUBLIC_API_URL if set)
  return process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000'
}

export const api = treaty<App>(getBaseUrl()).api
