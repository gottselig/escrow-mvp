'use client'

import { useRef, useState } from 'react'
import type { Address } from 'viem'
import { usePublicClient, useWriteContract } from 'wagmi'
import { sepolia } from 'wagmi/chains'
import { toast } from 'sonner'

import { escrowAbi } from '@/lib/contracts'

export function useDispute(address: Address) {
  const publicClient = usePublicClient({ chainId: sepolia.id })
  const { writeContractAsync, isPending } = useWriteContract()
  const [txPending, setTxPending] = useState(false)
  const txPendingRef = useRef(false)

  async function writeAndWait(
    label: string,
    request:
      | { functionName: 'openDispute'; args: [string] }
      | { functionName: 'resolveToClient'; args?: [] }
      | { functionName: 'resolveToContractor'; args?: [] }
      | { functionName: 'resolveSplit'; args: [bigint, bigint] },
  ) {
    if (!publicClient) throw new Error('Wallet client is not ready')
    if (txPendingRef.current) return

    txPendingRef.current = true
    setTxPending(true)

    try {
      const hash = await writeContractAsync({
        address,
        abi: escrowAbi,
        functionName: request.functionName,
        args: request.args as never,
        chainId: sepolia.id,
      })

      toast.info(label)
      await publicClient.waitForTransactionReceipt({ hash })
      toast.success('Transaction confirmed')
      return hash
    } finally {
      txPendingRef.current = false
      setTxPending(false)
    }
  }

  return {
    isPending: isPending || txPending,
    openDispute: (reasonURI: string) => writeAndWait('Opening dispute', { functionName: 'openDispute', args: [reasonURI] }),
    resolveToClient: () => writeAndWait('Resolving to client', { functionName: 'resolveToClient' }),
    resolveToContractor: () => writeAndWait('Resolving to contractor', { functionName: 'resolveToContractor' }),
    resolveSplit: (clientAmount: bigint, contractorAmount: bigint) =>
      writeAndWait('Resolving split', { functionName: 'resolveSplit', args: [clientAmount, contractorAmount] }),
  }
}
