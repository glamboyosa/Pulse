'use client'

import { useState } from 'react'
import { Check, Zap } from 'lucide-react'

import type { LocalPricing } from '@/lib/pricing'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Slider } from '@/components/ui/slider'
import { cn } from '@/lib/utils'
import {
  CUSTOM_PULSES_MAX,
  CUSTOM_PULSES_MIN,
  PACKS,
  customPriceCents,
  formatLocalApprox,
  formatUsd,
} from '@/lib/pricing'

// A card is a label around a hidden radio, so arrow keys pick a pack and the
// ring shows on the card.
const packCard =
  'relative flex flex-col gap-6 rounded-xl border-2 p-6 text-card-foreground cursor-pointer transition-[transform,box-shadow,background-color] has-[input:focus-visible]:outline-3 has-[input:focus-visible]:outline-offset-2 has-[input:focus-visible]:outline-foreground'

const PULSE_PACKAGES = PACKS.map((pack) => ({
  id: pack.id,
  amount: pack.pulses,
  price: pack.priceCents / 100,
  popular: pack.id === 'popular',
}))

export function BuyPulsesForm({
  localPricing,
}: {
  localPricing: LocalPricing | null
}) {
  const localApprox = (cents: number) =>
    localPricing && (
      // The browser's number formatting can differ slightly from the server's.
      <span
        suppressHydrationWarning
        className="ml-1.5 text-sm font-semibold text-muted-foreground"
      >
        {`(${formatLocalApprox(cents, localPricing)})`}
      </span>
    )

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
      <fieldset className="min-w-0 space-y-8">
        <legend className="sr-only">Pack</legend>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {PULSE_PACKAGES.map((pkg) => (
            <label
              key={pkg.amount}
              className={cn(
                packCard,
                selectedPackage === pkg.amount
                  ? 'bg-accent shadow-brutal-lg'
                  : 'border-foreground bg-card shadow-brutal hover:shadow-brutal-lg',
              )}
            >
              <input
                type="radio"
                name="pack"
                value={pkg.amount}
                checked={selectedPackage === pkg.amount}
                onChange={() => setSelectedPackage(pkg.amount)}
                className="sr-only"
              />
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
              <div className="text-4xl font-black mb-2 tabular-nums">
                {pkg.amount}
              </div>
              <div className="text-sm font-bold text-muted-foreground mb-4">
                PULSES
              </div>
              <div className="text-2xl font-black tabular-nums">
                ${pkg.price}
                {localApprox(pkg.price * 100)}
              </div>
              <div className="text-xs font-semibold text-muted-foreground mt-1">
                ${(pkg.price / pkg.amount).toFixed(2)} per pulse
              </div>
            </label>
          ))}
        </div>

        {/* Not a label: the slider inside would become part of the radio's
          name. The card's click is for the pointer; the radio is the way in
          for the keyboard. */}
        <Card
          onClick={() => setSelectedPackage('custom')}
          className={cn(
            'p-6 border-2 cursor-pointer transition-[transform,box-shadow,background-color] has-[input:focus-visible]:outline-3 has-[input:focus-visible]:outline-offset-2 has-[input:focus-visible]:outline-foreground',
            selectedPackage === 'custom'
              ? 'bg-accent shadow-brutal-lg'
              : 'border-foreground bg-card shadow-brutal',
          )}
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
              <h2 className="text-xl font-black mb-2">
                <label className="block cursor-pointer">
                  <input
                    type="radio"
                    name="pack"
                    value="custom"
                    checked={selectedPackage === 'custom'}
                    onChange={() => setSelectedPackage('custom')}
                    className="sr-only"
                  />
                  Custom amount
                </label>
              </h2>
              <p className="text-sm font-semibold text-muted-foreground mb-3">
                Need a different amount? Priced at the rate of the matching
                pack.
              </p>
              <div className="space-y-2">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-bold">
                    {customAmount[0]} pulses
                  </span>
                  <span className="text-lg font-black tabular-nums">
                    {formatUsd(customPriceCents(customAmount[0]))}
                    {localApprox(customPriceCents(customAmount[0]))}
                  </span>
                </div>
                <Slider
                  aria-label="Custom amount in pulses"
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
      </fieldset>

      <Card className="p-6 border-2 border-foreground bg-accent shadow-brutal-lg">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-2xl font-black mb-1">Order summary</h2>
            <p className="text-sm font-semibold text-muted-foreground">
              {getAmount()} pulses = {getAmount()} voice feedback submissions
            </p>
          </div>
          <div className="text-right">
            <div className="text-sm font-bold text-muted-foreground mb-1">
              TOTAL
            </div>
            <div className="text-4xl font-black tabular-nums">
              {formatUsd(getPriceCents())}
            </div>
            {localPricing && (
              <div
                suppressHydrationWarning
                className="whitespace-nowrap text-sm font-semibold text-muted-foreground tabular-nums"
              >
                {formatLocalApprox(getPriceCents(), localPricing)}
              </div>
            )}
          </div>
        </div>
        <Button
          onClick={handlePurchase}
          disabled={
            isRedirecting ||
            getAmount() === 0 ||
            (selectedPackage !== 'custom' && !getSelectedPackage())
          }
          className="w-full border-3 border-foreground before:-inset-[3px] font-bold text-lg py-6 shadow-brutal-sm hover:shadow-brutal"
        >
          {isRedirecting ? 'OPENING CHECKOUT…' : 'PROCEED TO CHECKOUT'}
        </Button>
        {error && (
          <p role="alert" className="mt-3 font-bold text-destructive">
            {error}
          </p>
        )}
      </Card>
    </div>
  )
}
