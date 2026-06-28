'use client'

import { useRef, useState } from 'react'
import type { Address } from 'viem'
import { usePublicClient, useReadContract, useWriteContract } from 'wagmi'
import { sepolia } from 'wagmi/chains'
import { toast } from 'sonner'

import { erc20Abi, escrowAbi } from '@/lib/contracts'
import type { DealSummary, MilestoneInput } from '@/types/deal'

export function useDealActions(deal?: DealSummary) {
  const publicClient = usePublicClient({ chainId: sepolia.id })
  const { writeContractAsync, isPending } = useWriteContract()
  const [txPending, setTxPending] = useState(false)
  const txPendingRef = useRef(false)

  const allowance = useReadContract({
    address: deal?.token,
    abi: erc20Abi,
    functionName: 'allowance',
    args: deal ? [deal.client, deal.address] : undefined,
    chainId: sepolia.id,
    query: {
      enabled: Boolean(deal && !deal.isNativePayment),
    },
  })

  async function waitFor(hash: Address | `0x${string}`, label: string) {
    if (!publicClient) throw new Error('Wallet client is not ready')
    toast.info(label)
    await publicClient.waitForTransactionReceipt({ hash })
    toast.success('Transaction confirmed')
  }

  async function fund() {
    if (!deal) return
    if (!publicClient) throw new Error('Wallet client is not ready')
    if (txPendingRef.current) return

    txPendingRef.current = true
    setTxPending(true)

    try {
      if (deal.isNativePayment) {
        const hash = await writeContractAsync({
          address: deal.address,
          abi: escrowAbi,
          functionName: 'fund',
          value: deal.totalAmount,
          chainId: sepolia.id,
        })
        await waitFor(hash, 'Funding with ETH')
        return
      }

      if ((allowance.data || 0n) < deal.totalAmount) {
        const approveHash = await writeContractAsync({
          address: deal.token,
          abi: erc20Abi,
          functionName: 'approve',
          args: [deal.address, deal.totalAmount],
          chainId: sepolia.id,
        })
        await waitFor(approveHash, 'Approving MosUSDC')
        await allowance.refetch()
      }

      const hash = await writeContractAsync({
        address: deal.address,
        abi: escrowAbi,
        functionName: 'fund',
        chainId: sepolia.id,
      })
      await waitFor(hash, 'Funding with MosUSDC')
    } finally {
      txPendingRef.current = false
      setTxPending(false)
    }
  }

  async function call(functionName: 'acceptDeal' | 'cancelBeforeFunding' | 'approveMilestone', args?: [bigint]) {
    if (!deal) return
    if (txPendingRef.current) return

    txPendingRef.current = true
    setTxPending(true)

    try {
      const hash = await writeContractAsync({
        address: deal.address,
        abi: escrowAbi,
        functionName,
        args: args as never,
        chainId: sepolia.id,
      })
      await waitFor(hash, 'Sending transaction')
    } finally {
      txPendingRef.current = false
      setTxPending(false)
    }
  }

  async function submitMilestone(milestoneId: bigint, resultURI: string) {
    if (!deal) return
    if (txPendingRef.current) return

    txPendingRef.current = true
    setTxPending(true)

    try {
      const hash = await writeContractAsync({
        address: deal.address,
        abi: escrowAbi,
        functionName: 'submitMilestone',
        args: [milestoneId, resultURI],
        chainId: sepolia.id,
      })
      await waitFor(hash, 'Submitting milestone')
    } finally {
      txPendingRef.current = false
      setTxPending(false)
    }
  }

  async function updateDeal(totalAmount: bigint, milestones: MilestoneInput[], metadataURI: string) {
    if (!deal) return
    if (txPendingRef.current) return

    txPendingRef.current = true
    setTxPending(true)

    try {
      const hash = await writeContractAsync({
        address: deal.address,
        abi: escrowAbi,
        functionName: 'updateDeal',
        args: [totalAmount, milestones, metadataURI],
        chainId: sepolia.id,
      })
      await waitFor(hash, 'Updating deal')
    } finally {
      txPendingRef.current = false
      setTxPending(false)
    }
  }

  return {
    isPending: isPending || txPending,
    allowance: allowance.data || 0n,
    refetchAllowance: allowance.refetch,
    fund,
    acceptDeal: () => call('acceptDeal'),
    cancelBeforeFunding: () => call('cancelBeforeFunding'),
    updateDeal,
    approveMilestone: (milestoneId: bigint) => call('approveMilestone', [milestoneId]),
    submitMilestone,
  }
}
