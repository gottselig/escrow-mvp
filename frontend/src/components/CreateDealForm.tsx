'use client'

import { zodResolver } from '@hookform/resolvers/zod'
import { useRouter } from 'next/navigation'
import { useMemo, useState } from 'react'
import { useFieldArray, useForm, useWatch } from 'react-hook-form'
import type { Address } from 'viem'
import { useAccount } from 'wagmi'
import { z } from 'zod'

import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Panel } from '@/components/ui/Panel'
import { Select } from '@/components/ui/Select'
import { Textarea } from '@/components/ui/Textarea'
import { useSettings } from '@/hooks/useSettings'
import { useI18n } from '@/lib/i18n'
import { metadataApi } from '@/lib/api'
import { escrowFactoryAddress, mosUsdcAddress, ZERO_ADDRESS } from '@/lib/contracts'
import { addressOrZero, parsePaymentAmount, paymentSymbol } from '@/lib/utils'
import { useCreateDeal } from '@/hooks/useCreateDeal'
import type { PaymentMode } from '@/types/deal'

const amountPattern = /^\d+(\.\d+)?$/

function unixSecondsNow() {
  return Math.floor(Date.now() / 1000)
}

const milestoneSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  description: z.string().min(1, 'Description is required'),
  acceptanceCriteria: z.string().optional(),
  amount: z
    .string()
    .regex(amountPattern, 'Enter a valid amount')
    .refine((value) => Number(value) > 0, 'Amount must be greater than zero'),
  days: z.coerce.number().int().positive('Use a future deadline'),
})

const createDealSchema = z.object({
  paymentMode: z.enum(['ETH', 'MUSDC']),
  title: z.string().min(1, 'Title is required'),
  description: z.string().min(1, 'Description is required'),
  category: z.string().optional(),
  milestones: z.array(milestoneSchema).min(1, 'Add at least one milestone'),
})

type CreateDealFormValues = z.infer<typeof createDealSchema>

type CreatedDealDeposit = {
  escrow: Address
  token: Address
  totalAmount: bigint
  symbol: string
}

const defaultValues: CreateDealFormValues = {
  paymentMode: 'MUSDC',
  title: '',
  description: '',
  category: '',
  milestones: [
    { title: 'First milestone', description: '', acceptanceCriteria: '', amount: '500', days: 7 },
    { title: 'Second milestone', description: '', acceptanceCriteria: '', amount: '500', days: 14 },
  ],
}

function sumDecimalStrings(values: string[]) {
  const validValues = values.filter((value) => amountPattern.test(value))
  if (validValues.length === 0) return '0'

  const scale = validValues.reduce((max, value) => {
    const decimals = value.split('.')[1]?.length || 0
    return Math.max(max, decimals)
  }, 0)
  const multiplier = 10n ** BigInt(scale)
  const total = validValues.reduce((sum, value) => {
    const [whole, fraction = ''] = value.split('.')
    const normalized = `${whole}${fraction.padEnd(scale, '0')}`
    return sum + BigInt(normalized)
  }, 0n)
  const whole = total / multiplier
  const fraction = total % multiplier

  if (scale === 0) return whole.toString()

  const fractionText = fraction.toString().padStart(scale, '0').replace(/0+$/, '')
  return fractionText ? `${whole}.${fractionText}` : whole.toString()
}

