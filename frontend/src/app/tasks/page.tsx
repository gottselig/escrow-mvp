'use client'

import { DealCard } from '@/components/DealCard'
import { Button } from '@/components/ui/Button'
import { Panel } from '@/components/ui/Panel'
import { useDeals } from '@/hooks/useDeals'
import { escrowFactoryAddress, ZERO_ADDRESS } from '@/lib/contracts'
import { useI18n } from '@/lib/i18n'

export default function Tasks() {
  const { dealsTaken, isLoading, isError, refetch } = useDeals()
  const { t } = useI18n()

  return (
    <main className="page-shell grid gap-8 py-8">
      <section className="grid gap-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-3xl font-bold">{t('tasks.title')}</h1>
            <p className="mt-1 text-sm text-gray-600">{t('tasks.description')}</p>
          </div>
          <Button variant="secondary" onClick={() => refetch()} type="button">
            {t('common.refresh')}
          </Button>
        </div>

        {escrowFactoryAddress === ZERO_ADDRESS && (
          <Panel>
            <p className="text-sm text-gray-600">{t('tasks.setFactory')}</p>
          </Panel>
        )}

        {isLoading && <Panel>{t('tasks.loading')}</Panel>}

        {isError && (
          <Panel>
            <p className="text-sm text-red-700">{t('tasks.loadError')}</p>
          </Panel>
        )}

        {!isLoading && !isError && escrowFactoryAddress !== ZERO_ADDRESS && (
          <section className="grid gap-3">
            {dealsTaken.length === 0 ? (
              <Panel>
                <p className="text-sm text-gray-600">{t('tasks.empty')}</p>
              </Panel>
            ) : (
              <div className="grid gap-4">
                {dealsTaken.map((deal) => (
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
