import { ethers } from 'ethers'

import { config } from '../config/env'
import { SettingsRepository } from '../repositories/settings.repository'

const repository = new SettingsRepository()

export const SETTINGS_SCOPES = ['site', 'app'] as const
export type SettingsScope = (typeof SETTINGS_SCOPES)[number]

export type SiteSettings = {
  siteName: string
  seoTitle: string
  seoDescription: string
  faviconUrl: string
  logoText: string
  primaryColor: string
  accentColor: string
}

export type AppSettings = {
  categories: string[]
  maxMilestones: number
  minDeadlineDays: number
  maxDeadlineDays: number
  maintenanceMode: boolean
}

const defaultSettings: { site: SiteSettings; app: AppSettings } = {
  site: {
    siteName: 'Escrow MVP',
    seoTitle: 'Escrow MVP',
    seoDescription: 'Escrow deals with ETH or MosUSDC payments',
    faviconUrl: '/favicon.ico',
    logoText: 'Escrow MVP',
    primaryColor: '#2563eb',
    accentColor: '#16a34a',
  },
  app: {
    categories: ['Design', 'Development', 'Consulting'],
    maxMilestones: 8,
    minDeadlineDays: 1,
    maxDeadlineDays: 90,
    maintenanceMode: false,
  },
}

const ownerAbi = ['function owner() view returns (address)']

function isScope(value: string): value is SettingsScope {
  return SETTINGS_SCOPES.includes(value as SettingsScope)
}

function normalizeAddress(value?: string) {
  return value?.toLowerCase()
}

function envAdminWallets() {
  return (process.env.SITE_ADMIN_WALLETS || '')
    .split(',')
    .map((wallet) => wallet.trim().toLowerCase())
    .filter(Boolean)
}

export class SettingsService {
  private provider = new ethers.JsonRpcProvider(config.rpcUrl)

  async getAll() {
    const records = await repository.getMany([...SETTINGS_SCOPES])
    const byKey = new Map(records.map((record) => [record.key, record.data]))

    return {
      site: { ...defaultSettings.site, ...(byKey.get('site') as Partial<SiteSettings> | undefined) },
      app: { ...defaultSettings.app, ...(byKey.get('app') as Partial<AppSettings> | undefined) },
    }
  }

  async get(scope: SettingsScope) {
    const all = await this.getAll()
    return all[scope]
  }

  async update(scope: string, data: unknown) {
    if (!isScope(scope)) {
      throw new Error('Invalid settings scope')
    }

    const normalized = this.normalize(scope, data)
    const record = await repository.upsert(scope, normalized)
    return { key: record.key, data: record.data, updatedAt: record.updatedAt.toISOString() }
  }

  async verifyAdminSignature(input: {
    address?: string
    message?: string
    signature?: string
    dataHash?: string
    scope?: string
  }) {
    if (!input.address || !input.message || !input.signature || !input.dataHash || !input.scope) {
      return false
    }

    const recovered = ethers.verifyMessage(input.message, input.signature)
    if (normalizeAddress(recovered) !== normalizeAddress(input.address)) {
      return false
    }

    const expectedPrefix = `Escrow MVP admin settings update\nScope: ${input.scope}\nAddress: ${input.address}\nData hash: ${input.dataHash}\nTimestamp: `
    if (!input.message.startsWith(expectedPrefix)) {
      return false
    }

    const timestamp = Number(input.message.slice(expectedPrefix.length))
    if (!Number.isFinite(timestamp) || Math.abs(Date.now() - timestamp) > 5 * 60 * 1000) {
      return false
    }

    return this.isAdmin(input.address)
  }

  hashData(data: unknown) {
    return ethers.keccak256(ethers.toUtf8Bytes(JSON.stringify(data)))
  }

  private normalize(scope: SettingsScope, data: unknown) {
    const source = typeof data === 'object' && data !== null ? (data as Record<string, unknown>) : {}

    if (scope === 'site') {
      return {
        ...defaultSettings.site,
        siteName: this.stringValue(source.siteName, defaultSettings.site.siteName),
        seoTitle: this.stringValue(source.seoTitle, defaultSettings.site.seoTitle),
        seoDescription: this.stringValue(source.seoDescription, defaultSettings.site.seoDescription),
        faviconUrl: this.stringValue(source.faviconUrl, defaultSettings.site.faviconUrl),
        logoText: this.stringValue(source.logoText, defaultSettings.site.logoText),
        primaryColor: this.stringValue(source.primaryColor, defaultSettings.site.primaryColor),
        accentColor: this.stringValue(source.accentColor, defaultSettings.site.accentColor),
      }
    }

    return {
      ...defaultSettings.app,
      categories: Array.isArray(source.categories)
        ? source.categories.map((item) => String(item).trim()).filter(Boolean)
        : defaultSettings.app.categories,
      maxMilestones: this.numberValue(source.maxMilestones, defaultSettings.app.maxMilestones, 1, 50),
      minDeadlineDays: this.numberValue(source.minDeadlineDays, defaultSettings.app.minDeadlineDays, 1, 365),
      maxDeadlineDays: this.numberValue(source.maxDeadlineDays, defaultSettings.app.maxDeadlineDays, 1, 3650),
      maintenanceMode: Boolean(source.maintenanceMode),
    }
  }

  private stringValue(value: unknown, fallback: string) {
    const text = typeof value === 'string' ? value.trim() : ''
    return text || fallback
  }

  private numberValue(value: unknown, fallback: number, min: number, max: number) {
    const number = Number(value)
    if (!Number.isFinite(number)) return fallback
    return Math.min(max, Math.max(min, Math.floor(number)))
  }

  private async isAdmin(address: string) {
    const normalizedAddress = normalizeAddress(address)
    if (!normalizedAddress) return false

    const adminWallets = envAdminWallets()
    if (adminWallets.includes(normalizedAddress)) return true

    const factoryAddress = process.env.ESCROW_FACTORY_ADDRESS || process.env.NEXT_PUBLIC_ESCROW_FACTORY_ADDRESS
    if (!factoryAddress || !ethers.isAddress(factoryAddress)) return false

    const contract = new ethers.Contract(factoryAddress, ownerAbi, this.provider)
    const owner = await contract.owner()
    return normalizeAddress(owner) === normalizedAddress
  }
}
