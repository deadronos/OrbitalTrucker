import { forwardRef, type HTMLAttributes } from 'react'

import { cn } from '../../lib/utils'

const Card = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => {
    return (
      <div
        className={cn(
          'rounded-3xl border border-white/10 bg-slate-950/55 shadow-[0_24px_60px_rgba(0,0,0,0.3)] backdrop-blur-xl',
          className,
        )}
        ref={ref}
        {...props}
      />
    )
  },
)

Card.displayName = 'Card'

export { Card }