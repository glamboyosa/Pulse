/** @type {import('next').NextConfig} */
const securityHeaders = [
  // HTTPS only, for two years.
  {
    key: 'Strict-Transport-Security',
    value: 'max-age=63072000; includeSubDomains',
  },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  // No other site may frame Pulse, so it can't be overlaid to trick clicks.
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Content-Security-Policy', value: "frame-ancestors 'none'" },
  // The feedback page needs the microphone; nothing else does.
  {
    key: 'Permissions-Policy',
    value: 'microphone=(self), camera=(), geolocation=(), payment=()',
  },
]

const nextConfig = {
  // The widget's embed page sets its own headers in proxy.ts, because which
  // sites may frame it depends on the account.
  headers: async () => [
    { source: '/((?!embed/).*)', headers: securityHeaders },
  ],
  experimental: {
    serverActions: {
      bodySizeLimit: '10mb',
    },
  },
}

export default nextConfig
