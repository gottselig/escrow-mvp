'use client'

import { useEffect, useMemo, useState } from 'react'
import { keccak256, stringToBytes } from 'viem'
import { useAccount, useReadContract, useSignMessage } from 'wagmi'
import { sepolia } from 'wagmi/chains'
import { toast } from 'sonner'

import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Panel } from '@/components/ui/Panel'
import { Textarea } from '@/components/ui/Textarea'
import { useSettings } from '@/hooks/useSettings'
import { type AppSettings, type CmsPage, type CmsPageAccess, type SiteSettings, pagesApi, settingsApi } from '@/lib/api'
import { escrowFactoryAbi, escrowFactoryAddress, ZERO_ADDRESS } from '@/lib/contracts'
import { useI18n } from '@/lib/i18n'
import { shortAddress } from '@/lib/utils'

const emptySite: SiteSettings = {
  siteName: '',
  seoTitle: '',
  seoDescription: '',
  faviconUrl: '',
  logoText: '',
  primaryColor: '',
  accentColor: '',
}

const emptyApp: AppSettings = {
  categories: [],
  maxMilestones: 8,
  minDeadlineDays: 1,
  maxDeadlineDays: 90,
  maintenanceMode: false,
}

export default function AdminPage() {
  const { address } = useAccount()
  const { signMessageAsync, isPending } = useSignMessage()
  const { data: settings, isLoading, refetch } = useSettings()
  const { t } = useI18n()
  const [site, setSite] = useState<SiteSettings>(emptySite)
  const [app, setApp] = useState<AppSettings>(emptyApp)
  const [pages, setPages] = useState<CmsPage[]>([])
  const [pageSlug, setPageSlug] = useState('')
  const [pageTitle, setPageTitle] = useState('')
  const [pageContent, setPageContent] = useState('')
  const [pageAccess, setPageAccess] = useState<CmsPageAccess>('PUBLIC')
  const [pagePublished, setPagePublished] = useState(true)
  const [saving, setSaving] = useState<'site' | 'app' | null>(null)
  const [savingPage, setSavingPage] = useState(false)

  const owner = useReadContract({
    address: escrowFactoryAddress,
    abi: escrowFactoryAbi,
    functionName: 'owner',
    chainId: sepolia.id,
    query: { enabled: escrowFactoryAddress !== ZERO_ADDRESS },
  })

  const isOwner = Boolean(address && owner.data && address.toLowerCase() === owner.data.toLowerCase())
  const pending = isPending || Boolean(saving) || savingPage

  useEffect(() => {
    if (!settings) return
    setSite(settings.site)
    setApp(settings.app)
  }, [settings])

  const categoriesText = useMemo(() => app.categories.join('\n'), [app.categories])

  async function loadPages() {
    const response = await pagesApi.list()
    if (response.success && response.data) setPages(response.data)
  }

  useEffect(() => {
    void loadPages()
  }, [])

  async function save(scope: 'site' | 'app') {
    if (!address) return
    const data = scope === 'site' ? site : app
    const dataHash = keccak256(stringToBytes(JSON.stringify(data)))
    const timestamp = Date.now()
    const message = `Escrow MVP admin settings update\nScope: ${scope}\nAddress: ${address}\nData hash: ${dataHash}\nTimestamp: ${timestamp}`

    setSaving(scope)
    try {
      const signature = await signMessageAsync({ message })
      const response = await settingsApi.update(scope, {
        data,
        address,
        message,
        signature,
        dataHash,
      })

      if (!response.success) {
        throw new Error(response.error || 'Could not save settings')
      }

      await refetch()
      toast.success(t('admin.saved'))
    } finally {
      setSaving(null)
    }
  }

  async function savePage() {
    if (!address || !pageSlug) return
    const data = {
      title: pageTitle,
      content: pageContent,
      access: pageAccess,
      published: pagePublished,
    }
    const dataHash = keccak256(stringToBytes(JSON.stringify(data)))
    const timestamp = Date.now()
    const scope = `page:${pageSlug}`
    const message = `Escrow MVP admin settings update\nScope: ${scope}\nAddress: ${address}\nData hash: ${dataHash}\nTimestamp: ${timestamp}`

    setSavingPage(true)
    try {
      const signature = await signMessageAsync({ message })
      const response = await pagesApi.save(pageSlug, {
        data,
        address,
        message,
        signature,
        dataHash,
      })

      if (!response.success) {
        throw new Error(response.error || 'Could not save page')
      }

      await loadPages()
      toast.success(t('admin.pageSaved'))
    } finally {
      setSavingPage(false)
    }
  }

  function editPage(page: CmsPage) {
    setPageSlug(page.slug)
    setPageTitle(page.title)
    setPageContent(page.content)
    setPageAccess(page.access)
    setPagePublished(page.published)
  }

  return (
    <main className="page-shell grid gap-6 py-8">
      <section className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold">{t('admin.title')}</h1>
          <p className="mt-1 max-w-2xl text-sm text-gray-600">{t('admin.subtitle')}</p>
        </div>
        <Button disabled={isLoading} onClick={() => refetch()} type="button" variant="secondary">
          {t('common.refresh')}
        </Button>
      </section>

      {!isOwner && (
        <Panel>
          <h2 className="text-xl font-bold">{t('admin.ownerRequired')}</h2>
          <p className="mt-2 text-sm text-gray-600">
            Connected wallet: {shortAddress(address)}. Factory owner: {shortAddress(owner.data)}.
          </p>
        </Panel>
      )}

      {isOwner && (
        <div className="grid gap-6 lg:grid-cols-2">
          <Panel className="grid gap-4">
            <div>
              <h2 className="text-xl font-bold">{t('admin.siteTitle')}</h2>
              <p className="mt-1 text-sm text-gray-600">{t('admin.siteDescription')}</p>
            </div>

            <TextField label={t('admin.siteName')} value={site.siteName} onChange={(value) => setSite({ ...site, siteName: value })} />
            <TextField label={t('admin.seoTitle')} value={site.seoTitle} onChange={(value) => setSite({ ...site, seoTitle: value })} />
            <label className="field-label">
              {t('admin.seoDescription')}
              <Textarea value={site.seoDescription} onChange={(event) => setSite({ ...site, seoDescription: event.target.value })} />
            </label>
            <TextField label={t('admin.faviconUrl')} value={site.faviconUrl} onChange={(value) => setSite({ ...site, faviconUrl: value })} />
            <TextField label={t('admin.logoText')} value={site.logoText} onChange={(value) => setSite({ ...site, logoText: value })} />
            <div className="grid gap-3 md:grid-cols-2">
              <TextField label={t('admin.primaryColor')} value={site.primaryColor} onChange={(value) => setSite({ ...site, primaryColor: value })} />
              <TextField label={t('admin.accentColor')} value={site.accentColor} onChange={(value) => setSite({ ...site, accentColor: value })} />
            </div>
            <Button disabled={pending} onClick={() => void save('site')} type="button">
              {saving === 'site' ? t('admin.sign') : t('common.save')}
            </Button>
          </Panel>

          <Panel className="grid gap-4">
            <div>
              <h2 className="text-xl font-bold">{t('admin.appTitle')}</h2>
              <p className="mt-1 text-sm text-gray-600">{t('admin.appDescription')}</p>
            </div>

            <label className="field-label">
              {t('admin.categories')}
              <Textarea
                value={categoriesText}
                onChange={(event) =>
                  setApp({
                    ...app,
                    categories: event.target.value
                      .split('\n')
                      .map((category) => category.trim())
                      .filter(Boolean),
                  })
                }
              />
              <span className="field-hint">{t('admin.categoriesHint')}</span>
            </label>

            <div className="grid gap-3 md:grid-cols-3">
              <NumberField label={t('admin.maxMilestones')} value={app.maxMilestones} onChange={(value) => setApp({ ...app, maxMilestones: value })} />
              <NumberField label={t('admin.minDeadlineDays')} value={app.minDeadlineDays} onChange={(value) => setApp({ ...app, minDeadlineDays: value })} />
              <NumberField label={t('admin.maxDeadlineDays')} value={app.maxDeadlineDays} onChange={(value) => setApp({ ...app, maxDeadlineDays: value })} />
            </div>

            <label className="flex items-center gap-2 text-sm font-semibold">
              <input
                checked={app.maintenanceMode}
                className="h-4 w-4"
                onChange={(event) => setApp({ ...app, maintenanceMode: event.target.checked })}
                type="checkbox"
              />
              {t('admin.maintenanceMode')}
            </label>

            <Button disabled={pending} onClick={() => void save('app')} type="button">
              {saving === 'app' ? t('admin.sign') : t('common.save')}
            </Button>
          </Panel>

          <Panel className="grid gap-4 lg:col-span-2">
            <div>
              <h2 className="text-xl font-bold">{t('admin.pagesTitle')}</h2>
              <p className="mt-1 text-sm text-gray-600">{t('admin.pagesDescription')}</p>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <TextField label={t('admin.pageSlug')} value={pageSlug} onChange={setPageSlug} />
              <TextField label={t('admin.pageTitle')} value={pageTitle} onChange={setPageTitle} />
            </div>

            <label className="field-label">
              {t('admin.pageContent')}
              <Textarea className="min-h-48" value={pageContent} onChange={(event) => setPageContent(event.target.value)} />
            </label>

            <div className="grid gap-3 md:grid-cols-[1fr_auto] md:items-end">
              <label className="field-label">
                {t('admin.pageAccess')}
                <select
                  className="h-10 rounded-md border border-border bg-white px-3 text-sm"
                  value={pageAccess}
                  onChange={(event) => setPageAccess(event.target.value as CmsPageAccess)}
                >
                  <option value="PUBLIC">{t('admin.pagePublic')}</option>
                  <option value="AUTHENTICATED">{t('admin.pageAuthenticated')}</option>
                </select>
              </label>

              <label className="flex h-10 items-center gap-2 text-sm font-semibold">
                <input
                  checked={pagePublished}
                  className="h-4 w-4"
                  onChange={(event) => setPagePublished(event.target.checked)}
                  type="checkbox"
                />
                {t('admin.pagePublished')}
              </label>
            </div>

            <Button disabled={pending || !pageSlug || !pageTitle} onClick={() => void savePage()} type="button">
              {savingPage ? t('admin.sign') : t('admin.pageSave')}
            </Button>

            <div className="grid gap-3">
              <h3 className="font-semibold">{t('admin.existingPages')}</h3>
              {pages.length === 0 ? (
                <p className="text-sm text-gray-600">{t('admin.noPages')}</p>
              ) : (
                <div className="grid gap-2">
                  {pages.map((page) => (
                    <button
                      key={page.id}
                      className="flex items-center justify-between rounded-md border border-border px-3 py-2 text-left text-sm hover:bg-muted"
                      onClick={() => editPage(page)}
                      type="button"
                    >
                      <span>
                        <span className="font-semibold">{page.title}</span>
                        <span className="ml-2 text-gray-500">/pages/{page.slug}</span>
                      </span>
                      <span className="text-xs uppercase text-gray-500">{page.access}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </Panel>
        </div>
      )}
    </main>
  )
}

function TextField({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <label className="field-label">
      {label}
      <Input value={value} onChange={(event) => onChange(event.target.value)} />
    </label>
  )
}

function NumberField({ label, value, onChange }: { label: string; value: number; onChange: (value: number) => void }) {
  return (
    <label className="field-label">
      {label}
      <Input min={1} type="number" value={value} onChange={(event) => onChange(Number(event.target.value))} />
    </label>
  )
}
