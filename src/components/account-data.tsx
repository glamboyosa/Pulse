'use client'

import { useActionState, useState } from 'react'
import { Download, Trash2 } from 'lucide-react'

import { deleteAccountAction } from '../../app/actions/auth'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

/** Export everything, or delete the account for good. */
export function AccountData({ confirmWord }: { confirmWord: string }) {
  const [state, action, pending] = useActionState(
    deleteAccountAction,
    undefined,
  )
  const [typed, setTyped] = useState('')

  return (
    <section
      aria-labelledby="your-data"
      className="space-y-6 border-4 border-foreground bg-card p-6 shadow-[6px_6px_0px_0px_rgba(0,0,0,1)]"
    >
      <h2 id="your-data" className="text-xl font-black">
        YOUR DATA
      </h2>
      <div className="space-y-2">
        <p className="font-semibold">
          Download everything Pulse holds about your business: feedback,
          transcripts, spots, purchases and digests.
        </p>
        <a
          href="/api/account/export"
          className="inline-flex items-center gap-2 border-4 border-foreground bg-background px-4 py-2 font-bold"
        >
          <Download className="size-4" />
          EXPORT AS JSON
        </a>
      </div>
      <p className="font-semibold text-muted-foreground">
        Recordings are deleted automatically after 12 months. Their transcripts
        and summaries stay until you delete them.
      </p>
      <form
        action={action}
        className="space-y-3 border-t-4 border-foreground pt-6"
      >
        <h3 className="text-lg font-black">Delete your account</h3>
        <p className="font-semibold">
          This deletes every recording, transcript, spot and setting, right
          away. It can&apos;t be undone, and unused pulses are lost.
        </p>
        <Label htmlFor="confirm-delete" className="font-bold">
          Type <span className="font-mono">{confirmWord}</span> to confirm
        </Label>
        <Input
          id="confirm-delete"
          name="confirm"
          value={typed}
          onChange={(event) => setTyped(event.target.value)}
          autoComplete="off"
          aria-describedby="delete-error"
          aria-invalid={state?.error ? true : undefined}
          className="max-w-sm border-4 border-foreground font-semibold text-base"
        />
        <p
          id="delete-error"
          aria-live="polite"
          className="font-bold text-red-700"
        >
          {state?.error}
        </p>
        <Button
          type="submit"
          variant="destructive"
          disabled={pending || typed.trim() !== confirmWord}
          className="border-4 border-foreground font-bold"
        >
          <Trash2 className="mr-2 size-4" />
          {pending ? 'DELETING…' : 'DELETE MY ACCOUNT'}
        </Button>
      </form>
    </section>
  )
}
