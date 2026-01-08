import type { LucideIcon } from 'lucide-react'

import { Button } from '@/components/ui/button'

interface EmptyStateProps {
  icon: LucideIcon
  title: string
  description: string
  action?: {
    label: string
    onClick: () => void
  }
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
}: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-4 border-4 border-dashed border-foreground/20 bg-muted/20">
      <div className="w-16 h-16 mb-4 flex items-center justify-center border-4 border-foreground bg-background">
        <Icon className="w-8 h-8 text-muted-foreground" strokeWidth={2.5} />
      </div>
      <h3 className="text-2xl font-black mb-2 text-center">{title}</h3>
      <p className="text-muted-foreground font-semibold text-center max-w-md mb-6">
        {description}
      </p>
      {action && (
        <Button
          onClick={action.onClick}
          className="border-3 border-foreground font-bold shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]"
        >
          {action.label}
        </Button>
      )}
    </div>
  )
}

