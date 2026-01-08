import type { Metadata } from 'next'
import { Inter, Fascinate, Rye, Rampart_One } from 'next/font/google'
import './globals.css'
import { Providers } from '@/components/providers'

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' })

const fascinate = Fascinate({
  weight: '400',
  subsets: ['latin'],
  variable: '--font-fascinate',
})

const rye = Rye({
  weight: '400',
  subsets: ['latin'],
  variable: '--font-rye',
})

const rampartOne = Rampart_One({
  weight: '400',
  subsets: ['latin'],
  variable: '--font-rampart',
})

export const metadata: Metadata = {
  title: 'Pulse - Voice Feedback Platform',
  description: 'Collect authentic voice feedback from your customers',
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
      <body
        className={`${inter.variable} ${fascinate.variable} ${rye.variable} ${rampartOne.variable} ${inter.className}`}
      >
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}

