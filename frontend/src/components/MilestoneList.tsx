'use client'

import { useState } from 'react'

import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Panel } from '@/components/ui/Panel'
import { useMetadata, type MilestoneMetadata } from '@/hooks/useMetadata'
import { milestoneStatusLabels } from '@/lib/contracts'
import { formatPaymentAmount, paymentSymbol } from '@/lib/utils'
import type { DealSummary, Milestone } from '@/types/deal'

type MilestoneListProps = {
  deal: DealSummary
  milestones: Milestone[]
  isClient: boolean
  isContractor: boolean
  onSubmit: (milestoneId: bigint, resultURI: string) => Promise<void>
  onApprove: (milestoneId: bigint) => Promise<void>
  pending?: boolean
}

export function MilestoneList({
  deal,
  milestones,
  isClient,
  isContractor,
  onSubmit,
  onApprove,
  pending,
}: MilestoneListProps) {
  const [resultURI, setResultURI] = useState('')
  const currentId = Number(deal.currentMilestoneId)

  return (
    <Panel className="grid gap-4">
      <div>
        <h2 className="text-xl font-bold">Milestones</h2>
        <p className="mt-1 text-sm text-gray-600">Work moves one milestone at a time.</p>
      </div>

      <div className="grid gap-3">
        {milestones.map((milestone) => {
          const isCurrent = milestone.id === currentId
          const canSubmit = isContractor && isCurrent && deal.status === 3 && milestone.status === 0
          const canApprove = isClient && isCurrent && deal.status === 3 && milestone.status === 1

          return (
            <div key={milestone.id} className="rounded-md border border-border p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold">Milestone {milestone.id + 1}</h3>
                    {isCurrent && <Badge tone="warning">Current</Badge>}
                    <Badge tone={milestone.status === 2 ? 'success' : 'muted'}>
                      {milestoneStatusLabels[milestone.status] || 'Unknown'}
                    </Badge>
                  </div>
                  <MilestoneDescription milestone={milestone} />
                  {milestone.resultURI && <p className="mt-1 text-sm text-gray-600">Result: {milestone.resultURI}</p>}
                </div>
                <p className="font-semibold">
                  {formatPaymentAmount(milestone.amount, deal.token)} {paymentSymbol(deal.token)}
                </p>
              </div>

              {(canSubmit || canApprove) && (
                <div className="mt-4 flex flex-col gap-2 sm:flex-row">
                  {canSubmit && (
                    <>
                      <Input
                        value={resultURI}
                        onChange={(event) => setResultURI(event.target.value)}
                        placeholder="ipfs://result"
                      />
                      <Button
                        disabled={pending || !resultURI}
                        onClick={() => onSubmit(BigInt(milestone.id), resultURI)}
                        type="button"
                      >
                        Submit
                      </Button>
                    </>
                  )}
                  {canApprove && (
                    <Button disabled={pending} onClick={() => onApprove(BigInt(milestone.id))} type="button">
                      Approve
                    </Button>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </Panel>
  )
}

function MilestoneDescription({ milestone }: { milestone: Milestone }) {
  const metadataQuery = useMetadata<MilestoneMetadata>(milestone.descriptionURI)
  const metadata = metadataQuery.data

  if (!metadata) {
    return <p className="mt-2 text-sm text-gray-600">{milestone.descriptionURI || 'No description yet'}</p>
  }

  return (
    <div className="mt-2 grid gap-2 text-sm text-gray-600">
      {metadata.title && <p className="font-medium text-gray-900">{metadata.title}</p>}
      {metadata.description && <p>{metadata.description}</p>}
      {metadata.acceptanceCriteria && metadata.acceptanceCriteria.length > 0 && (
        <div>
          <p className="font-medium text-gray-700">Acceptance criteria</p>
          <ul className="mt-1 list-disc space-y-1 pl-5">
            {metadata.acceptanceCriteria.map((criterion, index) => (
              <li key={index}>{criterion}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
