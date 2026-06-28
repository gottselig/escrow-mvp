'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useAccount, useReadContract } from 'wagmi'
import { sepolia } from 'wagmi/chains'

import { ConnectWalletButton } from '@/components/ConnectWalletButton'
import { useSettings } from '@/hooks/useSettings'
import { useI18n } from '@/lib/i18n'
import { escrowFactoryAbi, escrowFactoryAddress, ZERO_ADDRESS } from '@/lib/contracts'
import { cn } from '@/lib/utils'

type NavLink = {
  href: string
  labelKey: 'nav.requests' | 'nav.deals' | 'nav.tasks' | 'nav.owner' | 'nav.admin'
  authOnly?: boolean
  ownerOnly?: boolean
}

const links: NavLink[] = [
  { href: '/requests', labelKey: 'nav.requests', authOnly: true },
  { href: '/deals', labelKey: 'nav.deals', authOnly: true },
  { href: '/tasks', labelKey: 'nav.tasks', authOnly: true },
  { href: '/owner', labelKey: 'nav.owner', ownerOnly: true },
  { href: '/admin', labelKey: 'nav.admin', ownerOnly: true },
]

export function AppNav() {
  const pathname = usePathname()
  const { address } = useAccount()
  const { locale, setLocale, t } = useI18n()
  const settings = useSettings()
  const owner = useReadContract({
    address: escrowFactoryAddress,
    abi: escrowFactoryAbi,
    functionName: 'owner',
    chainId: sepolia.id,
    query: {
      enabled: escrowFactoryAddress !== ZERO_ADDRESS,
    },
  })

  const isOwner = Boolean(address && owner.data && address.toLowerCase() === owner.data.toLowerCase())
  const visibleLinks = links.filter((link) => {
    if (link.ownerOnly) return isOwner
    if (link.authOnly) return Boolean(address)
    return true
  })

  return (
    <header className="border-b border-border bg-white">
      <div className="page-shell flex flex-wrap items-center justify-between gap-4 py-4">
        <Link
          className="cursor-pointer rounded-md text-lg font-bold text-primary transition-colors hover:text-accent focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent"
          href="/"
        >
          {settings.data?.site.logoText || 'Escrow MVP'}
        </Link>

        {visibleLinks.length > 0 && (
          <nav aria-label="Main navigation" className="flex flex-wrap items-center gap-1 rounded-md border border-border bg-muted/50 p-1">
            {visibleLinks.map((link) => {
              const isActive = pathname.startsWith(link.href)

              return (
                <Link
                  key={link.href}
                  aria-current={isActive ? 'page' : undefined}
                  className={cn(
                    'cursor-pointer rounded-md px-3 py-2 text-sm font-semibold text-gray-600 transition-colors',
                    'hover:bg-white hover:text-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent',
                    isActive && 'bg-white text-foreground shadow-sm',
                  )}
                  href={link.href}
                >
                  {t(link.labelKey)}
                </Link>
              )
            })}
          </nav>
        )}

        <div className="flex items-center gap-2">
          <div className="flex rounded-md border border-border bg-muted/50 p-1" aria-label={t('nav.language')}>
            {(['ru', 'en'] as const).map((item) => (
              <button
                key={item}
                type="button"
                className={cn(
                  'rounded px-2 py-1 text-xs font-semibold uppercase text-gray-600 transition-colors',
                  locale === item && 'bg-white text-foreground shadow-sm',
                )}
                onClick={() => setLocale(item)}
              >
                {item}
              </button>
            ))}
          </div>
          <ConnectWalletButton />
        </div>
      </div>
    </header>
  )
}