export function CreateDealForm() {
  const router = useRouter()
  const { address } = useAccount()
  const { locale, t } = useI18n()
  const settingsQuery = useSettings()
  const {
    allowedToken,
    defaultArbiter,
    canSwitchPaymentToken,
    isWrongChain,
    isFactoryConfiguredFor,
    setPaymentToken,
    createDeal,
    fundCreatedDeal,
    isPending,
    isLoadingFactory,
  } = useCreateDeal()
  const [createdDeal, setCreatedDeal] = useState<CreatedDealDeposit | null>(null)

  const form = useForm<CreateDealFormValues>({
    resolver: zodResolver(createDealSchema),
    defaultValues,
    mode: 'onChange',
  })

  const milestones = useFieldArray({
    control: form.control,
    name: 'milestones',
  })

  const paymentMode = useWatch({ control: form.control, name: 'paymentMode' }) as PaymentMode
  const milestoneValues = useWatch({ control: form.control, name: 'milestones' })
  const factoryReady = isFactoryConfiguredFor(paymentMode)
  const selectedToken = paymentMode === 'ETH' ? ZERO_ADDRESS : mosUsdcAddress
  const symbol = paymentSymbol(selectedToken)
  const factoryPaymentMode: PaymentMode | undefined = useMemo(() => {
    if (!allowedToken) return undefined
    return allowedToken.toLowerCase() === ZERO_ADDRESS.toLowerCase() ? 'ETH' : 'MUSDC'
  }, [allowedToken])
  const totalAmount = useMemo(
    () => sumDecimalStrings((milestoneValues ?? []).map((milestone) => milestone?.amount || '0')),
    [milestoneValues],
  )
  const appSettings = settingsQuery.data?.app
  const maxMilestones = appSettings?.maxMilestones || 8
  const minDeadlineDays = appSettings?.minDeadlineDays || 1
  const maxDeadlineDays = appSettings?.maxDeadlineDays || 90

  const factoryMessage = useMemo(() => {
    if (escrowFactoryAddress === ZERO_ADDRESS) return t('factory.setAddress')
    if (isWrongChain) return t('factory.switchChain')
    if (isLoadingFactory) return t('factory.checkingToken')
    if (factoryReady) return t('factory.ready', { symbol })
    if (paymentMode === 'MUSDC' && mosUsdcAddress === ZERO_ADDRESS) return t('factory.setMosUsdc')
    if (canSwitchPaymentToken) return t('factory.willSwitch', { symbol })
    return t('factory.useCurrent', { mode: factoryPaymentMode || 'another token' })
  }, [canSwitchPaymentToken, factoryPaymentMode, factoryReady, isLoadingFactory, isWrongChain, paymentMode, symbol, t])

  async function onSubmit(values: CreateDealFormValues) {
    if (!address) {
      form.setError('paymentMode', { message: t('create.connectWalletFirst') })
      return
    }

    if (escrowFactoryAddress === ZERO_ADDRESS) {
      form.setError('paymentMode', { message: t('factory.setAddress') })
      return
    }
    if (isWrongChain) {
      form.setError('paymentMode', { message: t('factory.switchChain') })
      return
    }
    if (appSettings?.maintenanceMode) {
      form.setError('paymentMode', { message: t('app.maintenanceEnabled') })
      return
    }
    if (values.milestones.length > maxMilestones) {
      form.setError('milestones', { message: t('app.maxMilestonesError', { count: maxMilestones }) })
      return
    }
    const invalidDeadline = values.milestones.some(
      (milestone) => milestone.days < minDeadlineDays || milestone.days > maxDeadlineDays,
    )
    if (invalidDeadline) {
      form.setError('milestones', {
        message: t('app.deadlineRangeError', { min: minDeadlineDays, max: maxDeadlineDays }),
      })
      return
    }

    let effectivePaymentMode: PaymentMode = values.paymentMode

    if (!factoryReady) {
      if (canSwitchPaymentToken) {
        await setPaymentToken(values.paymentMode)
      } else if (factoryPaymentMode) {
        // Non-owner cannot switch factory token, so creation uses the current factory token.
        effectivePaymentMode = factoryPaymentMode
      } else {
        form.setError('paymentMode', { message: factoryMessage })
        return
      }
    }

    const token = effectivePaymentMode === 'ETH' ? ZERO_ADDRESS : mosUsdcAddress
    const now = unixSecondsNow()
    const parsedTotalAmount = parsePaymentAmount(totalAmount, token)
    const dealMetadata = await metadataApi.create('deal', {
      title: values.title,
      description: values.description,
      category: values.category || '',
      locale,
    })
    if (!dealMetadata.success || !dealMetadata.data?.uri) {
      throw new Error('Could not save request metadata')
    }

    const milestoneMetadata = await Promise.all(
      values.milestones.map(async (milestone, index) => {
        const response = await metadataApi.create('milestone', {
          title: milestone.title,
          description: milestone.description,
          acceptanceCriteria: (milestone.acceptanceCriteria || '')
            .split('\n')
            .map((item) => item.trim())
            .filter(Boolean),
          order: index,
          locale,
        })

        if (!response.success || !response.data?.uri) {
          throw new Error('Could not save milestone metadata')
        }

        return response.data.uri
      }),
    )

    const result = await createDeal({
      arbiter: addressOrZero(defaultArbiter),
      totalAmount: parsedTotalAmount,
      metadataURI: dealMetadata.data.uri,
      milestones: values.milestones.map((milestone, index) => ({
        amount: parsePaymentAmount(milestone.amount, token),
        deadline: BigInt(now + milestone.days * 24 * 60 * 60),
        descriptionURI: milestoneMetadata[index],
      })),
    })

    if (result.escrow) {
      setCreatedDeal({
        escrow: result.escrow,
        token,
        totalAmount: parsedTotalAmount,
        symbol: paymentSymbol(token),
      })
    }
  }

  async function depositNow() {
    if (!createdDeal) return

    await fundCreatedDeal({
      escrow: createdDeal.escrow,
      token: createdDeal.token,
      totalAmount: createdDeal.totalAmount,
    })
    router.push(`/deals/${createdDeal.escrow}`)
  }

  function depositLater() {
    if (!createdDeal) return
    router.push(`/deals/${createdDeal.escrow}`)
  }

  return (
    <>
      <Panel>
        <form className="grid gap-5" onSubmit={form.handleSubmit(onSubmit)}>
          <div>
            <h1 className="text-2xl font-bold">{t('create.title')}</h1>
            <p className="mt-1 text-sm text-gray-600">{t('create.subtitle')}</p>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <label className="field-label">
              {t('create.requestTitle')}
              <Input placeholder={t('create.requestTitlePlaceholder')} {...form.register('title')} />
              {form.formState.errors.title && <span className="field-error">{form.formState.errors.title.message}</span>}
            </label>

            <label className="field-label">
              {t('create.category')}
              <Input list="request-categories" placeholder={t('create.categoryPlaceholder')} {...form.register('category')} />
              <datalist id="request-categories">
                {(appSettings?.categories || []).map((category) => (
                  <option key={category} value={category} />
                ))}
              </datalist>
            </label>
          </div>

          <label className="field-label">
            {t('create.requestDescription')}
            <Textarea placeholder={t('create.requestDescriptionPlaceholder')} {...form.register('description')} />
            {form.formState.errors.description && <span className="field-error">{form.formState.errors.description.message}</span>}
          </label>

          <div className="grid gap-4">
            <label className="field-label">
              {t('create.clientWallet')}
              <div className="flex h-10 items-center rounded-md border border-border bg-gray-50 px-3 text-sm font-medium">
                {address || t('create.connectWalletFirst')}
              </div>
              <span className="field-hint">{t('create.walletHint')}</span>
            </label>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <label className="field-label">
              {t('create.paymentToken')}
              <Select {...form.register('paymentMode')}>
                <option value="MUSDC">MosUSDC</option>
                <option value="ETH">ETH</option>
              </Select>
              <span className={factoryReady ? 'field-hint' : 'field-error'}>{factoryMessage}</span>
              {form.formState.errors.paymentMode && (
                <span className="field-error">{form.formState.errors.paymentMode.message}</span>
              )}
            </label>

            <label className="field-label">
              {t('create.totalAmount')}
              <Input readOnly value={totalAmount} />
              <span className="field-hint">{t('create.totalHint', { symbol })}</span>
            </label>
          </div>

          <div className="grid gap-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold">{t('create.milestones')}</h2>
                <p className="text-sm text-gray-600">{t('create.milestonesHint')}</p>
              </div>
              <Button
                type="button"
                variant="secondary"
                disabled={milestones.fields.length >= maxMilestones}
                onClick={() =>
                  milestones.append({
                    title: 'New milestone',
                    description: '',
                    acceptanceCriteria: '',
                    amount: '0',
                    days: 21,
                  })
                }
              >
                {t('common.add')}
              </Button>
            </div>

            {milestones.fields.map((field, index) => (
              <div key={field.id} className="grid gap-3 rounded-md border border-border p-4">
                <div className="grid gap-3 md:grid-cols-2">
                  <label className="field-label">
                    {t('create.milestoneTitle')}
                    <Input {...form.register(`milestones.${index}.title`)} />
                    {form.formState.errors.milestones?.[index]?.title && (
                      <span className="field-error">{form.formState.errors.milestones[index]?.title?.message}</span>
                    )}
                  </label>
                  <label className="field-label">
                    {t('create.acceptanceCriteria')}
                    <Textarea placeholder={t('create.acceptanceCriteriaPlaceholder')} {...form.register(`milestones.${index}.acceptanceCriteria`)} />
                  </label>
                </div>
                <label className="field-label">
                  {t('create.description')}
                  <Textarea {...form.register(`milestones.${index}.description`)} />
                  {form.formState.errors.milestones?.[index]?.description && (
                    <span className="field-error">{form.formState.errors.milestones[index]?.description?.message}</span>
                  )}
                </label>
                <div className="grid gap-3 md:grid-cols-[1fr_1fr_auto]">
                  <label className="field-label">
                    {t('create.amount')}
                    <Input {...form.register(`milestones.${index}.amount`)} />
                    {form.formState.errors.milestones?.[index]?.amount && (
                      <span className="field-error">{form.formState.errors.milestones[index]?.amount?.message}</span>
                    )}
                  </label>
                  <label className="field-label">
                    {t('create.days')}
                    <Input type="number" min={minDeadlineDays} max={maxDeadlineDays} {...form.register(`milestones.${index}.days`)} />
                    {form.formState.errors.milestones?.[index]?.days && (
                      <span className="field-error">{form.formState.errors.milestones[index]?.days?.message}</span>
                    )}
                  </label>
                  <Button
                    className="self-end"
                    type="button"
                    variant="secondary"
                    disabled={milestones.fields.length === 1}
                    onClick={() => milestones.remove(index)}
                  >
                    {t('common.remove')}
                  </Button>
                </div>
              </div>
            ))}
            {form.formState.errors.milestones?.message && (
              <span className="field-error">{form.formState.errors.milestones.message}</span>
            )}
          </div>

          <Button disabled={!address || isPending || isLoadingFactory} type="submit" size="lg">
            {isPending ? t('create.sending') : t('create.submit')}
          </Button>
        </form>
      </Panel>

      {createdDeal && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/45 px-4" role="dialog" aria-modal="true">
          <div className="w-full max-w-md rounded-md border border-border bg-white p-6 shadow-lg">
            <h2 className="text-xl font-bold">{t('create.depositTitle')}</h2>
            <p className="mt-2 text-sm text-gray-600">
              {t('create.depositText', { amount: totalAmount, symbol: createdDeal.symbol })}
            </p>
            <div className="mt-5 flex flex-wrap gap-2">
              <Button disabled={isPending} onClick={depositNow} type="button">
                {isPending ? t('create.depositing') : t('create.depositNow')}
              </Button>
              <Button disabled={isPending} onClick={depositLater} type="button" variant="secondary">
                {t('create.later')}
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
