import { Check } from 'lucide-react'
import Link from 'next/link'

import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'

export function PricingSection() {
  const packages = [
    {
      name: 'Starter',
      pulses: 10,
      price: 7,
      pricePerPulse: 0.7,
      popular: false,
    },
    {
      name: 'Popular',
      pulses: 25,
      price: 16,
      pricePerPulse: 0.64,
      popular: true,
    },
    {
      name: 'Growth',
      pulses: 50,
      price: 30,
      pricePerPulse: 0.6,
      popular: false,
    },
    {
      name: 'Scale',
      pulses: 100,
      price: 55,
      pricePerPulse: 0.55,
      popular: false,
    },
  ]

  const features = [
    'Voice feedback collection',
    'Automatic transcription',
    'Dashboard access',
    'QR code generator',
    'Email support',
  ]

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 max-w-7xl mx-auto">
      {packages.map((pkg, i) => (
        <Card
          key={i}
          className={`p-6 border-4 border-foreground ${
            pkg.popular
              ? 'bg-primary text-primary-foreground shadow-[10px_10px_0px_0px_rgba(255,255,255,1)] scale-105'
              : 'bg-card shadow-[8px_8px_0px_0px_rgba(255,255,255,1)]'
          } relative`}
        >
          {pkg.popular && (
            <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-accent text-accent-foreground px-4 py-1 border-4 border-foreground font-black text-sm">
              POPULAR
            </div>
          )}
          <div className="text-center mb-6">
            <h3 className="text-2xl font-black mb-2">{pkg.name}</h3>
            <div className="flex items-baseline justify-center gap-1 mb-2">
              <span className="text-5xl font-black">${pkg.price}</span>
            </div>
            <div
              className={`text-sm font-bold ${
                pkg.popular ? 'opacity-90' : 'opacity-70'
              }`}
            >
              {pkg.pulses} Pulses (${pkg.pricePerPulse}/pulse)
            </div>
          </div>
          <ul className="space-y-3 mb-8">
            {features.map((feature, j) => (
              <li key={j} className="flex items-start gap-2">
                <Check
                  className="w-5 h-5 flex-shrink-0 mt-0.5"
                  strokeWidth={3}
                />
                <span className="font-semibold text-sm leading-relaxed">
                  {feature}
                </span>
              </li>
            ))}
          </ul>
          {pkg.pulses >= 100 && (
            <p className="text-xs font-semibold text-center mb-4 opacity-70">
              Need priority support? Email us for enterprise pricing
            </p>
          )}
          <Button
            className={`w-full font-bold border-4 border-foreground shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] transition-all ${
              pkg.pulses === 25
                ? 'bg-accent text-accent-foreground hover:bg-background hover:text-foreground'
                : pkg.popular
                  ? 'bg-accent text-accent-foreground hover:opacity-80'
                  : 'bg-foreground/90 text-background hover:opacity-80'
            }`}
            asChild
          >
            <Link href="#">Buy {pkg.pulses} Pulses</Link>
          </Button>
        </Card>
      ))}
    </div>
  )
}

