'use client'

import Link from 'next/link'

import { useI18n } from '@/lib/i18n'

export default function Home() {
  const { t } = useI18n()

  return (
    <main>
      <section className="page-shell grid min-h-[calc(100vh-96px)] content-center gap-8 py-16">
        <div className="max-w-3xl">
          <p className="text-sm font-semibold uppercase tracking-wide text-accent">{t('home.eyebrow')}</p>
          <h1 className="mt-3 text-4xl font-bold leading-tight sm:text-5xl">
            {t('home.title')}
          </h1>
          <p className="mt-5 max-w-2xl text-lg text-gray-600">
            {t('home.subtitle')}
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link className="inline-flex h-12 items-center rounded-md bg-primary px-5 font-semibold text-white" href="/create">
              {t('home.create')}
            </Link>
            <Link
              className="inline-flex h-12 items-center rounded-md border border-border bg-white px-5 font-semibold"
              href="/requests"
            >
              {t('home.requests')}
            </Link>
          </div>
        </div>
      </section>
    </main>
  )
}
