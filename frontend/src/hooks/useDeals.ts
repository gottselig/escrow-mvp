'use client'

import { useQuery } from '@tanstack/react-query'
import type { Address } from 'viem'
import { useAccount, usePublicClient } from 'wagmi'
import { sepolia } from 'wagmi/chains'

import { dealsApi, type DealSummaryApiDto } from '@/lib/api'
import { escrowAbi, escrowFactoryAbi, escrowFactoryAddress, escrowFactoryDeployBlock, ZERO_ADDRESS } from '@/lib/contracts'
import { addressOrZero } from '@/lib/utils'
import type { DealCreatedEvent } from '@/types/deal'

const LOG_BLOCK_RANGE = 2000n

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

function parseCreatedAt(value?: string) {
  if (!value) return undefined

  const numeric = Number(value)
  if (!Number.isNaN(numeric)) {
    // Backend may return unix seconds or milliseconds as a string.
    const timestampMs = numeric > 1e12 ? numeric : numeric * 1000
    return BigInt(Math.floor(timestampMs / 1000))
  }

  const timestampMs = new Date(value).getTime()
  if (Number.isNaN(timestampMs)) return undefined

  return BigInt(Math.floor(timestampMs / 1000))
}

function mapApiDealToEvent(deal: DealSummaryApiDto): DealCreatedEvent {
  return {
    escrow: addressOrZero(deal.escrowAddress) as Address,
    client: addressOrZero(deal.client) as Address,
    contractor: addressOrZero(deal.contractor) as Address,
    arbiter: ZERO_ADDRESS,
    token: addressOrZero(deal.token) as Address,
    totalAmount: BigInt(deal.totalAmount || '0'),
    fundedAmount: BigInt(deal.fundedAmount || '0'),
    metadataURI: deal.metadataURI || '',
    status: parseStatusValue(deal.status),
    createdAt: parseCreatedAt(deal.createdAt),
  }
}

function mergeDeals(apiDeals: DealCreatedEvent[], chainDeals: DealCreatedEvent[]) {
  const merged = new Map<string, DealCreatedEvent>()

  for (const deal of apiDeals) {
    merged.set(deal.escrow.toLowerCase(), deal)
  }

  for (const deal of chainDeals) {
    const key = deal.escrow.toLowerCase()
    const existing = merged.get(key)
    if (!existing) {
      merged.set(key, deal)
      continue
    }

    // Prefer on-chain status/participants/amounts but keep API createdAt when chain timestamp is unavailable.
    merged.set(key, {
      ...existing,
      ...deal,
      createdAt: deal.createdAt ?? existing.createdAt,
      blockNumber: deal.blockNumber ?? existing.blockNumber,
    })
  }

  return Array.from(merged.values()).sort((a, b) => {
    const aTs = a.createdAt ?? 0n
    const bTs = b.createdAt ?? 0n
    if (aTs === bTs) return 0
    return aTs > bTs ? -1 : 1
  })
}

async function findEscrowCreatedInfo(
  publicClient: NonNullable<ReturnType<typeof usePublicClient>>,
  escrow: Address,
  latestBlock: bigint,
  timestampByBlock: Map<bigint, bigint>,
) {
  const searchStarts: bigint[] = [escrowFactoryDeployBlock]
  if (escrowFactoryDeployBlock > 0n) {
    // Fallback when configured deploy block is incorrect or too recent.
    searchStarts.push(0n)
  }

  for (const searchStart of searchStarts) {
    let toBlock = latestBlock

    while (toBlock >= searchStart) {
      const fromBlock = toBlock > LOG_BLOCK_RANGE ? toBlock - LOG_BLOCK_RANGE : searchStart

      const logs = await publicClient.getContractEvents({
        address: escrowFactoryAddress,
        abi: escrowFactoryAbi,
        eventName: 'EscrowCreated',
        fromBlock,
        toBlock,
      })

      let log: (typeof logs)[number] | undefined
      for (let i = logs.length - 1; i >= 0; i -= 1) {
        if (logs[i].args.escrow?.toLowerCase() === escrow.toLowerCase()) {
          log = logs[i]
          break
        }
      }

      if (log?.args.escrow?.toLowerCase() !== escrow.toLowerCase()) {
        log = undefined
      }
      if (log) {
        if (log.blockNumber === undefined) return undefined

        let createdAt = timestampByBlock.get(log.blockNumber)
        if (createdAt === undefined) {
          const block = await publicClient.getBlock({ blockNumber: log.blockNumber })
          createdAt = block.timestamp
          timestampByBlock.set(block.number, block.timestamp)
        }

        return { blockNumber: log.blockNumber, createdAt }
      }

      if (fromBlock === searchStart) break
      toBlock = fromBlock - 1n
    }
  }

  return undefined
}

