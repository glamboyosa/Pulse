import { Link, createFileRoute } from '@tanstack/react-router'
import { BarChart3, Globe, Mic, QrCode, Shield, Zap } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { FaqSection } from '@/components/faq-section'
import { PricingSection } from '@/components/pricing-section'
import { PulseLogo } from '@/components/pulse-logo'

export const Route = createFileRoute('/')({ component: App })

function App() {
  return (
    <main className="min-h-screen">
      {/* Header */}
      <header className="border-b-4 border-foreground bg-background">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-3">
            <PulseLogo className="w-10 h-10 text-primary" />
            <span className="text-2xl font-bold tracking-tight">PULSE</span>
          </Link>
          <nav className="hidden md:flex items-center gap-6">
            <Link
              to="#features"
              className="font-semibold hover:text-primary transition-colors"
            >
              Features
            </Link>
            <Link
              to="#how-it-works"
              className="font-semibold hover:text-primary transition-colors"
            >
              How It Works
            </Link>
            <Link
              to="#pricing"
              className="font-semibold hover:text-primary transition-colors"
            >
              Pricing
            </Link>
          </nav>
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              className="font-bold border-2 border-transparent hover:border-foreground"
              asChild
            >
              <Link to="/login">Login</Link>
            </Button>
            <Button
              className="font-bold border-4 border-foreground shadow-[4px_4px_0px_0px_rgba(255,255,255,1)]"
              asChild
            >
              <Link to="/login">Get Started</Link>
            </Button>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="border-b-4 border-foreground bg-accent">
        <div className="container mx-auto px-4 py-20 md:py-32">
          <div className="max-w-4xl mx-auto text-center">
            <h1 className="text-5xl md:text-7xl font-black tracking-tight mb-6 text-balance">
              {'HEAR YOUR CUSTOMERS'}
              <br />
              {'DON\'T JUST READ THEM'}
            </h1>
            <p className="text-xl md:text-2xl font-semibold mb-10 leading-relaxed text-balance">
              {
                'Collect authentic voice feedback with simple QR codes. Get deeper insights, higher response rates, and real human emotion.'
              }
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button
                size="lg"
                className="text-lg font-bold border-4 border-foreground shadow-[6px_6px_0px_0px_rgba(255,255,255,1)] hover:shadow-[8px_8px_0px_0px_rgba(255,255,255,1)] hover:translate-x-[-2px] hover:translate-y-[-2px] hover:bg-primary! transition-all"
                asChild
              >
                <Link to="/login">Get Started</Link>
              </Button>
              <Button
                size="lg"
                variant="outline"
                className="text-lg font-bold border-4 border-foreground bg-background shadow-[6px_6px_0px_0px_rgba(255,255,255,1)] hover:shadow-[8px_8px_0px_0px_rgba(255,255,255,1)] hover:translate-x-[-2px] hover:translate-y-[-2px] transition-all"
                asChild
              >
                <Link to="#demo">Watch Demo</Link>
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="border-b-4 border-foreground bg-background">
        <div className="container mx-auto px-4 py-16">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-5xl mx-auto">
            <div className="text-center">
              <div className="text-5xl font-black mb-2 text-primary">5X</div>
              <div className="text-lg font-bold">Higher Response Rates</div>
            </div>
            <div className="text-center">
              <div className="text-5xl font-black mb-2 text-primary">
                {'<2min'}
              </div>
              <div className="text-lg font-bold">Average Feedback Time</div>
            </div>
            <div className="text-center">
              <div className="text-5xl font-black mb-2 text-primary">100%</div>
              <div className="text-lg font-bold">Authentic Insights</div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section
        id="features"
        className="border-b-4 border-foreground bg-secondary"
      >
        <div className="container mx-auto px-4 py-20">
          <h2 className="text-4xl md:text-5xl font-black text-center mb-16 tracking-tight">
            WHY VOICE FEEDBACK?
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-6xl mx-auto">
            {[
              {
                icon: Mic,
                title: 'Natural & Effortless',
                description:
                  'Speaking is faster and easier than typing. Get more detailed feedback with less friction.',
              },
              {
                icon: QrCode,
                title: 'Instant QR Access',
                description:
                  'No apps, no logins. Customers scan your QR code and start talking immediately.',
              },
              {
                icon: BarChart3,
                title: 'Auto Transcription',
                description:
                  'Every voice note is automatically transcribed and analyzed for insights.',
              },
              {
                icon: Zap,
                title: 'Real-Time Dashboard',
                description:
                  'Listen to feedback as it comes in. Filter, search, and organize effortlessly.',
              },
              {
                icon: Shield,
                title: 'Privacy First',
                description:
                  "All data encrypted. GDPR compliant. Your customers' privacy is protected.",
              },
              {
                icon: Globe,
                title: 'Works Everywhere',
                description:
                  'Perfect for restaurants, retail, events, or any customer-facing business.',
              },
            ].map((feature, i) => (
              <Card
                key={i}
                className="p-6 border-4 border-foreground shadow-[8px_8px_0px_0px_rgba(255,255,255,1)] bg-card"
              >
                <feature.icon
                  className="w-12 h-12 mb-4 text-primary"
                  strokeWidth={2.5}
                />
                <h3 className="text-xl font-black mb-3">{feature.title}</h3>
                <p className="leading-relaxed font-medium">
                  {feature.description}
                </p>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section
        id="how-it-works"
        className="border-b-4 border-foreground bg-background"
      >
        <div className="container mx-auto px-4 py-20">
          <h2 className="text-4xl md:text-5xl font-black text-center mb-16 tracking-tight">
            HOW IT WORKS
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-5xl mx-auto">
            {[
              {
                step: '01',
                title: 'Create Your QR Code',
                description:
                  'Generate a unique QR code for your business in seconds.',
              },
              {
                step: '02',
                title: 'Place & Share',
                description:
                  'Print it on receipts, tables, packaging—anywhere customers can scan.',
              },
              {
                step: '03',
                title: 'Collect & Analyze',
                description:
                  'Listen to voice feedback, read transcripts, and discover insights.',
              },
            ].map((step, i) => (
              <div key={i} className="text-center">
                <div
                  className={`w-20 h-20 text-3xl font-black flex items-center justify-center mx-auto mb-6 border-4 border-foreground ${
                    i === 1
                      ? 'bg-background text-foreground shadow-[6px_6px_0px_0px_rgba(255,255,255,1)]'
                      : 'bg-primary text-primary-foreground shadow-[6px_6px_0px_0px_rgba(255,255,255,1)]'
                  }`}
                >
                  {step.step}
                </div>
                <h3 className="text-2xl font-black mb-3">{step.title}</h3>
                <p className="text-lg leading-relaxed font-medium">
                  {step.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section
        id="pricing"
        className="border-b-4 border-foreground bg-secondary"
      >
        <div className="container mx-auto px-4 py-20">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-black mb-4 tracking-tight">
              SIMPLE PULSE PRICING
            </h2>
            <p className="text-xl font-semibold max-w-2xl mx-auto leading-relaxed text-balance">
              No subscriptions. No hidden fees. Just pay for the feedback you
              collect.
            </p>
          </div>
          <PricingSection />
        </div>
      </section>

      {/* FAQ Section */}
      <section className="border-b-4 border-foreground bg-secondary">
        <div className="container mx-auto px-4 py-20">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-black tracking-tight">
              FREQUENTLY ASKED QUESTIONS
            </h2>
          </div>
          <div className="max-w-3xl mx-auto">
            <FaqSection />
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="border-b-4 border-foreground bg-primary text-primary-foreground">
        <div className="container mx-auto px-4 py-20 text-center">
          <h2 className="text-4xl md:text-5xl font-black mb-6 tracking-tight text-balance">
            READY TO HEAR FROM YOUR CUSTOMERS?
          </h2>
          <p className="text-xl md:text-2xl font-semibold mb-10 max-w-2xl mx-auto leading-relaxed text-balance">
            {'Start collecting voice feedback today.'}
          </p>
          <Button
            size="lg"
            className="text-lg font-bold bg-accent text-accent-foreground border-4 border-foreground shadow-[8px_8px_0px_0px_rgba(255,255,255,1)] hover:shadow-[10px_10px_0px_0px_rgba(255,255,255,1)] hover:translate-x-[-2px] hover:translate-y-[-2px] hover:bg-accent! transition-all"
            asChild
          >
            <Link to="/login">Get Started</Link>
          </Button>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-background">
        <div className="container mx-auto px-4 py-12">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-8">
            <div>
              <div className="flex items-center gap-3 mb-4">
                <PulseLogo className="w-8 h-8 text-primary" />
                <span className="text-xl font-bold">PULSE</span>
              </div>
              <p className="font-medium leading-relaxed">
                Voice feedback collection made simple.
              </p>
            </div>
            <div>
              <h4 className="font-black mb-4">Product</h4>
              <ul className="space-y-2 font-medium">
                <li>
                  <Link
                    to="#features"
                    className="hover:text-primary transition-colors"
                  >
                    Features
                  </Link>
                </li>
                <li>
                  <Link
                    to="#pricing"
                    className="hover:text-primary transition-colors"
                  >
                    Pricing
                  </Link>
                </li>
                <li>
                  <Link
                    to="#demo"
                    className="hover:text-primary transition-colors"
                  >
                    Demo
                  </Link>
                </li>
              </ul>
            </div>
            <div>
              <h4 className="font-black mb-4">Company</h4>
              <ul className="space-y-2 font-medium">
                <li>
                  <Link
                    to="/about"
                    className="hover:text-primary transition-colors"
                  >
                    About
                  </Link>
                </li>
                <li>
                  <Link
                    to="/contact"
                    className="hover:text-primary transition-colors"
                  >
                    Contact
                  </Link>
                </li>
                <li>
                  <Link
                    to="/blog"
                    className="hover:text-primary transition-colors"
                  >
                    Blog
                  </Link>
                </li>
              </ul>
            </div>
            <div>
              <h4 className="font-black mb-4">Legal</h4>
              <ul className="space-y-2 font-medium">
                <li>
                  <Link
                    to="/privacy"
                    className="hover:text-primary transition-colors"
                  >
                    Privacy
                  </Link>
                </li>
                <li>
                  <Link
                    to="/terms"
                    className="hover:text-primary transition-colors"
                  >
                    Terms
                  </Link>
                </li>
              </ul>
            </div>
          </div>
          <div className="border-t-4 border-foreground pt-8 text-center font-bold">
            <p>© 2025 Pulse. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </main>
  )
}
