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

const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://pulseapp.click'
const title = "Pulse — Hear your customers, don't just read them"
const description =
  'QR-based voice feedback with instant transcription and saved audio. Limited time: 5 free pulses for new businesses.'

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
    images: ['/opengraph-image'],
  },
  twitter: {
    card: 'summary_large_image',
    title,
    description,
    images: ['/twitter-image'],
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
