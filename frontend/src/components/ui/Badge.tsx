import { cn } from '@/lib/utils'

type BadgeProps = {
  children: React.ReactNode
  tone?: 'default' | 'success' | 'warning' | 'muted'
  className?: string
}

export function Badge({ children, tone = 'default', className }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-md px-2 py-1 text-xs font-semibold',
        tone === 'default' && 'bg-primary/10 text-primary',
        tone === 'success' && 'bg-success/10 text-success',
        tone === 'warning' && 'bg-warning/15 text-yellow-800',
        tone === 'muted' && 'bg-muted text-gray-700',
        className,
      )}
    >
      {children}
    </span>
  )
}
