'use client'

import { useRef, useState } from 'react'
import { parseEventLogs, type Address } from 'viem'
import { useAccount, useChainId, usePublicClient, useReadContracts, useWriteContract } from 'wagmi'
import { sepolia } from 'wagmi/chains'
import { toast } from 'sonner'

import { dealsApi } from '@/lib/api'
import { erc20Abi, escrowAbi, escrowFactoryAbi, escrowFactoryAddress, mosUsdcAddress, ZERO_ADDRESS } from '@/lib/contracts'
import type { MilestoneInput, PaymentMode } from '@/types/deal'

type CreateDealParams = {
  arbiter: Address
  totalAmount: bigint
  milestones: MilestoneInput[]
  metadataURI: string
}

type FundCreatedDealParams = {
  escrow: Address
  token: Address
  totalAmount: bigint
}

export function useCreateDeal() {
  const { address } = useAccount()
  const chainId = useChainId()
  const publicClient = usePublicClient({ chainId: sepolia.id })
  const { writeContractAsync, isPending } = useWriteContract()
  const [txPending, setTxPending] = useState(false)
  const txPendingRef = useRef(false)

  const factoryReads = useReadContracts({
    allowFailure: false,
    contracts: [
      {
        address: escrowFactoryAddress,
        abi: escrowFactoryAbi,
        functionName: 'allowedToken',
        chainId: sepolia.id,
      },
      {
        address: escrowFactoryAddress,
        abi: escrowFactoryAbi,
        functionName: 'defaultArbiter',
        chainId: sepolia.id,
      },
      {
        address: escrowFactoryAddress,
        abi: escrowFactoryAbi,
        functionName: 'owner',
        chainId: sepolia.id,
      },
    ],
    query: {
      enabled: escrowFactoryAddress !== ZERO_ADDRESS,
    },
  })

  const allowedToken = factoryReads.data?.[0]
  const defaultArbiter = factoryReads.data?.[1]
  const owner = factoryReads.data?.[2]

  const expectedPaymentToken = (paymentMode: PaymentMode) =>
    paymentMode === 'ETH' ? ZERO_ADDRESS : mosUsdcAddress

  const isFactoryConfiguredFor = (paymentMode: PaymentMode) =>
    Boolean(allowedToken && allowedToken.toLowerCase() === expectedPaymentToken(paymentMode).toLowerCase())

  const canSwitchPaymentToken = Boolean(address && owner && address.toLowerCase() === owner.toLowerCase())
  const isWrongChain = Boolean(address && chainId !== sepolia.id)

  async function setPaymentToken(paymentMode: PaymentMode) {
    if (!publicClient) throw new Error('Wallet client is not ready')
    if (isWrongChain) throw new Error('Switch wallet to Sepolia first')
    if (txPendingRef.current) return

    txPendingRef.current = true
    setTxPending(true)

    try {
      const token = expectedPaymentToken(paymentMode)
      const hash = await writeContractAsync({
        address: escrowFactoryAddress,
        abi: escrowFactoryAbi,
        functionName: 'setPaymentToken',
        args: [token],
        chainId: sepolia.id,
      })

      toast.info('Switching payment token')
      await publicClient.waitForTransactionReceipt({ hash })
      await factoryReads.refetch()
      toast.success(`Factory switched to ${paymentMode}`)
    } finally {
      txPendingRef.current = false
      setTxPending(false)
    }
  }

  async function createDeal(params: CreateDealParams) {
    if (!publicClient) throw new Error('Wallet client is not ready')
    if (isWrongChain) throw new Error('Switch wallet to Sepolia first')
    if (txPendingRef.current) return {}

    txPendingRef.current = true
    setTxPending(true)

    try {
      const hash = await writeContractAsync({
        address: escrowFactoryAddress,
        abi: escrowFactoryAbi,
        functionName: 'createEscrow',
        args: [
          ZERO_ADDRESS,
          params.arbiter,
          params.totalAmount,
          params.milestones,
          params.metadataURI,
        ],
        chainId: sepolia.id,
      })

      toast.info('Creating request')
      const receipt = await publicClient.waitForTransactionReceipt({ hash })
      const events = parseEventLogs({
        abi: escrowFactoryAbi,
        logs: receipt.logs,
        eventName: 'EscrowCreated',
      })

      const escrow = events[0]?.args.escrow
      if (escrow) {
        dealsApi
          .create({
            escrowAddress: escrow,
            factoryAddress: escrowFactoryAddress,
            verifyOnChain: true,
            txHash: hash,
            blockNumber: Number(receipt.blockNumber),
          })
          .catch((error) => {
            console.error('Failed to sync created request with backend:', error)
            toast.warning('Request created on-chain, but backend sync is delayed')
          })
      }

      toast.success('Request created')
      return { hash, escrow }
    } finally {
      txPendingRef.current = false
      setTxPending(false)
    }
  }

  async function fundCreatedDeal(params: FundCreatedDealParams) {
    if (!publicClient) throw new Error('Wallet client is not ready')
    if (isWrongChain) throw new Error('Switch wallet to Sepolia first')
    if (txPendingRef.current) return

    txPendingRef.current = true
    setTxPending(true)

    try {
      if (params.token.toLowerCase() === ZERO_ADDRESS) {
        const hash = await writeContractAsync({
          address: params.escrow,
          abi: escrowAbi,
          functionName: 'fund',
          value: params.totalAmount,
          chainId: sepolia.id,
        })

        toast.info('Depositing ETH')
        await publicClient.waitForTransactionReceipt({ hash })
        toast.success('Funds deposited')
        return
      }

      const approveHash = await writeContractAsync({
        address: params.token,
        abi: erc20Abi,
        functionName: 'approve',
        args: [params.escrow, params.totalAmount],
        chainId: sepolia.id,
      })

      toast.info('Approving MosUSDC')
      await publicClient.waitForTransactionReceipt({ hash: approveHash })

      const fundHash = await writeContractAsync({
        address: params.escrow,
        abi: escrowAbi,
        functionName: 'fund',
        chainId: sepolia.id,
      })

      toast.info('Depositing MosUSDC')
      await publicClient.waitForTransactionReceipt({ hash: fundHash })
      toast.success('Funds deposited')
    } finally {
      txPendingRef.current = false
      setTxPending(false)
    }
  }

  return {
    allowedToken,
    defaultArbiter,
    owner,
    canSwitchPaymentToken,
    isWrongChain,
    isFactoryConfiguredFor,
    setPaymentToken,
    createDeal,
    fundCreatedDeal,
    isPending: isPending || txPending,
    isLoadingFactory: factoryReads.isLoading,
  }
}
