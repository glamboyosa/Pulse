import { FeedbackForm } from '@/components/feedback-form'
import { PulseLogo } from '@/components/pulse-logo'
import { getUserByUniqueCode } from '@/lib/auth'
import { notFound } from 'next/navigation'

interface FeedbackPageProps {
  params: Promise<{ id: string }>
}

export default async function FeedbackPage({ params }: FeedbackPageProps) {
  const { id } = await params

  // Verify that the business exists
  const user = await getUserByUniqueCode(id)

  if (!user) {
    notFound()
  }

  return (
    <main className="min-h-screen bg-secondary flex items-center justify-center p-4">
      <div className="w-full max-w-2xl">
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-3 mb-6">
            <PulseLogo className="w-12 h-12 text-primary" />
            <span className="text-3xl font-bold tracking-tight">PULSE</span>
          </div>
          <h1 className="text-4xl md:text-5xl font-black mb-4 text-balance">
            SHARE YOUR FEEDBACK
          </h1>
          <p className="text-lg md:text-xl font-semibold leading-relaxed text-balance">
            {'Your voice matters. Record a quick message and help us improve.'}
          </p>
        </div>
        <FeedbackForm businessId={id} />
      </div>
    </main>
  )
}

