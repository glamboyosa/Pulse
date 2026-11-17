import type { MetadataRoute } from 'next'

const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://www.pulseapp.click'

// Logged-in areas stay out of search. /embed/ and /f/ are left crawlable so
// crawlers can read their noindex.
const robots = (): MetadataRoute.Robots => ({
  rules: {
    userAgent: '*',
    disallow: [
      '/dashboard',
      '/onboarding',
      '/settings',
      '/api/',
      '/feedback/',
      '/print',
      '/buy-pulses',
    ],
  },
  sitemap: `${appUrl}/sitemap.xml`,
})

export default robots
