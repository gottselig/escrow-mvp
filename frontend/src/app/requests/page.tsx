'use client'

import Link from 'next/link'

import { DealCard } from '@/components/DealCard'
import { Button } from '@/components/ui/Button'
import { Panel } from '@/components/ui/Panel'
import { useDeals } from '@/hooks/useDeals'
import { escrowFactoryAddress, ZERO_ADDRESS } from '@/lib/contracts'
import { useI18n } from '@/lib/i18n'

export default function Requests() {
  const { requests, isLoading, isError, refetch } = useDeals()
  const { t } = useI18n()

  return (
    <main className="page-shell grid gap-8 py-8">
      <section className="grid gap-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-3xl font-bold">{t('requests.title')}</h1>
            <p className="mt-1 text-sm text-gray-600">{t('requests.newDescription')}</p>
          </div>
          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => refetch()} type="button">
              {t('common.refresh')}
            </Button>
            <Link className="inline-flex h-10 items-center rounded-md bg-primary px-4 text-sm font-semibold text-white" href="/create">
              {t('create.submit')}
            </Link>
          </div>
        </div>

        {escrowFactoryAddress === ZERO_ADDRESS && (
          <Panel>
            <p className="text-sm text-gray-600">{t('requests.setFactory')}</p>
          </Panel>
        )}

        {isLoading && <Panel>{t('requests.loading')}</Panel>}

        {isError && (
          <Panel>
            <p className="text-sm text-red-700">{t('requests.loadError')}</p>
          </Panel>
        )}

        {!isLoading && !isError && escrowFactoryAddress !== ZERO_ADDRESS && (
          <section className="grid gap-3">
            {requests.length === 0 ? (
              <Panel>
                <p className="text-sm text-gray-600">{t('requests.empty')}</p>
              </Panel>
            ) : (
              <div className="grid gap-4">
                {requests.map((deal) => (
                  <DealCard key={deal.escrow} deal={deal} />
                ))}
              </div>
            )}
          </section>
        )}
      </section>
    </main>
  )
}
