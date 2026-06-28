import { Badge } from '@/components/ui/Badge'

export function TxStatus({ label, pending }: { label?: string; pending?: boolean }) {
  if (!pending) return null

  return (
    <div className="flex items-center gap-2 text-sm text-gray-600">
      <Badge tone="warning">Pending</Badge>
      <span>{label || 'Waiting for confirmation'}</span>
    </div>
  )
}
