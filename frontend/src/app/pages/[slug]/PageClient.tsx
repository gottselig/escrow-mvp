'use client'

import { useQuery } from '@tanstack/react-query'
import { useAccount } from 'wagmi'

import { Panel } from '@/components/ui/Panel'
import { pagesApi } from '@/lib/api'
import { useI18n } from '@/lib/i18n'

export function PageClient({ slug }: { slug: string }) {
  const { address } = useAccount()
  const { t } = useI18n()
  const pageQuery = useQuery({
    queryKey: ['page', slug],
    queryFn: async () => {
      const response = await pagesApi.get(slug)
      if (!response.success || !response.data) throw new Error(response.error || 'Page not found')
      return response.data
    },
  })

  if (pageQuery.isLoading) {
    return (
      <main className="page-shell py-8">
        <Panel>{t('common.loading')}</Panel>
      </main>
    )
  }

  if (!pageQuery.data) {
    return (
      <main className="page-shell py-8">
        <Panel>
          <h1 className="text-xl font-bold">{t('page.notFound')}</h1>
        </Panel>
      </main>
    )
  }

  if (pageQuery.data.access === 'AUTHENTICATED' && !address) {
    return (
      <main className="page-shell py-8">
        <Panel>
          <h1 className="text-xl font-bold">{pageQuery.data.title}</h1>
          <p className="mt-2 text-sm text-gray-600">{t('page.authRequired')}</p>
        </Panel>
      </main>
    )
  }

  return (
    <main className="page-shell py-8">
      <article className="mx-auto grid max-w-3xl gap-5">
        <h1 className="text-3xl font-bold">{pageQuery.data.title}</h1>
        <div className="whitespace-pre-wrap rounded-md border border-border bg-white p-5 text-sm leading-7 text-gray-700">
          {pageQuery.data.content}
        </div>
      </article>
    </main>
  )
}
