import { cn } from '@/lib/utils'

type PanelProps = {
  children: React.ReactNode
  className?: string
}

export function Panel({ children, className }: PanelProps) {
  return <section className={cn('rounded-md border border-border bg-white p-5', className)}>{children}</section>
}