async function hydrateMissingCreatedAt(
  publicClient: NonNullable<ReturnType<typeof usePublicClient>>,
  deals: DealCreatedEvent[],
) {
  const missingEscrows = deals.filter((deal) => deal.createdAt === undefined).map((deal) => deal.escrow)
  if (missingEscrows.length === 0) return deals

  const latestBlock = await publicClient.getBlockNumber()
  const timestampByBlock = new Map<bigint, bigint>()
  const createdByEscrow = new Map<string, { blockNumber?: bigint; createdAt?: bigint }>()

  await Promise.all(
    missingEscrows.map(async (escrow) => {
      try {
        const created = await findEscrowCreatedInfo(publicClient, escrow, latestBlock, timestampByBlock)
        if (created) {
          createdByEscrow.set(escrow.toLowerCase(), created)
        }
      } catch (error) {
        console.warn('Could not resolve creation timestamp for escrow', escrow, error)
      }
    }),
  )

  return deals.map((deal) => {
    if (deal.createdAt !== undefined) return deal

    const created = createdByEscrow.get(deal.escrow.toLowerCase())
    if (!created) return deal

    return {
      ...deal,
      blockNumber: deal.blockNumber ?? created.blockNumber,
      createdAt: created.createdAt,
    }
  })
}

async function loadDealsFromChain(publicClient: NonNullable<ReturnType<typeof usePublicClient>>) {
  const escrows = await publicClient.readContract({
    address: escrowFactoryAddress,
    abi: escrowFactoryAbi,
    functionName: 'getAllEscrows',
  })

  const createdByEscrow = new Map<string, { blockNumber?: bigint; createdAt?: bigint }>()
  const timestampByBlock = new Map<bigint, bigint>()
  const latestBlock = await publicClient.getBlockNumber()

  const bulkScanStart = escrowFactoryDeployBlock > latestBlock ? 0n : escrowFactoryDeployBlock

  try {
    const createdLogs = []

    for (let fromBlock = bulkScanStart; fromBlock <= latestBlock; fromBlock += LOG_BLOCK_RANGE + 1n) {
      const toBlock = fromBlock + LOG_BLOCK_RANGE > latestBlock ? latestBlock : fromBlock + LOG_BLOCK_RANGE

      const logs = await publicClient.getContractEvents({
        address: escrowFactoryAddress,
        abi: escrowFactoryAbi,
        eventName: 'EscrowCreated',
        fromBlock,
        toBlock,
      })

      createdLogs.push(...logs)
    }

    const blockNumbers = Array.from(
      new Set(createdLogs.map((log) => log.blockNumber).filter((blockNumber): blockNumber is bigint => blockNumber !== undefined)),
    )
    const blocks = await Promise.all(blockNumbers.map((blockNumber) => publicClient.getBlock({ blockNumber })))
    for (const block of blocks) {
      timestampByBlock.set(block.number, block.timestamp)
    }

    for (const log of createdLogs) {
      const escrow = log.args.escrow
      if (!escrow) continue

      createdByEscrow.set(escrow.toLowerCase(), {
        blockNumber: log.blockNumber,
        createdAt: log.blockNumber ? timestampByBlock.get(log.blockNumber) : undefined,
      })
    }
  } catch (error) {
    console.warn('Could not load deal creation timestamps', error)
  }

  // Fallback: if bulk log scan misses some escrows, resolve each missing one explicitly.
  for (const escrow of escrows) {
    const key = escrow.toLowerCase()
    if (createdByEscrow.get(key)?.createdAt !== undefined) continue

    try {
      const created = await findEscrowCreatedInfo(publicClient, escrow, latestBlock, timestampByBlock)
      if (created) {
        createdByEscrow.set(key, created)
      }
    } catch (error) {
      console.warn('Could not resolve creation timestamp for escrow', escrow, error)
    }
  }

  const deals = await Promise.all(
    escrows.map(async (escrow) => {
      const created = createdByEscrow.get(escrow.toLowerCase())
      const [client, contractor, arbiter, token, totalAmount, metadataURI, status] = await Promise.all([
        publicClient.readContract({
          address: escrow,
          abi: escrowAbi,
          functionName: 'client',
        }),
        publicClient.readContract({
          address: escrow,
          abi: escrowAbi,
          functionName: 'contractor',
        }),
        publicClient.readContract({
          address: escrow,
          abi: escrowAbi,
          functionName: 'arbiter',
        }),
        publicClient.readContract({
          address: escrow,
          abi: escrowAbi,
          functionName: 'token',
        }),
        publicClient.readContract({
          address: escrow,
          abi: escrowAbi,
          functionName: 'totalAmount',
        }),
        publicClient.readContract({
          address: escrow,
          abi: escrowAbi,
          functionName: 'metadataURI',
        }),
        publicClient.readContract({
          address: escrow,
          abi: escrowAbi,
          functionName: 'status',
        }),
      ])

      return {
        escrow,
        client,
        contractor,
        arbiter,
        token,
        totalAmount,
        fundedAmount: 0n,
        metadataURI,
        status: Number(status),
        blockNumber: created?.blockNumber,
        createdAt: created?.createdAt,
      } satisfies DealCreatedEvent
    }),
  )

  return deals.reverse()
}

