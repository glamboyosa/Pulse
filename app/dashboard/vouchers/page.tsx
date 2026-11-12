import Link from 'next/link'
import { redirect } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'

import { getCurrentUser } from '../../actions/auth'
import { VoucherRedeem } from '@/components/voucher-redeem'
import { findVoucher, monthlyVoucherStats } from '@/server/vouchers'

// Staff land here from the QR code on a customer's voucher, signed in as the
// owner, or open it to type a code.
export default async function VouchersPage({
  searchParams,
}: {
  searchParams: Promise<{ code?: string | Array<string> }>
}) {
  const { code: codeParam } = await searchParams
  const code = typeof codeParam === 'string' ? codeParam : ''
  const user = await getCurrentUser()
  if (!user) {
    redirect(
      `/login?next=${encodeURIComponent(`/dashboard/vouchers${code ? `?code=${encodeURIComponent(code)}` : ''}`)}`,
    )
  }
  const [voucher, stats] = await Promise.all([
    code ? findVoucher(user.id, code) : null,
    monthlyVoucherStats(user.id),
  ])

  return (
    <div className="min-h-dvh bg-secondary p-4 md:p-8">
      <div className="mx-auto max-w-xl">
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-2 font-bold mb-8 border-2 border-transparent hover:border-foreground px-3 py-2"
        >
          <ArrowLeft className="size-4" />
          Back to Dashboard
        </Link>
        <h1 className="text-4xl md:text-5xl font-black mb-2">
          Redeem a voucher
        </h1>
        <p className="text-lg font-semibold text-muted-foreground mb-8 tabular-nums">
          This month: {stats.issued} issued, {stats.redeemed} redeemed
        </p>
        <VoucherRedeem key={code} initialCode={code} initialVoucher={voucher} />
      </div>
    </div>
  )
}
