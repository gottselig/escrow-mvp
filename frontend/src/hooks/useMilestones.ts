'use client'

import { useQuery } from '@tanstack/react-query'
import type { Address } from 'viem'
import { isAddress } from 'viem'
import { usePublicClient } from 'wagmi'
import { sepolia } from 'wagmi/chains'

import { dealsApi } from '@/lib/api'
import { escrowAbi, ZERO_ADDRESS } from '@/lib/contracts'
import type { Milestone } from '@/types/deal'

function mapApiMilestone(m: any): Milestone {
  return {
    id: m.milestoneIndex,
    amount: BigInt(m.amount || '0'),
    deadline: BigInt(Math.floor(new Date(m.deadline).getTime() / 1000)),
    status: typeof m.status === 'number' ? m.status : { Pending: 0, Submitted: 1, Approved: 2, Refunded: 3 }[m.status as string] ?? 0,
    descriptionURI: m.descriptionURI || '',
    resultURI: m.resultURI || '',
  }
}

export function useMilestones(address?: string, initialMilestones: Milestone[] = []) {
  const publicClient = usePublicClient({ chainId: sepolia.id })
  const escrowAddress = address && isAddress(address) ? (address as Address) : undefined

  const query = useQuery({
    queryKey: ['milestones', address],
    enabled: Boolean(address),
    retry: false,
    queryFn: async () => {
      if (!address) return []

      // Primary source: backend API.
      try {
        const res = await dealsApi.getMilestones(address)
        if (res.success && res.data && res.data.length > 0) {
          return res.data.map(mapApiMilestone)
        }
      } catch {
        // Ignore API errors and try chain fallback.
      }

      // Fallback: read milestones directly from chain.
      if (!publicClient || !escrowAddress || escrowAddress === ZERO_ADDRESS) return []

      const count = Number(
        await publicClient.readContract({
          address: escrowAddress,
          abi: escrowAbi,
          functionName: 'getMilestonesCount',
        }),
      )

      if (count === 0) return []

      const onchain = await Promise.all(
        Array.from({ length: count }, async (_, index) => {
          const milestone = await publicClient.readContract({
            address: escrowAddress,
            abi: escrowAbi,
            functionName: 'getMilestone',
            args: [BigInt(index)],
          })

          const asObject = milestone as {
            amount?: bigint
            deadline?: bigint
            status?: number | bigint
            descriptionURI?: string
            resultURI?: string
          }
          const asTuple = milestone as unknown as readonly [bigint, bigint, number | bigint, string, string]

          const amount = asObject.amount ?? asTuple[0] ?? 0n
          const deadline = asObject.deadline ?? asTuple[1] ?? 0n
          const statusRaw = asObject.status ?? asTuple[2] ?? 0
          const descriptionURI = asObject.descriptionURI ?? asTuple[3] ?? ''
          const resultURI = asObject.resultURI ?? asTuple[4] ?? ''

          return {
            id: index,
            amount,
            deadline,
            status: Number(statusRaw),
            descriptionURI,
            resultURI,
          } satisfies Milestone
        }),
      )

      return onchain
    },
  })

  const milestones = query.data ?? initialMilestones

  return {
    count: milestones.length,
    milestones,
    isLoading: query.isLoading,
    refetch: () => query.refetch(),
  }
}
