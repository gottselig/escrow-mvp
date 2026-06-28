'use client'

import dynamic from 'next/dynamic'

import { I18nProvider } from '@/lib/i18n'

const WalletProviders = dynamic(
  () => import('./wallet-providers').then((mod) => mod.WalletProviders),
  { ssr: false },
)

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <I18nProvider>
      <WalletProviders>{children}</WalletProviders>
    </I18nProvider>
  )
}