export function useDeals() {
  const publicClient = usePublicClient({ chainId: sepolia.id })
  const { address } = useAccount()

  const query = useQuery({
    queryKey: ['deals', publicClient?.chain?.id, escrowFactoryAddress],
    enabled: true,
    queryFn: async () => {
      const apiDeals = await dealsApi
        .getAll(200, 0)
        .then((response) => (response.success ? response.data.map(mapApiDealToEvent) : []))
        .catch((error) => {
          console.warn('Backend deals API is unavailable', error)
          return [] as DealCreatedEvent[]
        })

      if (!publicClient || escrowFactoryAddress === ZERO_ADDRESS || apiDeals.length === 0) {
        return apiDeals
      }

      const liveByEscrow = new Map<string, Partial<Pick<DealCreatedEvent, 'contractor' | 'status'>>>()
      await Promise.all(
        apiDeals.map(async (deal) => {
          try {
            const shouldRefreshContractor = deal.contractor.toLowerCase() === ZERO_ADDRESS
            const [status, contractor] = await Promise.all([
              publicClient.readContract({
                address: deal.escrow,
                abi: escrowAbi,
                functionName: 'status',
              }),
              shouldRefreshContractor
                ? publicClient.readContract({
                    address: deal.escrow,
                    abi: escrowAbi,
                    functionName: 'contractor',
                  })
                : Promise.resolve(undefined),
            ])

            liveByEscrow.set(deal.escrow.toLowerCase(), {
              status: Number(status),
              ...(contractor ? { contractor } : {}),
            })
          } catch (error) {
            console.warn('Could not refresh live deal fields', deal.escrow, error)
          }
        }),
      )

      return apiDeals.map((deal) => ({
        ...deal,
        ...liveByEscrow.get(deal.escrow.toLowerCase()),
      }))
    },
  })

  const account = address?.toLowerCase()
  const deals = query.data || []
  const myDeals = account ? deals.filter((deal) => deal.client.toLowerCase() === account) : []
  const dealsTaken = account ? deals.filter((deal) => deal.contractor.toLowerCase() === account) : []
  const openDeals = deals.filter(
    (deal) =>
      deal.contractor.toLowerCase() === ZERO_ADDRESS &&
      deal.status === 2 &&
      (!account || deal.client.toLowerCase() !== account),
  )
  const requests = deals.filter(
    (deal) =>
      deal.contractor.toLowerCase() === ZERO_ADDRESS &&
      deal.status === 0,
  )

  return {
    deals,
    myDeals,
    dealsTaken,
    openDeals,
    requests,
    isLoading: query.isLoading,
    isError: query.isError,
    refetch: query.refetch,
  }
}
