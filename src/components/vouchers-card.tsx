import Link from 'next/link'
import { Ticket } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'

/** This month's vouchers, and the way in for staff to redeem one. */
export function VouchersCard({
  issued,
  redeemed,
}: {
  issued: number
  redeemed: number
}) {
  return (
    <Card className="p-6 border-2 border-foreground shadow-brutal bg-card space-y-4">
      <h2 className="text-xl font-black uppercase">Vouchers this month</h2>
      <dl className="grid grid-cols-2 gap-4">
        <div>
          <dt className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
            Issued
          </dt>
          <dd className="font-display text-3xl font-extrabold tabular-nums">
            {issued}
          </dd>
        </div>
        <div>
          <dt className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
            Redeemed
          </dt>
          <dd className="font-display text-3xl font-extrabold tabular-nums">
            {redeemed}
          </dd>
        </div>
      </dl>
      <Button asChild className="w-full font-bold">
        <Link href="/dashboard/vouchers">
          <Ticket className="size-4" />
          Redeem a voucher
        </Link>
      </Button>
    </Card>
  )
}
