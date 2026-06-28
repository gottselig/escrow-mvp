'use client'

import { useRef, useState } from 'react'
import { isAddress, type Address } from 'viem'
import { useAccount, useChainId, usePublicClient, useReadContracts, useWriteContract } from 'wagmi'
import { sepolia } from 'wagmi/chains'
import { toast } from 'sonner'

import { DealCard } from '@/components/DealCard'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Panel } from '@/components/ui/Panel'
import { Select } from '@/components/ui/Select'
import { TxStatus } from '@/components/TxStatus'
import { useDeals } from '@/hooks/useDeals'
import { escrowFactoryAbi, escrowFactoryAddress, mosUsdcAddress, ZERO_ADDRESS } from '@/lib/contracts'
import { formatPaymentAmount, paymentSymbol, shortAddress } from '@/lib/utils'

const NATIVE_TOKEN = ZERO_ADDRESS

export default function OwnerPage() {
  const { address } = useAccount()
  const chainId = useChainId()
  const publicClient = usePublicClient({ chainId: sepolia.id })
  const { writeContractAsync, isPending } = useWriteContract()
  const { deals, isLoading, isError, refetch } = useDeals()
  const [txPending, setTxPending] = useState(false)
  const [tokenMode, setTokenMode] = useState<'ETH' | 'MUSDC' | 'CUSTOM'>('ETH')
  const [customToken, setCustomToken] = useState('')
  const txPendingRef = useRef(false)

  const factoryReads = useReadContracts({
    allowFailure: false,
    contracts: [
      {
        address: escrowFactoryAddress,
        abi: escrowFactoryAbi,
        functionName: 'owner',
        chainId: sepolia.id,
      },
      {
        address: escrowFactoryAddress,
        abi: escrowFactoryAbi,
        functionName: 'treasury',
        chainId: sepolia.id,
      },
      {
        address: escrowFactoryAddress,
        abi: escrowFactoryAbi,
        functionName: 'allowedToken',
        chainId: sepolia.id,
      },
      {
        address: escrowFactoryAddress,
        abi: escrowFactoryAbi,
        functionName: 'feeBalance',
        args: [NATIVE_TOKEN],
        chainId: sepolia.id,
      },
      {
        address: escrowFactoryAddress,
        abi: escrowFactoryAbi,
        functionName: 'feeBalance',
        args: [mosUsdcAddress],
        chainId: sepolia.id,
      },
    ],
    query: {
      enabled: escrowFactoryAddress !== ZERO_ADDRESS,
    },
  })

  const owner = factoryReads.data?.[0]
  const treasury = factoryReads.data?.[1]
  const allowedToken = factoryReads.data?.[2]
  const ethFees = factoryReads.data?.[3] || 0n
  const mosUsdcFees = factoryReads.data?.[4] || 0n
  const isOwner = Boolean(address && owner && address.toLowerCase() === owner.toLowerCase())
  const isWrongChain = Boolean(address && chainId !== sepolia.id)
  const pending = isPending || txPending
  const selectedToken = tokenMode === 'ETH' ? NATIVE_TOKEN : tokenMode === 'MUSDC' ? mosUsdcAddress : customToken
  const canUseSelectedToken =
    selectedToken === NATIVE_TOKEN || (isAddress(selectedToken) && selectedToken !== ZERO_ADDRESS)
  const isSameToken = Boolean(
    allowedToken && canUseSelectedToken && allowedToken.toLowerCase() === selectedToken.toLowerCase(),
  )

  async function withdrawFees(token: Address) {
    if (!publicClient) throw new Error('Wallet client is not ready')
    if (isWrongChain) throw new Error('Switch wallet to Sepolia first')
    if (!isOwner || txPendingRef.current) return

    txPendingRef.current = true
    setTxPending(true)

    try {
      const hash = await writeContractAsync({
        address: escrowFactoryAddress,
        abi: escrowFactoryAbi,
        functionName: 'withdrawFees',
        args: [token],
        chainId: sepolia.id,
      })

      toast.info(`Withdrawing ${paymentSymbol(token)} fees`)
      await publicClient.waitForTransactionReceipt({ hash })
      await factoryReads.refetch()
      toast.success('Fees withdrawn to owner wallet')
    } finally {
      txPendingRef.current = false
      setTxPending(false)
    }
  }

  async function updatePaymentToken() {
    if (!publicClient) throw new Error('Wallet client is not ready')
    if (isWrongChain) throw new Error('Switch wallet to Sepolia first')
    if (!canUseSelectedToken) throw new Error('Enter a valid token address')
    if (!isOwner || txPendingRef.current || isSameToken) return

    txPendingRef.current = true
    setTxPending(true)

    try {
      const nextToken = selectedToken as Address
      const hash = await writeContractAsync({
        address: escrowFactoryAddress,
        abi: escrowFactoryAbi,
        functionName: 'setPaymentToken',
        args: [nextToken],
        chainId: sepolia.id,
      })

      toast.info(`Switching factory token to ${paymentSymbol(nextToken)}`)
      await publicClient.waitForTransactionReceipt({ hash })
      await factoryReads.refetch()
      toast.success('Factory payment token updated')
    } finally {
      txPendingRef.current = false
      setTxPending(false)
    }
  }

  return (
    <main className="page-shell grid gap-6 py-8">
      <section className="grid gap-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-3xl font-bold">Factory owner</h1>
            <p className="mt-1 text-sm text-gray-600">Factory: {escrowFactoryAddress}</p>
          </div>
          <Button disabled={pending} onClick={() => { void Promise.all([factoryReads.refetch(), refetch()]) }} type="button" variant="secondary">
            Refresh
          </Button>
        </div>

        {escrowFactoryAddress === ZERO_ADDRESS && (
          <Panel>
            <p className="text-sm text-gray-600">Set NEXT_PUBLIC_ESCROW_FACTORY_ADDRESS first.</p>
          </Panel>
        )}

        {isWrongChain && (
          <Panel>
            <p className="text-sm text-red-700">Switch wallet to Sepolia first.</p>
          </Panel>
        )}

        {!isOwner && escrowFactoryAddress !== ZERO_ADDRESS && (
          <Panel>
            <h2 className="text-xl font-bold">Owner wallet required</h2>
            <p className="mt-2 text-sm text-gray-600">
              Connected wallet: {shortAddress(address)}. Factory owner: {shortAddress(owner)}.
            </p>
          </Panel>
        )}
      </section>

      {isOwner && (
        <>
          <Panel className="grid gap-4">
            <div>
              <h2 className="text-xl font-bold">Payment token</h2>
              <p className="mt-1 text-sm text-gray-600">
                Current: {paymentSymbol(allowedToken)} ({allowedToken || ZERO_ADDRESS})
              </p>
            </div>

            <div className="grid gap-3 md:grid-cols-[180px_1fr_auto] md:items-end">
              <label className="grid gap-1 text-sm font-medium">
                Token
                <Select value={tokenMode} onChange={(event) => setTokenMode(event.target.value as typeof tokenMode)}>
                  <option value="ETH">ETH</option>
                  <option value="MUSDC" disabled={mosUsdcAddress === ZERO_ADDRESS}>
                    mUSDC
                  </option>
                  <option value="CUSTOM">Custom</option>
                </Select>
              </label>

              <label className="grid gap-1 text-sm font-medium">
                Address
                <Input
                  disabled={tokenMode !== 'CUSTOM'}
                  onChange={(event) => setCustomToken(event.target.value)}
                  placeholder={tokenMode === 'CUSTOM' ? '0x...' : selectedToken}
                  value={tokenMode === 'CUSTOM' ? customToken : selectedToken}
                />
              </label>

              <Button
                disabled={pending || !canUseSelectedToken || isSameToken}
                onClick={() => {
                  void updatePaymentToken().catch((error) => {
                    toast.error(error?.shortMessage || error?.message || 'Could not update payment token')
                  })
                }}
                type="button"
              >
                Update token
              </Button>
            </div>

            {tokenMode === 'MUSDC' && mosUsdcAddress === ZERO_ADDRESS && (
              <p className="text-sm text-red-700">Set NEXT_PUBLIC_MOS_USDC_ADDRESS first.</p>
            )}
            {tokenMode === 'CUSTOM' && customToken && !canUseSelectedToken && (
              <p className="text-sm text-red-700">Enter a valid token address.</p>
            )}
            <TxStatus pending={pending} />
          </Panel>

          <Panel className="grid gap-4">
            <div>
              <h2 className="text-xl font-bold">Fee balances</h2>
              <p className="mt-1 text-sm text-gray-600">Treasury: {shortAddress(treasury)}. Withdraw sends funds to owner.</p>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <FeeBalance
                amount={ethFees}
                token={NATIVE_TOKEN}
                disabled={pending || ethFees === 0n}
                onWithdraw={() => withdrawFees(NATIVE_TOKEN)}
              />
              <FeeBalance
                amount={mosUsdcFees}
                token={mosUsdcAddress}
                disabled={pending || mosUsdcFees === 0n || mosUsdcAddress === ZERO_ADDRESS}
                onWithdraw={() => withdrawFees(mosUsdcAddress)}
              />
            </div>
            <TxStatus pending={pending} />
          </Panel>

          <section className="grid gap-3">
            <div>
              <h2 className="text-xl font-bold">Factory deals</h2>
              <p className="text-sm text-gray-600">All deals created by this factory.</p>
            </div>

            {isLoading && <Panel>Loading deals...</Panel>}
            {isError && (
              <Panel>
                <p className="text-sm text-red-700">Could not load factory deals. Check Sepolia RPC and refresh.</p>
              </Panel>
            )}
            {!isLoading && !isError && deals.length === 0 && (
              <Panel>
                <p className="text-sm text-gray-600">No deals found on this factory.</p>
              </Panel>
            )}
            {!isLoading && !isError && deals.length > 0 && (
              <div className="grid gap-4">
                {deals.map((deal) => (
                  <DealCard key={deal.escrow} deal={deal} />
                ))}
              </div>
            )}
          </section>
        </>
      )}
    </main>
  )
}

function FeeBalance({
  amount,
  token,
  disabled,
  onWithdraw,
}: {
  amount: bigint
  token: Address
  disabled: boolean
  onWithdraw: () => void
}) {
  const symbol = paymentSymbol(token)

  return (
    <div className="grid gap-3 rounded-md border border-border p-4">
      <div>
        <p className="text-sm text-gray-500">{symbol} fees</p>
        <p className="mt-1 text-2xl font-bold">
          {formatPaymentAmount(amount, token)} {symbol}
        </p>
      </div>
      <Button disabled={disabled} onClick={onWithdraw} type="button">
        Withdraw to owner
      </Button>
    </div>
  )
}
