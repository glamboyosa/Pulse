import * as React from 'react'
import { ChevronDownIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

interface AccordionItemProps {
  value: string
  children: React.ReactNode
  className?: string
}

interface AccordionTriggerProps {
  children: React.ReactNode
  className?: string
}

interface AccordionContentProps {
  children: React.ReactNode
  className?: string
}

function AccordionItem({ value, children, className }: AccordionItemProps) {
  return (
    <details
      className={cn('border-b-4 border-foreground last:border-b-4', className)}
    >
      {children}
    </details>
  )
}

function AccordionTrigger({ children, className }: AccordionTriggerProps) {
  return (
    <summary
      className={cn(
        'flex items-center justify-between gap-4 py-4 text-left text-lg font-bold cursor-pointer list-none transition-all hover:opacity-80 outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
        '[&::-webkit-details-marker]:hidden',
        '[&::marker]:hidden',
        className
      )}
    >
      <span className="flex-1">{children}</span>
      <ChevronDownIcon className="text-muted-foreground pointer-events-none size-5 shrink-0 transition-transform duration-200" />
    </summary>
  )
}

function AccordionContent({ children, className }: AccordionContentProps) {
  return (
    <div
      className={cn(
        'pb-4 pt-0 text-sm leading-relaxed',
        'animate-in fade-in-0 slide-in-from-top-2 duration-200',
        className
      )}
    >
      {children}
    </div>
  )
}

export { AccordionItem, AccordionTrigger, AccordionContent }

