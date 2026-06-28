import type { Address } from 'viem'

export type PaymentMode = 'ETH' | 'MUSDC'

export type DealStatus =
  | 'Created'
  | 'Accepted'
  | 'Funded'
  | 'In Progress'
  | 'Disputed'
  | 'Resolved'
  | 'Completed'
  | 'Cancelled'

export type MilestoneStatus = 'Pending' | 'Submitted' | 'Approved' | 'Refunded'

export type MilestoneInput = {
  amount: bigint
  deadline: bigint
  descriptionURI: string
}

export type Milestone = {
  id: number
  amount: bigint
  deadline: bigint
  status: number
  descriptionURI: string
  resultURI: string
}

export type DealSummary = {
  address: Address
  client: Address
  contractor: Address
  arbiter: Address
  token: Address
  treasury: Address
  totalAmount: bigint
  fundedAmount: bigint
  releasedAmount: bigint
  feeBps: number
  status: number
  metadataURI: string
  disputeReasonURI: string
  remainingBalance: bigint
  isNativePayment: boolean
  currentMilestoneId: bigint
}

export type DealCreatedEvent = {
  escrow: Address
  client: Address
  contractor: Address
  arbiter: Address
  token: Address
  totalAmount: bigint
  fundedAmount: bigint
  metadataURI: string
  status: number
  blockNumber?: bigint
  createdAt?: bigint
}
