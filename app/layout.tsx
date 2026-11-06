import { Bricolage_Grotesque, Inter } from 'next/font/google'
import type { Metadata } from 'next'
import './globals.css'
import { Providers } from '@/components/providers'

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
})

// One display face for headings, Inter for everything else.
const bricolage = Bricolage_Grotesque({
  subsets: ['latin'],
  variable: '--font-bricolage',
  display: 'swap',
})

export const appUrl =
  process.env.NEXT_PUBLIC_APP_URL || 'https://www.pulseapp.click'
export const title = 'Pulse: hear what your customers really think'
export const description =
  'Customers scan a QR code and leave a voice note in their own language. You get the transcript, an English translation, alerts when someone is unhappy and a weekly list of what to fix. 5 free pulses to start.'

// Link previews: a 1200x630 image of the landing hero, in /public. The home
// page adds a short video of it (see app/page.tsx).
export const preview = {
  url: '/og-preview.jpg',
  width: 1200,
  height: 630,
  alt: 'Pulse: a voice note in Nigerian Pidgin, translated and summarised, with an unhappy-customer alert',
}

export const metadata: Metadata = {
  metadataBase: new URL(appUrl),
  title: {
    default: title,
    template: '%s | Pulse',
  },
  description,
  openGraph: {
    title,
    description,
    url: '/',
    siteName: 'Pulse',
    type: 'website',
    images: [{ ...preview, type: 'image/jpeg' }],
  },
  twitter: {
    card: 'summary_large_image',
    title,
    description,
    images: [preview],
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <head>
        <link rel="icon" href="/favicon.svg" />
      </head>
      <body className={`${inter.variable} ${bricolage.variable} font-sans`}>
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
