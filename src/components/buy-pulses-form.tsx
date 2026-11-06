'use client'

import { useState } from 'react'
import { Check, Zap } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Slider } from '@/components/ui/slider'
import {
  CUSTOM_PULSES_MAX,
  CUSTOM_PULSES_MIN,
  PACKS,
  customPriceCents,
} from '@/lib/pricing'

const PULSE_PACKAGES = PACKS.map((pack) => ({
  id: pack.id,
  amount: pack.pulses,
  price: pack.priceCents / 100,
  popular: pack.id === 'popular',
}))

const formatPrice = (cents: number) =>
  `$${(cents / 100).toFixed(cents % 100 === 0 ? 0 : 2)}`

export function BuyPulsesForm() {
  const [selectedPackage, setSelectedPackage] = useState<number | 'custom'>(25)
  const [customAmount, setCustomAmount] = useState([50])
  const [isRedirecting, setIsRedirecting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handlePurchase = async () => {
    setError(null)
    setIsRedirecting(true)
    const pkg = PULSE_PACKAGES.find((p) => p.amount === selectedPackage)
    const body =
      selectedPackage === 'custom' || !pkg
        ? { pulses: customAmount[0] }
        : { packId: pkg.id }

    try {
      const response = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data: { url?: string; error?: string } = await response
        .json()
        .catch(() => ({}))
      if (response.ok && data.url) {
        window.location.href = data.url
        return
      }
      setError(data.error || "Couldn't start checkout. Please try again.")
    } catch {
      setError("Couldn't start checkout. Check your connection and try again.")
    }
    setIsRedirecting(false)
  }

  const getPriceCents = () =>
    selectedPackage === 'custom'
      ? customPriceCents(customAmount[0])
      : Math.round(
          (PULSE_PACKAGES.find((p) => p.amount === selectedPackage)?.price ??
            0) * 100,
        )

  const getAmount = () => {
    if (selectedPackage === 'custom') {
      return customAmount[0] || 50
    }
    return typeof selectedPackage === 'number' ? selectedPackage : 0
  }

  const getSelectedPackage = () => {
    if (selectedPackage === 'custom') {
      return null
    }
    return PULSE_PACKAGES.find((p) => p.amount === selectedPackage)
  }

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {PULSE_PACKAGES.map((pkg) => (
          <Card
            key={pkg.amount}
            onClick={() => setSelectedPackage(pkg.amount)}
            className={`relative p-6 border-4 cursor-pointer transition-all ${
              selectedPackage === pkg.amount
                ? 'border-primary bg-primary/5 shadow-[8px_8px_0px_0px_rgba(59,130,246,1)]'
                : 'border-foreground bg-card shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] hover:shadow-[8px_8px_0px_0px_rgba(0,0,0,1)]'
            }`}
          >
            {pkg.popular && (
              <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-accent text-accent-foreground px-3 py-1 border-2 border-foreground font-black text-xs">
                POPULAR
              </div>
            )}
            <div className="flex items-center justify-between mb-4">
              <Zap className="w-6 h-6 text-primary" fill="currentColor" />
              {selectedPackage === pkg.amount && (
                <div className="w-6 h-6 bg-primary border-2 border-foreground flex items-center justify-center">
                  <Check
                    className="w-4 h-4 text-primary-foreground"
                    strokeWidth={3}
                  />
                </div>
              )}
            </div>
            <div className="text-4xl font-black mb-2">{pkg.amount}</div>
            <div className="text-sm font-bold text-muted-foreground mb-4">
              PULSES
            </div>
            <div className="text-2xl font-black">${pkg.price}</div>
            <div className="text-xs font-semibold text-muted-foreground mt-1">
              ${(pkg.price / pkg.amount).toFixed(2)} per pulse
            </div>
          </Card>
        ))}
      </div>

      <Card
        onClick={() => setSelectedPackage('custom')}
        className={`p-6 border-4 cursor-pointer transition-all ${
          selectedPackage === 'custom'
            ? 'border-primary bg-primary/5 shadow-[8px_8px_0px_0px_rgba(59,130,246,1)]'
            : 'border-foreground bg-card shadow-[6px_6px_0px_0px_rgba(0,0,0,1)]'
        }`}
      >
        <div className="flex items-center gap-4">
          <div className="shrink-0">
            {selectedPackage === 'custom' && (
              <div className="w-6 h-6 bg-primary border-2 border-foreground flex items-center justify-center">
                <Check
                  className="w-4 h-4 text-primary-foreground"
                  strokeWidth={3}
                />
              </div>
            )}
          </div>
          <div className="flex-1">
            <h3 className="text-xl font-black mb-2">CUSTOM AMOUNT</h3>
            <p className="text-sm font-semibold text-muted-foreground mb-3">
              Need a different amount? Priced at the rate of the matching pack.
            </p>
            <div className="space-y-2">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-bold">
                  {customAmount[0]} pulses
                </span>
                <span className="text-lg font-black">
                  {formatPrice(customPriceCents(customAmount[0]))}
                </span>
              </div>
              <Slider
                value={customAmount}
                onValueChange={(value) => {
                  setCustomAmount(value)
                  setSelectedPackage('custom')
                }}
                min={CUSTOM_PULSES_MIN}
                max={CUSTOM_PULSES_MAX}
                step={1}
                className="w-full"
              />
              <div className="flex justify-between text-xs font-semibold text-muted-foreground">
                <span>{CUSTOM_PULSES_MIN}</span>
                <span>{CUSTOM_PULSES_MAX}</span>
              </div>
            </div>
          </div>
        </div>
      </Card>

      <Card className="p-6 border-4 border-foreground bg-accent shadow-[8px_8px_0px_0px_rgba(0,0,0,1)]">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-2xl font-black mb-1">ORDER SUMMARY</h3>
            <p className="text-sm font-semibold text-muted-foreground">
              {getAmount()} pulses = {getAmount()} voice feedback submissions
            </p>
          </div>
          <div className="text-right">
            <div className="text-sm font-bold text-muted-foreground mb-1">
              TOTAL
            </div>
            <div className="text-4xl font-black">
              {formatPrice(getPriceCents())}
            </div>
          </div>
        </div>
        <Button
          onClick={handlePurchase}
          disabled={
            isRedirecting ||
            getAmount() === 0 ||
            (selectedPackage !== 'custom' && !getSelectedPackage())
          }
          className="w-full border-3 border-foreground font-bold text-lg py-6 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:shadow-[6px_6px_0px_0px_rgba(0,0,0,1)]"
        >
          {isRedirecting ? 'OPENING CHECKOUT…' : 'PROCEED TO CHECKOUT'}
        </Button>
        {error && (
          <p role="alert" className="mt-3 font-bold text-red-700">
            {error}
          </p>
        )}
      </Card>
    </div>
  )
}
