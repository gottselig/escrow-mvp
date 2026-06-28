// API type definitions

// Corresponds to Prisma DealStatus enum
export enum DealStatusValue {
  Created = 0,
  Accepted = 1,
  Funded = 2,
  InProgress = 3,
  Disputed = 4,
  Resolved = 5,
  Completed = 6,
  Cancelled = 7,
}

export enum MilestoneStatusValue {
  Pending = 0,
  Submitted = 1,
  Approved = 2,
  Refunded = 3,
}

export enum DisputeResolutionType {
  ToClient = 'ToClient',
  ToContractor = 'ToContractor',
  Split = 'Split',
}

// Milestone API response
export interface MilestoneDto {
  id: string
  milestoneIndex: number
  amount: string
  grossAmount: string | null
  feeAmount: string | null
  netAmount: string | null
  deadline: string // ISO timestamp
  status: MilestoneStatusValue
  descriptionURI: string | null
  resultURI: string | null
  submittedAt: string | null
  approvedAt: string | null
}

// Dispute API response
export interface DisputeDto {
  id: string
  openedBy: string
  reasonURI: string | null
  status: string // "Open" or "Resolved"
  resolutionType: DisputeResolutionType | null
  clientAmount: string | null
  contractorAmount: string | null
  openedAt: string
  resolvedAt: string | null
}

// Deal API response (full)
export interface DealDto {
  id: string
  escrowAddress: string
  factoryAddress: string
  client: string
  contractor: string
  arbiter: string
  treasury: string
  token: string
  totalAmount: string
  fundedAmount: string
  releasedAmount: string
  feeBps: number
  status: DealStatusValue
  metadataURI: string | null
  disputeReasonURI: string | null
  milestones: MilestoneDto[]
  disputes: DisputeDto[]
  createdAt: string
  updatedAt: string
}

// Deal API response (summary for list)
export interface DealSummaryDto {
  id: string
  escrowAddress: string
  client: string
  contractor: string
  token: string
  totalAmount: string
  fundedAmount: string
  status: DealStatusValue
  metadataURI: string | null
  createdAt: string
}

// Request DTOs

export interface CreateDealRequest {
  escrowAddress: string
  factoryAddress: string
  client: string
  contractor: string
  arbiter: string
  treasury: string
  token: string
  totalAmount: string
  feeBps: number
  metadataURI?: string
  milestones?: CreateMilestoneRequest[]
}

export interface CreateMilestoneRequest {
  amount: string
  deadline: string // ISO timestamp
  descriptionURI?: string
}

export interface SubmitMilestoneRequest {
  resultURI: string
}

export interface ApproveMilestoneRequest {
  milestoneId: string
}

export interface OpenDisputeRequest {
  reasonURI?: string
}

export interface ResolveDisputeRequest {
  clientAmount?: string
  contractorAmount?: string
}

// Response wrappers

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
