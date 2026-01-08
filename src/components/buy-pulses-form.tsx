'use client'

import { useState } from 'react'
import { Check, Zap } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Slider } from '@/components/ui/slider'
import { api } from '@/lib/eden'

// Check if we're in development mode
const isDev = process.env.NODE_ENV === 'development'

// Product IDs - sandbox for dev, production for prod
const PRODUCT_IDS = {
  starter: isDev
    ? '9d2ffe60-4204-4ed0-abc2-9707e66d713f' // Sandbox
    : 'fad8b1dd-d9f5-42a1-b84d-c4a07059e475', // Production
  popular: isDev
    ? '1d502f05-c411-49f8-8f27-83e7b6e7e515' // Sandbox
    : '80ed7c99-0512-48af-88d5-83dc29cfec50', // Production
  growth: isDev
    ? 'd04c9f17-af15-4ee1-86bb-da89b340b562' // Sandbox
    : '1a60a8a1-a88e-4aa9-8cd1-43bf88cd15f5', // Production
  scale: isDev
    ? 'cfa4b754-6a75-4c39-a703-93cf92597d02' // Sandbox
    : 'f4f82b5c-2c39-4b8d-a8bf-53de00594e21', // Production
}

// Polar product IDs mapped to pulse packages
const PULSE_PACKAGES = [
  {
    amount: 10,
    price: 7,
    pricePerPulse: 0.7,
    popular: false,
    productId: PRODUCT_IDS.starter, // Starter
  },
  {
    amount: 25,
    price: 16,
    pricePerPulse: 0.64,
    popular: true,
    productId: PRODUCT_IDS.popular, // Popular
  },
  {
    amount: 50,
    price: 30,
    pricePerPulse: 0.6,
    popular: false,
    productId: PRODUCT_IDS.growth, // Growth
  },
  {
    amount: 100,
    price: 55,
    pricePerPulse: 0.55,
    popular: false,
    productId: PRODUCT_IDS.scale, // Scale
  },
]

interface BuyPulsesFormProps {
  user: {
    id: string
    email: string
    name: string
  }
}

export function BuyPulsesForm({ user }: BuyPulsesFormProps) {
  const [selectedPackage, setSelectedPackage] = useState<number | 'custom'>(25)
  const [customAmount, setCustomAmount] = useState([50])

  const handlePurchase = async () => {
    if (selectedPackage === 'custom') {
      const pulseAmount = customAmount[0] || 50
      // Calculate price: $0.50 per pulse
      const price = pulseAmount * 0.5

      try {
        // Create custom checkout
        const response = await api['custom-checkout'].post({
          customerName: user.name,
          customerEmail: user.email,
          customerExternalId: user.id,
          pulseAmount,
          price,
        })

        if (
          response.data &&
          response.data.success &&
          response.data.checkoutUrl
        ) {
          window.location.href = response.data.checkoutUrl
        } else {
          alert('Failed to create checkout. Please try again.')
        }
      } catch (error) {
        console.error('Error creating custom checkout:', error)
        alert('Failed to create checkout. Please try again.')
      }
      return
    }

    const pkg = PULSE_PACKAGES.find((p) => p.amount === selectedPackage)
    if (!pkg) {
      alert('Invalid package selected')
      return
    }

    // Build checkout URL with query params
    const params = new URLSearchParams({
      products: pkg.productId,
      customerExternalId: user.id,
      customerEmail: user.email,
      customerName: user.name,
    })

    // Redirect to Polar checkout
    window.location.href = `/api/checkout?${params.toString()}`
  }

  const getPrice = () => {
    if (selectedPackage === 'custom') {
      const amount = customAmount[0] || 50
      // $0.50 per pulse for custom amounts
      return Math.round(amount * 0.5)
    }
    const pkg = PULSE_PACKAGES.find((p) => p.amount === selectedPackage)
    return pkg?.price || 0
  }

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
              Need a different amount? Choose your quantity at $0.50 per pulse
            </p>
            <div className="space-y-2">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-bold">
                  {customAmount[0] || 50} pulses
                </span>
                <span className="text-lg font-black">
                  ${Math.round((customAmount[0] || 50) * 0.5)}
                </span>
              </div>
              <Slider
                value={customAmount}
                onValueChange={(value) => {
                  setCustomAmount(value)
                  setSelectedPackage('custom')
                }}
                min={1}
                max={500}
                step={1}
                className="w-full"
              />
              <div className="flex justify-between text-xs font-semibold text-muted-foreground">
                <span>1</span>
                <span>500</span>
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
            <div className="text-4xl font-black">${getPrice()}</div>
          </div>
        </div>
        <Button
          onClick={handlePurchase}
          disabled={
            getAmount() === 0 ||
            (selectedPackage !== 'custom' && !getSelectedPackage())
          }
          className="w-full border-3 border-foreground font-bold text-lg py-6 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:shadow-[6px_6px_0px_0px_rgba(0,0,0,1)]"
        >
          PROCEED TO CHECKOUT
        </Button>
      </Card>
    </div>
  )
}
