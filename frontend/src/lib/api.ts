// API client configuration and utilities for backend communication

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api'

export interface DealSummaryApiDto {
  id: string
  escrowAddress: string
  client: string
  contractor: string
  token: string
  totalAmount: string
  fundedAmount: string
  status: number | string
  metadataURI: string | null
  createdAt: string
}

export interface MilestoneApiDto {
  id: string
  milestoneIndex: number
  amount: string
  grossAmount: string | null
  feeAmount: string | null
  netAmount: string | null
  deadline: string
  status: number | string
  descriptionURI: string | null
  resultURI: string | null
  submittedAt: string | null
  approvedAt: string | null
}

export interface DisputeApiDto {
  id: string
  openedBy: string
  reasonURI: string | null
  status: string
  resolutionType: string | null
  clientAmount: string | null
  contractorAmount: string | null
  openedAt: string
  resolvedAt: string | null
}

export interface DealApiDto extends DealSummaryApiDto {
  factoryAddress: string
  arbiter: string
  treasury: string
  token: string
  releasedAmount: string
  feeBps: number
  disputeReasonURI: string | null
  milestones: MilestoneApiDto[]
  disputes: DisputeApiDto[]
  updatedAt: string
}

export interface ApiResponse<T> {
  success: boolean
  data?: T
  error?: string
}

export interface ApiListResponse<T> {
  success: boolean
  data: T[]
  total: number
  offset: number
  limit: number
}

export interface MetadataRecordDto {
  id: string
  type: string
  uri: string
  data: any
  createdAt: string
  updatedAt: string
}

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

export type RuntimeSettings = {
  site: SiteSettings
  app: AppSettings
}

export type CmsPageAccess = 'PUBLIC' | 'AUTHENTICATED'

export type CmsPage = {
  id: string
  slug: string
  title: string
  content: string
  access: CmsPageAccess
  published: boolean
  createdAt: string
  updatedAt: string
}

export const metadataApi = {
  create: async (type: string, data: any): Promise<ApiResponse<MetadataRecordDto>> => {
    const response = await fetch(`${API_BASE_URL}/metadata`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type, data }),
    })
    if (!response.ok) throw new Error('Failed to create metadata')
    return response.json()
  },

  get: async (uri: string): Promise<ApiResponse<MetadataRecordDto>> => {
    const id = uri.startsWith('metadata://') ? uri.slice('metadata://'.length) : uri
    const response = await fetch(`${API_BASE_URL}/metadata/${encodeURIComponent(id)}`)
    if (!response.ok) throw new Error('Failed to fetch metadata')
    return response.json()
  },
}

