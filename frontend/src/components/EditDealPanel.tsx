'use client'

import { useEffect, useState } from 'react'

import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Panel } from '@/components/ui/Panel'
import { Textarea } from '@/components/ui/Textarea'
import { metadataApi } from '@/lib/api'
import { formatPaymentAmount, parsePaymentAmount, paymentSymbol } from '@/lib/utils'
import type { DealMetadata, MilestoneMetadata } from '@/hooks/useMetadata'
import type { DealSummary, Milestone, MilestoneInput } from '@/types/deal'

type EditableMilestone = {
  amount: string
  days: string
  metadataURI: string
  title: string
  description: string
  acceptanceCriteria: string
}

type EditDealPanelProps = {
  deal: DealSummary
  milestones: Milestone[]
  pending: boolean
  onSave: (totalAmount: bigint, milestones: MilestoneInput[], metadataURI: string) => Promise<void>
}

function unixSecondsNow() {
  return Math.floor(Date.now() / 1000)
}

function metadataId(uri?: string | null) {
  return uri?.startsWith('metadata://') ? uri.slice('metadata://'.length) : undefined
}

export function EditDealPanel({ deal, milestones, pending, onSave }: EditDealPanelProps) {
  const [requestTitle, setRequestTitle] = useState('')
  const [requestDescription, setRequestDescription] = useState('')
  const [requestCategory, setRequestCategory] = useState('')
  const [totalAmount, setTotalAmount] = useState(formatPaymentAmount(deal.totalAmount, deal.token))
  const [items, setItems] = useState<EditableMilestone[]>(() => {
    const now = unixSecondsNow()
    return (
      milestones.map((milestone) => ({
        amount: formatPaymentAmount(milestone.amount, deal.token),
        days: String(Math.max(1, Math.ceil((Number(milestone.deadline) - now) / 86_400))),
        metadataURI: milestone.descriptionURI,
        title: `Milestone ${milestone.id + 1}`,
        description: '',
        acceptanceCriteria: '',
      })) ?? []
    )
  })

  const symbol = paymentSymbol(deal.token)

  useEffect(() => {
    let cancelled = false

    async function loadDealMetadata() {
      if (!metadataId(deal.metadataURI)) {
        setRequestDescription(deal.metadataURI)
        return
      }

      try {
        const response = await metadataApi.get(deal.metadataURI)
        const metadata = response.data?.data as DealMetadata | undefined
        if (cancelled || !metadata) return
        setRequestTitle(metadata.title || '')
        setRequestDescription(metadata.description || '')
        setRequestCategory(metadata.category || '')
      } catch {
        if (!cancelled) setRequestDescription(deal.metadataURI)
      }
    }

    loadDealMetadata()
    return () => {
      cancelled = true
    }
  }, [deal.metadataURI])

  useEffect(() => {
    let cancelled = false

    async function loadMilestoneMetadata() {
      const loaded = await Promise.all(
        milestones.map(async (milestone) => {
          if (!metadataId(milestone.descriptionURI)) return undefined

          try {
            const response = await metadataApi.get(milestone.descriptionURI)
            return response.data?.data as MilestoneMetadata | undefined
          } catch {
            return undefined
          }
        }),
      )

      if (cancelled) return

      setItems((current) =>
        current.map((item, index) => {
          const metadata = loaded[index]
          if (!metadata) return item

          return {
            ...item,
            title: metadata.title || item.title,
            description: metadata.description || item.description,
            acceptanceCriteria: (metadata.acceptanceCriteria || []).join('\n'),
          }
        }),
      )
    }

    loadMilestoneMetadata()
    return () => {
      cancelled = true
    }
  }, [milestones])

  async function save() {
    const now = unixSecondsNow()
    const dealMetadata = await metadataApi.create('deal', {
      title: requestTitle,
      description: requestDescription,
      category: requestCategory,
      previousURI: deal.metadataURI,
    })
    if (!dealMetadata.success || !dealMetadata.data?.uri) {
      throw new Error('Could not save request metadata')
    }

    const milestoneMetadata = await Promise.all(
      items.map(async (item, index) => {
        const response = await metadataApi.create('milestone', {
          title: item.title,
          description: item.description,
          acceptanceCriteria: item.acceptanceCriteria
            .split('\n')
            .map((criterion) => criterion.trim())
            .filter(Boolean),
          order: index,
          previousURI: item.metadataURI,
        })

        if (!response.success || !response.data?.uri) {
          throw new Error('Could not save milestone metadata')
        }

        return response.data.uri
      }),
    )

    await onSave(
      parsePaymentAmount(totalAmount, deal.token),
      items.map((item, index) => ({
        amount: parsePaymentAmount(item.amount, deal.token),
        deadline: BigInt(now + Number(item.days || 1) * 86_400),
        descriptionURI: milestoneMetadata[index],
      })),
      dealMetadata.data.uri,
    )
  }

  return (
    <Panel className="grid gap-4">
      <div>
        <h2 className="text-xl font-bold">Edit request</h2>
        <p className="mt-1 text-sm text-gray-600">Unfunded requests can be edited before an executor takes them.</p>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <label className="field-label">
          Request title
          <Input value={requestTitle} onChange={(event) => setRequestTitle(event.target.value)} />
        </label>
        <label className="field-label">
          Category
          <Input value={requestCategory} onChange={(event) => setRequestCategory(event.target.value)} />
        </label>
      </div>

      <label className="field-label">
        Request description
        <Textarea value={requestDescription} onChange={(event) => setRequestDescription(event.target.value)} />
      </label>

      <label className="field-label">
        Total amount
        <Input value={totalAmount} onChange={(event) => setTotalAmount(event.target.value)} />
        <span className="field-hint">Amount is saved in {symbol}.</span>
      </label>

      <div className="grid gap-3">
        <div className="flex items-center justify-between gap-3">
          <h3 className="font-semibold">Milestones</h3>
          <Button
            type="button"
            variant="secondary"
            onClick={() =>
              setItems((current) => [
                ...current,
                {
                  amount: '0',
                  days: '7',
                  metadataURI: '',
                  title: 'New milestone',
                  description: '',
                  acceptanceCriteria: '',
                },
              ])
            }
          >
            Add
          </Button>
        </div>

        {items.map((item, index) => (
          <div key={index} className="grid gap-3 rounded-md border border-border p-4">
            <div className="grid gap-3 md:grid-cols-2">
              <label className="field-label">
                Title
                <Input
                  value={item.title}
                  onChange={(event) =>
                    setItems((current) =>
                      current.map((currentItem, currentIndex) =>
                        currentIndex === index ? { ...currentItem, title: event.target.value } : currentItem,
                      ),
                    )
                  }
                />
              </label>
              <label className="field-label">
                Acceptance criteria
                <Textarea
                  value={item.acceptanceCriteria}
                  onChange={(event) =>
                    setItems((current) =>
                      current.map((currentItem, currentIndex) =>
                        currentIndex === index ? { ...currentItem, acceptanceCriteria: event.target.value } : currentItem,
                      ),
                    )
                  }
                />
              </label>
            </div>
            <label className="field-label">
              Description
              <Textarea
                value={item.description}
                onChange={(event) =>
                  setItems((current) =>
                    current.map((currentItem, currentIndex) =>
                      currentIndex === index ? { ...currentItem, description: event.target.value } : currentItem,
                    ),
                  )
                }
              />
            </label>
            <div className="grid gap-3 md:grid-cols-[1fr_1fr_auto]">
              <label className="field-label">
                Amount
                <Input
                  value={item.amount}
                  onChange={(event) =>
                    setItems((current) =>
                      current.map((currentItem, currentIndex) =>
                        currentIndex === index ? { ...currentItem, amount: event.target.value } : currentItem,
                      ),
                    )
                  }
                />
              </label>
              <label className="field-label">
                Days
                <Input
                  min={1}
                  type="number"
                  value={item.days}
                  onChange={(event) =>
                    setItems((current) =>
                      current.map((currentItem, currentIndex) =>
                        currentIndex === index ? { ...currentItem, days: event.target.value } : currentItem,
                      ),
                    )
                  }
                />
              </label>
              <Button
                className="self-end"
                disabled={items.length === 1}
                type="button"
                variant="secondary"
                onClick={() => setItems((current) => current.filter((_, currentIndex) => currentIndex !== index))}
              >
                Remove
              </Button>
            </div>
          </div>
        ))}
      </div>

      <Button disabled={pending || items.length === 0} type="button" onClick={save}>
        Save changes
      </Button>
    </Panel>
  )
}
