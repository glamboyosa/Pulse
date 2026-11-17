import type { MetadataRoute } from 'next'

// Read here rather than imported from app/layout, which would pull its fonts
// and CSS into this route.
const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://www.pulseapp.click'

// The public pages. Everything behind a login, and each business's own
// feedback page, stays out.
const PUBLIC_PATHS = [
  '/',
  '/software',
  '/docs/widget',
  '/about',
  '/privacy',
  '/terms',
  '/dpa',
]

const sitemap = (): MetadataRoute.Sitemap =>
  PUBLIC_PATHS.map((path) => ({ url: new URL(path, appUrl).href }))

export default sitemap