export const settingsApi = {
  get: async (): Promise<ApiResponse<RuntimeSettings>> => {
    const response = await fetch(`${API_BASE_URL}/settings`)
    if (!response.ok) throw new Error('Failed to fetch settings')
    return response.json()
  },

  update: async (
    scope: 'site' | 'app',
    payload: {
      data: SiteSettings | AppSettings
      address: string
      message: string
      signature: string
      dataHash: string
    },
  ): Promise<ApiResponse<{ key: string; data: SiteSettings | AppSettings; updatedAt: string }>> => {
    const response = await fetch(`${API_BASE_URL}/settings/${scope}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    if (!response.ok) throw new Error('Failed to update settings')
    return response.json()
  },
}

export const pagesApi = {
  list: async (): Promise<ApiResponse<CmsPage[]>> => {
    const response = await fetch(`${API_BASE_URL}/pages`)
    if (!response.ok) throw new Error('Failed to fetch pages')
    return response.json()
  },

  get: async (slug: string): Promise<ApiResponse<CmsPage>> => {
    const response = await fetch(`${API_BASE_URL}/pages/${encodeURIComponent(slug)}`)
    if (!response.ok) throw new Error('Failed to fetch page')
    return response.json()
  },

  save: async (
    slug: string,
    payload: {
      data: Pick<CmsPage, 'title' | 'content' | 'access' | 'published'>
      address: string
      message: string
      signature: string
      dataHash: string
    },
  ): Promise<ApiResponse<CmsPage>> => {
    const response = await fetch(`${API_BASE_URL}/pages/${encodeURIComponent(slug)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    if (!response.ok) throw new Error('Failed to save page')
    return response.json()
  },
}

// Deal API endpoints
export const dealsApi = {
  /**
   * Get all deals with pagination and optional filters
   */
  getAll: async (
    limit: number = 50,
    offset: number = 0,
    filters?: { status?: string; client?: string; contractor?: string }
  ): Promise<ApiListResponse<DealSummaryApiDto>> => {
    const params = new URLSearchParams({
      limit: limit.toString(),
      offset: offset.toString(),
    })

    if (filters?.status) params.append('status', filters.status)
    if (filters?.client) params.append('client', filters.client)
    if (filters?.contractor) params.append('contractor', filters.contractor)

    const response = await fetch(`${API_BASE_URL}/deals?${params.toString()}`)
    if (!response.ok) throw new Error('Failed to fetch deals')
    return response.json()
  },

  /**
   * Get a specific deal by escrow address
   */
  getByAddress: async (escrowAddress: string): Promise<ApiResponse<DealApiDto>> => {
    const response = await fetch(`${API_BASE_URL}/deals/${escrowAddress}`)
    if (!response.ok) throw new Error('Failed to fetch deal')
    return response.json()
  },

  /**
   * Get all deals for a client
   */
  getByClient: async (
    clientAddress: string,
    limit: number = 50,
    offset: number = 0,
  ): Promise<ApiListResponse<DealSummaryApiDto>> => {
    const params = new URLSearchParams({
      limit: limit.toString(),
      offset: offset.toString(),
    })
    const response = await fetch(`${API_BASE_URL}/deals/client/${clientAddress}?${params.toString()}`)
    if (!response.ok) throw new Error('Failed to fetch client deals')
    return response.json()
  },

  /**
   * Get all deals for a contractor
   */
  getByContractor: async (
    contractorAddress: string,
    limit: number = 50,
    offset: number = 0,
  ): Promise<ApiListResponse<DealSummaryApiDto>> => {
    const params = new URLSearchParams({
      limit: limit.toString(),
      offset: offset.toString(),
    })
    const response = await fetch(`${API_BASE_URL}/deals/contractor/${contractorAddress}?${params.toString()}`)
    if (!response.ok) throw new Error('Failed to fetch contractor deals')
    return response.json()
  },

  /**
   * Create a new deal (usually called by indexer, but exposed for manual testing)
   */
  create: async (dealData: {
    escrowAddress: string
    factoryAddress: string
    client?: string
    contractor?: string
    arbiter?: string
    treasury?: string
    token?: string
    totalAmount?: string
    feeBps?: number
    metadataURI?: string
    verifyOnChain?: boolean
    txHash?: string
    blockNumber?: number
  }): Promise<ApiResponse<any>> => {
    const response = await fetch(`${API_BASE_URL}/deals`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(dealData),
    })
    if (!response.ok) throw new Error('Failed to create deal')
    return response.json()
  },

  /**
   * Get milestones for a deal by escrow address
   */
  getMilestones: async (escrowAddress: string): Promise<ApiResponse<MilestoneApiDto[]>> => {
    const response = await fetch(`${API_BASE_URL}/deals/${escrowAddress}/milestones`)
    if (!response.ok) throw new Error('Failed to fetch milestones')
    return response.json()
  },

  /**
   * Get disputes for a deal by escrow address
   */
  getDisputesByEscrow: async (escrowAddress: string): Promise<ApiResponse<DisputeApiDto[]>> => {
    const response = await fetch(`${API_BASE_URL}/deals/${escrowAddress}/disputes`)
    if (!response.ok) throw new Error('Failed to fetch deal disputes')
    return response.json()
  },
}

// Disputes API endpoints
export const disputesApi = {
  /**
   * Get all disputes with pagination
   */
  getAll: async (limit: number = 50, offset: number = 0): Promise<ApiListResponse<any>> => {
    const params = new URLSearchParams({
      limit: limit.toString(),
      offset: offset.toString(),
    })
    const response = await fetch(`${API_BASE_URL}/disputes?${params.toString()}`)
    if (!response.ok) throw new Error('Failed to fetch disputes')
    return response.json()
  },

  /**
   * Get active (unresolved) disputes
   */
  getActive: async (limit: number = 50, offset: number = 0): Promise<ApiListResponse<any>> => {
    const params = new URLSearchParams({
      limit: limit.toString(),
      offset: offset.toString(),
    })
    const response = await fetch(`${API_BASE_URL}/disputes/active?${params.toString()}`)
    if (!response.ok) throw new Error('Failed to fetch active disputes')
    return response.json()
  },

  /**
   * Get disputes for a specific deal
   */
  getByDeal: async (dealId: string): Promise<ApiResponse<any[]>> => {
    const response = await fetch(`${API_BASE_URL}/disputes/deal/${dealId}`)
    if (!response.ok) throw new Error('Failed to fetch deal disputes')
    return response.json()
  },

  /**
   * Get a specific dispute by ID
   */
  getById: async (disputeId: string): Promise<ApiResponse<any>> => {
    const response = await fetch(`${API_BASE_URL}/disputes/${disputeId}`)
    if (!response.ok) throw new Error('Failed to fetch dispute')
    return response.json()
  },

  /**
   * Open/create a new dispute
   */
  create: async (disputeData: {
    dealId: string
    openedBy: string
    reasonURI?: string
    blockNumber?: number
    txHash?: string
  }): Promise<ApiResponse<any>> => {
    const response = await fetch(`${API_BASE_URL}/disputes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(disputeData),
    })
    if (!response.ok) throw new Error('Failed to create dispute')
    return response.json()
  },
}

// Health check
export const healthApi = {
  check: async (): Promise<ApiResponse<any>> => {
    const response = await fetch(`${API_BASE_URL}/health`)
    if (!response.ok) throw new Error('Health check failed')
    return response.json()
  },
}
