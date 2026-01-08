'use client'

import { useEffect, useRef, useState } from 'react'
import { Download, QrCode, Share2 } from 'lucide-react'
import QRCodeSVG from 'react-qr-code'

import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'

interface QRCodeSectionProps {
  uniqueCode: string
}

export function QRCodeSection({ uniqueCode }: QRCodeSectionProps) {
  const [copied, setCopied] = useState(false)
  const [feedbackUrl, setFeedbackUrl] = useState<string>('')
  const qrCodeRef = useRef<HTMLDivElement>(null)

  // Get the current host URL on the client side
  useEffect(() => {
    if (typeof window !== 'undefined') {
      console.log('Window is defined')
      const baseUrl = window.location.origin
      console.log('Base URL:', baseUrl)
      setFeedbackUrl(`${baseUrl}/f/${uniqueCode}`)
    } else {
      // Fallback for SSR
      const fallbackUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://pulseapp.click'
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

  const handleDownload = async () => {
    if (!qrCodeRef.current) return

    try {
      // Get the SVG element
      const svgElement = qrCodeRef.current.querySelector('svg')
      if (!svgElement) {
        console.error('SVG element not found')
        return
      }

      // Clone the SVG to avoid modifying the original
      const clonedSvg = svgElement.cloneNode(true) as SVGElement

      // Set explicit dimensions if not already set
      if (!clonedSvg.getAttribute('width')) {
        clonedSvg.setAttribute('width', '400')
      }
      if (!clonedSvg.getAttribute('height')) {
        clonedSvg.setAttribute('height', '400')
      }

      // Convert SVG to data URL
      const svgData = new XMLSerializer().serializeToString(clonedSvg)
      const svgBlob = new Blob([svgData], {
        type: 'image/svg+xml;charset=utf-8',
      })
      const svgUrl = URL.createObjectURL(svgBlob)

      // Create a canvas to convert SVG to PNG
      const canvas = document.createElement('canvas')
      canvas.width = 400
      canvas.height = 400
      const ctx = canvas.getContext('2d')
      if (!ctx) {
        URL.revokeObjectURL(svgUrl)
        return
      }

      // Fill white background
      ctx.fillStyle = '#ffffff'
      ctx.fillRect(0, 0, canvas.width, canvas.height)

      // Create image and wait for it to load
      const img = new Image()
      
      await new Promise<void>((resolve, reject) => {
        img.onload = () => {
          try {
            // Draw the image
            ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
            resolve()
          } catch (err) {
            reject(err)
          }
        }
        img.onerror = () => {
          URL.revokeObjectURL(svgUrl)
          reject(new Error('Failed to load SVG image'))
        }
        img.src = svgUrl
      })

      // Convert to blob and download
      canvas.toBlob(
        (blob) => {
          if (!blob) {
            console.error('Failed to create blob from canvas')
            URL.revokeObjectURL(svgUrl)
            return
          }
          
          const downloadUrl = URL.createObjectURL(blob)
          const link = document.createElement('a')
          link.href = downloadUrl
          link.download = `pulse-qr-code-${uniqueCode}.png`
          link.style.display = 'none'
          document.body.appendChild(link)
          link.click()
          
          // Cleanup
          setTimeout(() => {
            document.body.removeChild(link)
            URL.revokeObjectURL(downloadUrl)
            URL.revokeObjectURL(svgUrl)
          }, 100)
        },
        'image/png',
        1.0,
      )
    } catch (error) {
      console.error('Error downloading QR code:', error)
      alert('Failed to download QR code. Please try again.')
    }
  }

  return (
    <Card className="p-6 border-4 border-foreground shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] bg-card sticky top-8">
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
