'use client'

import { useEffect, useRef, useState } from 'react'
import { Download, QrCode, Share2 } from 'lucide-react'
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
    <Card className="p-6 border-4 border-foreground shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] bg-card">
      <div className="flex items-center gap-3 mb-4">
        <QrCode className="w-6 h-6 text-primary" strokeWidth={2.5} />
        <h2 className="text-2xl font-black">YOUR QR CODE</h2>
      </div>
      <div
        ref={qrCodeRef}
        className="bg-background border-4 border-foreground p-4 mb-4 flex items-center justify-center"
      >
        <QRCodeSVG
          value={feedbackUrl}
          size={200}
          level="H"
          style={{ height: 'auto', maxWidth: '100%', width: '100%' }}
        />
      </div>
      <div className="space-y-3">
        <div className="bg-secondary border-4 border-foreground p-3">
          <p className="text-xs font-bold uppercase mb-1 text-muted-foreground">
            Feedback URL
          </p>
          <p className="font-mono text-sm font-semibold break-all text-black">
            {feedbackUrl}
          </p>
        </div>
        <Button
          onClick={handleCopy}
          className="w-full font-bold border-4 border-foreground shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] hover:translate-x-[-2px] hover:translate-y-[-2px] transition-all"
        >
          <Share2 className="w-4 h-4 mr-2" />
          {copied ? 'COPIED!' : 'COPY LINK'}
        </Button>
        <Button
          variant="outline"
          onClick={handleDownload}
          className="w-full font-bold border-4 border-foreground bg-background shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] hover:translate-x-[-2px] hover:translate-y-[-2px] transition-all"
        >
          <Download className="w-4 h-4 mr-2" />
          DOWNLOAD QR
        </Button>
        {downloadError && (
          <p role="alert" className="text-sm font-bold text-red-700">
            {downloadError}
          </p>
        )}
      </div>
      <div className="mt-6 pt-6 border-t-4 border-foreground">
        <p className="text-sm font-semibold leading-relaxed">
          Print this QR code on receipts, table tents, or packaging to collect
          voice feedback.
        </p>
      </div>
    </Card>
  )
}
