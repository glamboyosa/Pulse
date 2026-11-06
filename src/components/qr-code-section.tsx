'use client'

import { useEffect, useRef, useState } from 'react'
import { Download, Printer, QrCode, Share2 } from 'lucide-react'
import Link from 'next/link'
import QRCodeSVG from 'react-qr-code'

import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { downloadQrPng } from '@/lib/qr-download'

interface QRCodeSectionProps {
  uniqueCode: string
}

export function QRCodeSection({ uniqueCode }: QRCodeSectionProps) {
  const [copied, setCopied] = useState(false)
  const [downloadError, setDownloadError] = useState<string | null>(null)
  const [feedbackUrl, setFeedbackUrl] = useState<string>('')
  const qrCodeRef = useRef<HTMLDivElement>(null)

  // Get the current host URL on the client side
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const baseUrl = window.location.origin
      setFeedbackUrl(`${baseUrl}/f/${uniqueCode}`)
    } else {
      // Fallback for SSR
      const fallbackUrl =
        process.env.NEXT_PUBLIC_APP_URL || 'https://pulseapp.click'
      setFeedbackUrl(`${fallbackUrl}/f/${uniqueCode}`)
    }
  }, [uniqueCode])

  const handleCopy = async () => {
    if (!feedbackUrl) return

    try {
      await navigator.clipboard.writeText(feedbackUrl)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (error) {
      console.error('Failed to copy to clipboard:', error)
      // Fallback: try using the older clipboard API
      try {
        const textArea = document.createElement('textarea')
        textArea.value = feedbackUrl
        textArea.style.position = 'fixed'
        textArea.style.left = '-999999px'
        document.body.appendChild(textArea)
        textArea.focus()
        textArea.select()
        document.execCommand('copy')
        document.body.removeChild(textArea)
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
      } catch (fallbackError) {
        console.error('Fallback copy also failed:', fallbackError)
        alert('Failed to copy link. Please copy it manually.')
      }
    }
  }

  const handleDownload = () => {
    if (!qrCodeRef.current) return
    downloadQrPng(qrCodeRef.current, `pulse-qr-${uniqueCode}.png`).catch(() =>
      setDownloadError("Couldn't save the QR code. Try again."),
    )
  }

  return (
    <Card className="p-6 border-2 border-foreground shadow-brutal-lg bg-card">
      <div className="flex items-center gap-3 mb-4">
        <QrCode className="w-6 h-6 text-primary" strokeWidth={2.5} />
        <h2 className="text-2xl font-extrabold tracking-tight">Your QR code</h2>
      </div>
      <div
        ref={qrCodeRef}
        className="bg-background border-2 border-foreground p-4 mb-4 flex items-center justify-center"
      >
        <QRCodeSVG
          value={feedbackUrl}
          size={200}
          level="H"
          style={{ height: 'auto', maxWidth: '100%', width: '100%' }}
        />
      </div>
      <div className="space-y-3">
        <div className="bg-secondary border-2 border-foreground p-3">
          <p className="text-xs font-bold uppercase mb-1 text-muted-foreground">
            Feedback URL
          </p>
          <p className="font-mono text-sm font-semibold break-all text-black">
            {feedbackUrl}
          </p>
        </div>
        <Button
          onClick={handleCopy}
          className="w-full font-bold border-2 border-foreground shadow-brutal-sm hover:shadow-brutal hover:translate-x-[-2px] hover:translate-y-[-2px] transition-[transform,box-shadow,background-color]"
        >
          <Share2 className="w-4 h-4 mr-2" />
          {copied ? 'COPIED!' : 'COPY LINK'}
        </Button>
        <Button
          variant="outline"
          onClick={handleDownload}
          className="w-full font-bold border-2 border-foreground bg-background shadow-brutal-sm hover:shadow-brutal hover:translate-x-[-2px] hover:translate-y-[-2px] transition-[transform,box-shadow,background-color]"
        >
          <Download className="w-4 h-4 mr-2" />
          DOWNLOAD QR
        </Button>
        <Link
          href="/print"
          className="flex w-full items-center justify-center gap-2 border-2 border-foreground bg-background py-2 font-bold shadow-brutal-sm"
        >
          <Printer className="w-4 h-4" />
          PRINT TABLE TENTS
        </Link>
        {downloadError && (
          <p role="alert" className="text-sm font-bold text-destructive">
            {downloadError}
          </p>
        )}
      </div>
    </Card>
  )
}
