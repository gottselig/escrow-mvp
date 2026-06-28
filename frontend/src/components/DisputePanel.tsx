'use client'

import { useMemo, useState } from 'react'

import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Panel } from '@/components/ui/Panel'
import { formatPaymentAmount, parsePaymentAmount, paymentSymbol } from '@/lib/utils'
import type { DisputeData } from '@/hooks/useDisputeData'
import type { DealSummary } from '@/types/deal'

type DisputePanelProps = {
  deal: DealSummary
  isParticipant: boolean
  isArbiter: boolean
  activeDispute?: DisputeData | null
  onOpen: (reasonURI: string) => Promise<void>
  onResolveClient: () => Promise<void>
  onResolveContractor: () => Promise<void>
  onResolveSplit: (clientAmount: bigint, contractorAmount: bigint) => Promise<void>
  pending?: boolean
}

export function DisputePanel({
  deal,
  isParticipant,
  isArbiter,
  activeDispute,
  onOpen,
  onResolveClient,
  onResolveContractor,
  onResolveSplit,
  pending,
}: DisputePanelProps) {
  const [reasonURI, setReasonURI] = useState('')
  const [clientAmount, setClientAmount] = useState('')
  const [contractorAmount, setContractorAmount] = useState('')

  const canOpen = isParticipant && (deal.status === 2 || deal.status === 3)
  const canResolve = isArbiter && deal.status === 4
  const symbol = paymentSymbol(deal.token)

  const splitPreview = useMemo(() => {
    if (!clientAmount || !contractorAmount) return ''
    try {
      const clientShare = parsePaymentAmount(clientAmount, deal.token)
      const contractorShare = parsePaymentAmount(contractorAmount, deal.token)
      return clientShare + contractorShare === deal.remainingBalance ? '' : 'Split must equal remaining balance.'
    } catch {
      return 'Enter valid amounts.'
    }
  }, [clientAmount, contractorAmount, deal.remainingBalance, deal.token])

  return (
    <Panel className="grid gap-4">
      <div>
        <h2 className="text-xl font-bold">Dispute</h2>
        <p className="mt-1 text-sm text-gray-600">
          Remaining balance: {formatPaymentAmount(deal.remainingBalance, deal.token)} {symbol}
        </p>
      </div>

      {(activeDispute?.reasonURI || deal.disputeReasonURI) && (
        <p className="rounded-md bg-muted p-3 text-sm">Reason: {activeDispute?.reasonURI || deal.disputeReasonURI}</p>
      )}

      {canOpen && (
        <div className="grid gap-2">
          <label className="field-label">
            Reason URI
            <Input value={reasonURI} onChange={(event) => setReasonURI(event.target.value)} placeholder="ipfs://reason" />
          </label>
          <Button disabled={pending || !reasonURI} onClick={() => onOpen(reasonURI)} type="button">
            Open dispute
          </Button>
        </div>
      )}

      {canResolve && (
        <div className="grid gap-3">
          <div className="flex flex-wrap gap-2">
            <Button disabled={pending} onClick={onResolveClient} type="button" variant="secondary">
              Resolve to client
            </Button>
            <Button disabled={pending} onClick={onResolveContractor} type="button" variant="secondary">
              Resolve to contractor
            </Button>
          </div>

          <div className="grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
            <Input
              value={clientAmount}
              onChange={(event) => setClientAmount(event.target.value)}
              placeholder={`Client ${symbol}`}
            />
            <Input
              value={contractorAmount}
              onChange={(event) => setContractorAmount(event.target.value)}
              placeholder={`Contractor ${symbol}`}
            />
            <Button
              disabled={pending || Boolean(splitPreview)}
              onClick={() =>
                onResolveSplit(parsePaymentAmount(clientAmount, deal.token), parsePaymentAmount(contractorAmount, deal.token))
              }
              type="button"
            >
              Resolve split
            </Button>
          </div>
          {splitPreview && <p className="field-error">{splitPreview}</p>}
        </div>
      )}

      {!canOpen && !canResolve && (
        <p className="text-sm text-gray-600">Disputes can be opened by participants after funding.</p>
      )}
    </Panel>
  )
}
