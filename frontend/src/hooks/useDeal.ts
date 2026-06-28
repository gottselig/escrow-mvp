'use client'

import { useQuery } from '@tanstack/react-query'
import type { Address } from 'viem'
import { isAddress } from 'viem'
import { useReadContracts } from 'wagmi'
import { sepolia } from 'wagmi/chains'

import { dealsApi, type DealApiDto } from '@/lib/api'
import { escrowAbi, ZERO_ADDRESS } from '@/lib/contracts'
import { addressOrZero } from '@/lib/utils'
import type { DealSummary, Milestone } from '@/types/deal'

const dealStatusIndexByName = {
  Created: 0,
  Accepted: 1,
  Funded: 2,
  InProgress: 3,
  'In Progress': 3,
  Disputed: 4,
  Resolved: 5,
  Completed: 6,
  Cancelled: 7,
} as const

function parseStatusValue(status: number | string) {
  if (typeof status === 'number') return status
  return dealStatusIndexByName[status as keyof typeof dealStatusIndexByName] ?? 0
}

function mapApiDealToSummary(
  deal: DealApiDto,
  computed?: { remainingBalance?: bigint; isNativePayment?: boolean; currentMilestoneId?: bigint },
): DealSummary {
  return {
    address: addressOrZero(deal.escrowAddress) as Address,
    client: addressOrZero(deal.client) as Address,
    contractor: addressOrZero(deal.contractor) as Address,
    arbiter: addressOrZero(deal.arbiter) as Address,
    token: addressOrZero(deal.token) as Address,
    treasury: addressOrZero(deal.treasury) as Address,
    totalAmount: BigInt(deal.totalAmount || '0'),
    fundedAmount: BigInt(deal.fundedAmount || '0'),
    releasedAmount: BigInt(deal.releasedAmount || '0'),
    feeBps: deal.feeBps,
    status: parseStatusValue(deal.status),
    metadataURI: deal.metadataURI || '',
    disputeReasonURI: deal.disputeReasonURI || '',
    remainingBalance: computed?.remainingBalance ?? BigInt(deal.fundedAmount || '0') - BigInt(deal.releasedAmount || '0'),
    isNativePayment: computed?.isNativePayment ?? deal.token === ZERO_ADDRESS,
    currentMilestoneId: computed?.currentMilestoneId ?? 0n,
  }
}

function mapApiMilestone(status: number | string) {
  if (typeof status === 'number') return status

  const milestoneStatusIndexByName = {
    Pending: 0,
    Submitted: 1,
    Approved: 2,
    Refunded: 3,
  } as const

  return milestoneStatusIndexByName[status as keyof typeof milestoneStatusIndexByName] ?? 0
}

function mapApiMilestones(deal?: DealApiDto): Milestone[] {
  if (!deal) return []

  return deal.milestones.map((milestone) => ({
    id: milestone.milestoneIndex,
    amount: BigInt(milestone.amount || '0'),
    deadline: BigInt(Math.floor(new Date(milestone.deadline).getTime() / 1000)),
    status: mapApiMilestone(milestone.status),
    descriptionURI: milestone.descriptionURI || '',
    resultURI: milestone.resultURI || '',
  }))
}

export function useDeal(address?: string) {
  const dealAddress = address && isAddress(address) ? (address as Address) : undefined

  const apiQuery = useQuery({
    queryKey: ['deal', dealAddress],
    enabled: Boolean(dealAddress),
    retry: false,
    queryFn: async () => {
      if (!dealAddress) return undefined

      const response = await dealsApi.getByAddress(dealAddress)
      if (!response.success || !response.data) {
        throw new Error(response.error || 'Failed to fetch deal from API')
      }

      return response.data
    },
  })

  const liveReads = useReadContracts({
    allowFailure: false,
    contracts: dealAddress
      ? [
          ...(apiQuery.data?.contractor?.toLowerCase() === ZERO_ADDRESS
            ? [{ address: dealAddress, abi: escrowAbi, functionName: 'contractor', chainId: sepolia.id } as const]
            : []),
          { address: dealAddress, abi: escrowAbi, functionName: 'status', chainId: sepolia.id },
        ]
      : [],
    query: {
      enabled: Boolean(dealAddress && dealAddress !== ZERO_ADDRESS),
    },
  })

  const liveData = liveReads.data

  const liveDeal: DealSummary | undefined =
    liveData && liveData.length > 0 && apiQuery.data
      ? (() => {
          const shouldRefreshContractor = apiQuery.data.contractor.toLowerCase() === ZERO_ADDRESS
          return {
            ...mapApiDealToSummary(apiQuery.data),
            contractor: shouldRefreshContractor ? (liveData[0] as `0x${string}`) : addressOrZero(apiQuery.data.contractor),
            status: Number(liveData[shouldRefreshContractor ? 1 : 0]),
          }
        })()
      : undefined

  const apiDeal = apiQuery.data ? mapApiDealToSummary(apiQuery.data) : undefined
  const deal = liveDeal || apiDeal
  const milestones = mapApiMilestones(apiQuery.data)

  return {
    deal,
    milestones,
    isLoading: apiQuery.isLoading || liveReads.isLoading,
    isError: Boolean(apiQuery.isError && !liveDeal) || (liveReads.isError && !apiDeal),
    refetch: async () => {
      await apiQuery.refetch()
      await liveReads.refetch()
    },
  }
}
