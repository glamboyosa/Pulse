import { redirect } from 'next/navigation'

import { getCurrentUser } from '../actions/auth'
import { PrintSheets } from '@/components/print-sheets'
import { brandingFor } from '@/server/branding'
import { listSpots } from '@/server/spots'

export const metadata = { title: 'Print QR codes · Pulse' }

export default async function PrintPage({
  searchParams,
}: {
  searchParams: Promise<{ spot?: string }>
}) {
  const user = await getCurrentUser()
  if (!user) redirect('/login')
  if (!user.uniqueCode) redirect('/onboarding')

  const [branding, spots, { spot }] = await Promise.all([
    brandingFor(user.uniqueCode),
    listSpots(user.id),
    searchParams,
  ])
  if (!branding) redirect('/onboarding')

  return (
    <PrintSheets
      code={user.uniqueCode}
      businessName={branding.businessName}
      question={branding.question}
      logoUrl={branding.logoUrl}
      spots={spots}
      initialSpot={spot && spots.some((s) => s.slug === spot) ? spot : ''}
    />
  )
}
