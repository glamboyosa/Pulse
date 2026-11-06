import * as React from 'react'
import { Slot } from '@radix-ui/react-slot'
import { cva } from 'class-variance-authority'
import type { VariantProps } from 'class-variance-authority'

import { cn } from '@/lib/utils'

// Neobrutalist buttons: ink border, hard shadow, a lift on hover and a press
// on click. Tailwind v4 only applies hover on devices that can hover.
const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md border-2 border-foreground text-sm font-bold cursor-pointer transition-[transform,box-shadow,background-color] duration-150 ease-out disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 shrink-0 [&_svg]:shrink-0 focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-foreground aria-invalid:border-destructive",
  {
    variants: {
      variant: {
        default:
          'bg-primary text-primary-foreground shadow-brutal-sm hover:-translate-y-0.5 hover:shadow-brutal active:translate-x-[3px] active:translate-y-[3px] active:shadow-none',
        accent:
          'bg-accent text-accent-foreground shadow-brutal-sm hover:-translate-y-0.5 hover:shadow-brutal active:translate-x-[3px] active:translate-y-[3px] active:shadow-none',
        destructive:
          'bg-destructive text-white shadow-brutal-sm hover:-translate-y-0.5 hover:shadow-brutal active:translate-x-[3px] active:translate-y-[3px] active:shadow-none',
        outline:
          'bg-card text-foreground shadow-brutal-sm hover:-translate-y-0.5 hover:shadow-brutal active:translate-x-[3px] active:translate-y-[3px] active:shadow-none',
        secondary: 'bg-secondary text-secondary-foreground hover:bg-accent',
        ghost: 'border-transparent hover:bg-secondary',
        link: 'border-transparent underline-offset-4 hover:underline',
      },
      size: {
        default: 'h-10 px-4 py-2 has-[>svg]:px-3',
        sm: 'h-8 gap-1.5 px-3 has-[>svg]:px-2.5',
        lg: 'h-12 px-6 text-base has-[>svg]:px-5',
        // 44px on touch screens, 40px where there's a precise pointer.
        icon: 'size-11 md:size-10',
        'icon-sm': 'size-8',
        'icon-lg': 'size-12',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  },
)

function Button({
  className,
  variant,
  size,
  asChild = false,
  ...props
}: React.ComponentProps<'button'> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean
  }) {
  const Comp = asChild ? Slot : 'button'

  return (
    <Comp
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }
