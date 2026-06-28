'use client'

import { useQueryClient } from '@tanstack/react-query'
import { useAccount } from 'wagmi'

import { DealHeader } from '@/components/DealHeader'
import { DisputePanel } from '@/components/DisputePanel'
import { EditDealPanel } from '@/components/EditDealPanel'
import { MilestoneList } from '@/components/MilestoneList'
import { Button } from '@/components/ui/Button'
import { Panel } from '@/components/ui/Panel'
import { TxStatus } from '@/components/TxStatus'
import { useDeal } from '@/hooks/useDeal'
import { useDealActions } from '@/hooks/useDealActions'
import { useDispute } from '@/hooks/useDispute'
import { useDisputeData } from '@/hooks/useDisputeData'
import { useMilestones } from '@/hooks/useMilestones'
import { ZERO_ADDRESS } from '@/lib/contracts'
import { shortAddress } from '@/lib/utils'

type DealDetailClientProps = {
  address: string
}

export function DealDetailClient({ address }: DealDetailClientProps) {
  const queryClient = useQueryClient()
  const { address: account } = useAccount()
  const { deal, milestones: initialMilestones, isLoading, refetch } = useDeal(address)
  const milestones = useMilestones(address, initialMilestones)
  const disputeData = useDisputeData(address)
  const actions = useDealActions(deal)
  const dispute = useDispute(address as `0x${string}`)

  const currentAccount = account?.toLowerCase()
  const isClient = Boolean(deal && currentAccount === deal.client.toLowerCase())
  const isContractor = Boolean(deal && currentAccount === deal.contractor.toLowerCase())
  const isArbiter = Boolean(deal && currentAccount === deal.arbiter.toLowerCase())
  const isParticipant = isClient || isContractor
  const isUnassigned = Boolean(deal && deal.contractor.toLowerCase() === ZERO_ADDRESS)
  const canTakeTask = Boolean(deal && account && isUnassigned && deal.status === 2 && !isClient)
  const canEditTask = Boolean(
    deal && (isClient || isArbiter) && isUnassigned && deal.status === 0 && deal.fundedAmount === 0n,
  )
  const pageTitle = isUnassigned ? 'Request' : isContractor ? 'Task' : 'Deal'
  const pending = actions.isPending || dispute.isPending

  async function refreshAll() {
    // Invalidate all cached queries for this deal to force immediate refetch
    await queryClient.invalidateQueries({ queryKey: ['deal', address] })
    await queryClient.invalidateQueries({ queryKey: ['milestones', address] })
    await queryClient.invalidateQueries({ queryKey: ['disputes', address] })
    await refetch()
    await milestones.refetch()
    await disputeData.refetch()
  }

  if (isLoading) {
    return (
      <main className="page-shell py-8">
        <Panel>Loading request...</Panel>
      </main>
    )
  }

  if (!deal) {
    return (
      <main className="page-shell grid gap-4 py-8">
        <Panel>
          <h1 className="text-xl font-bold">Request not found</h1>
          <p className="mt-2 text-sm text-gray-600">{address}</p>
        </Panel>
      </main>
    )
  }

  return (
    <main className="page-shell grid gap-6 py-8">
      <DealHeader deal={deal} title={pageTitle} />

      <Panel className="grid gap-4">
        <div>
          <h2 className="text-xl font-bold">Actions</h2>
          <p className="mt-1 text-sm text-gray-600">Connected wallet: {shortAddress(account)}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {isClient && (deal.status === 0 || deal.status === 1) && (
            <Button
              disabled={pending}
              onClick={async () => {
                await actions.fund()
                await refreshAll()
              }}
              type="button"
            >
              Fund
            </Button>
          )}

          {(canTakeTask || (isContractor && deal.status === 2)) && (
            <Button
              disabled={pending}
              onClick={async () => {
                await actions.acceptDeal()
                await refreshAll()
              }}
              type="button"
              variant="secondary"
            >
              {canTakeTask ? 'Take request' : 'Accept task'}
            </Button>
          )}

          {((isClient && (deal.status === 0 || deal.status === 2) && isUnassigned) ||
            (isArbiter && deal.status === 0 && deal.fundedAmount === 0n)) && (
            <Button
              disabled={pending}
              onClick={async () => {
                await actions.cancelBeforeFunding()
                await refreshAll()
              }}
              type="button"
              variant="danger"
            >
              {deal.fundedAmount > 0n ? 'Delete and refund' : 'Delete request'}
            </Button>
          )}
        </div>
        <TxStatus pending={pending} />
      </Panel>

      {canEditTask && (
        <EditDealPanel
          deal={deal}
          milestones={milestones.milestones}
          pending={pending}
          onSave={async (totalAmount, milestoneInputs, metadataURI) => {
            await actions.updateDeal(totalAmount, milestoneInputs, metadataURI)
            await refreshAll()
          }}
        />
      )}

      <MilestoneList
        deal={deal}
        milestones={milestones.milestones}
        isClient={isClient}
        isContractor={isContractor}
        pending={pending}
        onApprove={async (milestoneId) => {
          await actions.approveMilestone(milestoneId)
          await refreshAll()
        }}
        onSubmit={async (milestoneId, resultURI) => {
          await actions.submitMilestone(milestoneId, resultURI)
          await refreshAll()
        }}
      />

      <DisputePanel
        deal={deal}
        isParticipant={isParticipant}
        isArbiter={isArbiter}
        pending={pending}
        activeDispute={disputeData.activeDispute}
        onOpen={async (reasonURI) => {
          await dispute.openDispute(reasonURI)
          await refreshAll()
        }}
        onResolveClient={async () => {
          await dispute.resolveToClient()
          await refreshAll()
        }}
        onResolveContractor={async () => {
          await dispute.resolveToContractor()
          await refreshAll()
        }}
        onResolveSplit={async (clientAmount, contractorAmount) => {
          await dispute.resolveSplit(clientAmount, contractorAmount)
          await refreshAll()
        }}
      />
    </main>
  )
}
