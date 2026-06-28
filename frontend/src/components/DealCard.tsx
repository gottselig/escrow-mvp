'use client'

import { useQuery } from '@tanstack/react-query'
import Link from 'next/link'
import { useMemo } from 'react'
import type { Address } from 'viem'
import { usePublicClient } from 'wagmi'
import { sepolia } from 'wagmi/chains'

import { Badge } from '@/components/ui/Badge'
import { Panel } from '@/components/ui/Panel'
import { useMetadata, type DealMetadata } from '@/hooks/useMetadata'
import { dealsApi } from '@/lib/api'
import { dealStatusLabels, ZERO_ADDRESS } from '@/lib/contracts'
import { useI18n } from '@/lib/i18n'
import { formatPaymentAmount, formatUnixTimestamp, paymentSymbol, shortAddress } from '@/lib/utils'
import type { DealCreatedEvent } from '@/types/deal'

function parseCreatedAtToUnix(value?: string) {
  if (!value) return undefined

  const timestampMs = new Date(value).getTime()
  if (Number.isNaN(timestampMs)) return undefined
  return BigInt(Math.floor(timestampMs / 1000))
}

async function findDeploymentTimestamp(
  publicClient: NonNullable<ReturnType<typeof usePublicClient>>,
  escrow: Address,
) {
  const latestBlock = await publicClient.getBlockNumber()

  // If there is no code now, contract does not exist on this chain.
  const latestCode = await publicClient.getBytecode({ address: escrow })
  if (!latestCode || latestCode === '0x') return undefined

  let left = 0n
  let right = latestBlock
  let firstWithCode = latestBlock

  while (left <= right) {
    const mid = (left + right) / 2n
    const codeAtMid = await publicClient.getBytecode({ address: escrow, blockNumber: mid })

    if (codeAtMid && codeAtMid !== '0x') {
      firstWithCode = mid
      if (mid === 0n) break
      right = mid - 1n
    } else {
      left = mid + 1n
    }
  }

  const block = await publicClient.getBlock({ blockNumber: firstWithCode })
  return block.timestamp
}

export function DealCard({ deal }: { deal: DealCreatedEvent }) {
  const { t } = useI18n()
  const isOpen = deal.contractor.toLowerCase() === ZERO_ADDRESS
  const isFunded = deal.fundedAmount > 0n || deal.status === 2 || deal.status === 3
  const status = isOpen ? t('common.new') : dealStatusLabels[Number(deal.status)] || t('common.created')
  const publicClient = usePublicClient({ chainId: sepolia.id })
  const metadataQuery = useMetadata<DealMetadata>(deal.metadataURI)

  const createdAtQuery = useQuery({
    queryKey: ['deal-created-at', deal.escrow],
    enabled: deal.createdAt === undefined && Boolean(publicClient),
    staleTime: 60_000,
    queryFn: async () => {
      if (!publicClient) return undefined

      // Prefer backend value when available.
      try {
        const res = await dealsApi.getByAddress(deal.escrow)
        const createdAt = parseCreatedAtToUnix(res.data?.createdAt)
        if (createdAt !== undefined) {
          return createdAt
        }
      } catch {
        // Ignore API errors and continue with on-chain fallback.
      }

      // Fallback for old, non-indexed deals: infer contract deployment block.
      return findDeploymentTimestamp(publicClient, deal.escrow)
    },
  })

  const createdAt = useMemo(() => deal.createdAt ?? createdAtQuery.data, [deal.createdAt, createdAtQuery.data])
  const metadata = metadataQuery.data
  const title = metadata?.title || shortAddress(deal.escrow)
  const description = metadata?.description || deal.metadataURI || t('common.noDescription')

  return (
    <Panel className="grid gap-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link className="text-lg font-semibold text-primary" href={`/deals/${deal.escrow}`}>
            {title}
          </Link>
          <p className="mt-1 line-clamp-2 text-sm text-gray-600">{description}</p>
          {metadata?.category && <p className="mt-1 text-xs font-medium text-gray-500">{metadata.category}</p>}
        </div>
        <div className="flex flex-wrap gap-2">
          {isOpen && <Badge tone="success">{t('common.request')}</Badge>}
          <Badge>{status}</Badge>
          <Badge tone={isFunded ? 'success' : 'warning'}>{isFunded ? t('common.funded') : t('common.unfunded')}</Badge>
          <Badge tone={deal.token === ZERO_ADDRESS ? 'success' : 'default'}>{paymentSymbol(deal.token)}</Badge>
        </div>
      </div>

      <div className="grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <p className="text-gray-500">{t('common.initiator')}</p>
          <p className="font-medium">{shortAddress(deal.client)}</p>
        </div>
        <div>
          <p className="text-gray-500">{t('common.executor')}</p>
          <p className="font-medium">{isOpen ? t('common.notAssigned') : shortAddress(deal.contractor)}</p>
        </div>
        <div>
          <p className="text-gray-500">{t('common.total')}</p>
          <p className="font-medium">
            {formatPaymentAmount(deal.totalAmount, deal.token)} {paymentSymbol(deal.token)}
          </p>
        </div>
        <div>
          <p className="text-gray-500">{t('common.created')}</p>
          <p className="font-medium">{formatUnixTimestamp(createdAt)}</p>
        </div>
      </div>
    </Panel>
  )
}
