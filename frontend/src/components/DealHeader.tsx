'use client'

import { Badge } from '@/components/ui/Badge'
import { Panel } from '@/components/ui/Panel'
import { useMetadata, type DealMetadata } from '@/hooks/useMetadata'
import { dealStatusLabels, ZERO_ADDRESS } from '@/lib/contracts'
import { useI18n } from '@/lib/i18n'
import { formatPaymentAmount, paymentSymbol, shortAddress } from '@/lib/utils'
import type { DealSummary } from '@/types/deal'

export function DealHeader({ deal, title = 'Deal' }: { deal: DealSummary; title?: 'Request' | 'Deal' | 'Task' }) {
  const { t } = useI18n()
  const isUnassigned = deal.contractor.toLowerCase() === ZERO_ADDRESS
  const status = isUnassigned ? t('common.new') : dealStatusLabels[Number(deal.status)] || t('common.created')
  const isFunded = deal.fundedAmount > 0n || deal.status === 2 || deal.status === 3
  const funding = isFunded ? t('common.funded') : t('common.unfunded')
  const tokenSymbol = paymentSymbol(deal.token)
  const metadataQuery = useMetadata<DealMetadata>(deal.metadataURI)
  const metadata = metadataQuery.data
  const displayTitle = metadata?.title || shortAddress(deal.address)
  const description = metadata?.description || deal.metadataURI || t('common.noDescription')
  const titleLabel = title === 'Request' ? t('common.request') : title === 'Task' ? t('common.task') : t('common.deal')

  return (
    <Panel className="grid gap-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-gray-500">{titleLabel}</p>
          <h1 className="mt-1 text-2xl font-bold">{displayTitle}</h1>
          <p className="mt-2 max-w-2xl text-sm text-gray-600">{description}</p>
          {metadata?.category && <p className="mt-2 text-xs font-medium uppercase tracking-wide text-gray-500">{metadata.category}</p>}
        </div>
        <div className="flex gap-2">
          <Badge tone={deal.status === 6 ? 'success' : deal.status === 4 ? 'warning' : 'default'}>{status}</Badge>
          <Badge tone={isFunded ? 'success' : 'warning'}>{funding}</Badge>
          <Badge tone={deal.isNativePayment ? 'success' : 'default'}>{tokenSymbol}</Badge>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Metric label={t('common.total')} value={`${formatPaymentAmount(deal.totalAmount, deal.token)} ${tokenSymbol}`} />
        <Metric label={t('common.funded')} value={`${formatPaymentAmount(deal.fundedAmount, deal.token)} ${tokenSymbol}`} />
        <Metric label={t('common.released')} value={`${formatPaymentAmount(deal.releasedAmount, deal.token)} ${tokenSymbol}`} />
        <Metric label={t('common.remaining')} value={`${formatPaymentAmount(deal.remainingBalance, deal.token)} ${tokenSymbol}`} />
      </div>

      <div className="grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
        <Address label={t('common.initiator')} value={deal.client} />
        <Address label={t('common.executor')} value={deal.contractor} emptyLabel={t('common.notAssigned')} />
        <Address label={t('common.arbiter')} value={deal.arbiter} />
        <Address label={t('common.treasury')} value={deal.treasury} />
      </div>
    </Panel>
  )
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-border p-3">
      <p className="text-sm text-gray-500">{label}</p>
      <p className="mt-1 font-semibold">{value}</p>
    </div>
  )
}

function Address({ label, value, emptyLabel }: { label: string; value: string; emptyLabel?: string }) {
  return (
    <div>
      <p className="text-gray-500">{label}</p>
      <p className="font-medium">{value.toLowerCase() === ZERO_ADDRESS && emptyLabel ? emptyLabel : shortAddress(value)}</p>
    </div>
  )
}
