'use client'

import { useState } from 'react'
import { Trash2 } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useQueryClient } from '@tanstack/react-query'

import { Button } from '@/components/ui/button'

export function DeleteFeedbackButton({ feedbackId }: { feedbackId: string }) {
  const router = useRouter()
  const queryClient = useQueryClient()
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const remove = async () => {
    if (
      !window.confirm(
        'Delete this feedback and its recording? This can’t be undone.',
      )
    ) {
      return
    }
    setDeleting(true)
    setError(null)
    const response = await fetch(`/api/feedback/${feedbackId}`, {
      method: 'DELETE',
    }).catch(() => null)
    if (response?.ok) {
      // The dashboard list is cached on the client; drop it so it refetches.
      queryClient.removeQueries({ queryKey: ['feedback'] })
      router.push('/dashboard')
      router.refresh()
      return
    }
    setDeleting(false)
    setError("Couldn't delete it. Try again.")
  }

  return (
    <div className="flex flex-col items-start gap-2">
      <Button
        type="button"
        variant="outline"
        onClick={remove}
        disabled={deleting}
        className="border-4 border-foreground font-bold"
      >
        <Trash2 className="mr-2 size-4" />
        {deleting ? 'DELETING…' : 'DELETE FEEDBACK'}
      </Button>
      <p aria-live="polite" className="font-bold text-red-700">
        {error}
      </p>
    </div>
  )
}
