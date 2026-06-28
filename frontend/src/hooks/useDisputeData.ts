'use client'

import { useQuery } from '@tanstack/react-query'

import { dealsApi, type DisputeApiDto } from '@/lib/api'

export type DisputeData = {
  id: string
  openedBy: string
  reasonURI: string | null
  status: 'Open' | 'Resolved' | string
  resolutionType: string | null
  clientAmount: string | null
  contractorAmount: string | null
  openedAt: string
  resolvedAt: string | null
}

function mapDispute(d: DisputeApiDto): DisputeData {
  return {
    id: d.id,
    openedBy: d.openedBy,
    reasonURI: d.reasonURI,
    status: d.status,
    resolutionType: d.resolutionType,
    clientAmount: d.clientAmount,
    contractorAmount: d.contractorAmount,
    openedAt: d.openedAt,
    resolvedAt: d.resolvedAt,
  }
}

/**
 * Fetches dispute data for a given escrow address from the backend API.
 * Replaces direct on-chain reads for dispute state.
 */
export function useDisputeData(escrowAddress?: string) {
  const query = useQuery({
    queryKey: ['disputes', escrowAddress],
    enabled: Boolean(escrowAddress),
    retry: false,
    queryFn: async () => {
      if (!escrowAddress) return []
      const res = await dealsApi.getDisputesByEscrow(escrowAddress)
      if (!res.success || !res.data) throw new Error('Failed to fetch disputes')
      return res.data.map(mapDispute)
    },
  })

  const disputes = query.data ?? []
  const activeDispute = disputes.find((d) => d.status === 'Open') ?? disputes[0] ?? null

  return {
    disputes,
    activeDispute,
    isLoading: query.isLoading,
    refetch: () => query.refetch(),
  }
}
