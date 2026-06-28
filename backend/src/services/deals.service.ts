// Deals service logic
import { ethers } from 'ethers'
import { DealStatus } from '@prisma/client'

import { config } from '../config/env'
import { DealsRepository } from '../repositories/deals.repository'
import { DealDto, DealSummaryDto, CreateDealRequest, CreateMilestoneRequest } from '../types/api'

const repository = new DealsRepository()

const MilestoneStatus = {
  Submitted: 'Submitted',
  Approved: 'Approved',
} as const

const ESCROW_READ_ABI = [
  'function client() view returns (address)',
  'function contractor() view returns (address)',
  'function arbiter() view returns (address)',
  'function token() view returns (address)',
  'function treasury() view returns (address)',
  'function totalAmount() view returns (uint256)',
  'function fundedAmount() view returns (uint256)',
  'function releasedAmount() view returns (uint256)',
  'function feeBps() view returns (uint96)',
  'function status() view returns (uint8)',
  'function metadataURI() view returns (string)',
  'function getMilestonesCount() view returns (uint256)',
  'function getMilestone(uint256 index) view returns (tuple(uint256 amount, uint64 deadline, uint8 status, string descriptionURI, string resultURI))',
]

const statusByIndex: Record<number, DealStatus> = {
  0: DealStatus.Created,
  1: DealStatus.Accepted,
  2: DealStatus.Funded,
  3: DealStatus.InProgress,
  4: DealStatus.Disputed,
  5: DealStatus.Resolved,
  6: DealStatus.Completed,
  7: DealStatus.Cancelled,
}

export class DealsService {
  private provider = new ethers.JsonRpcProvider(config.rpcUrl)

  async verifyAndCreateDeal(data: {
    escrowAddress: string
    factoryAddress: string
    txHash?: string
    blockNumber?: number
  }): Promise<DealDto> {
    const existing = await repository.getDealByEscrowAddress(data.escrowAddress)
    if (existing && existing.milestones?.length > 0) {
      return this.formatDealDto(existing, existing.milestones, existing.disputes)
    }

    const code = await this.provider.getCode(data.escrowAddress)
    if (code === '0x') {
      throw new Error('Escrow contract not found on-chain')
    }

    const contract = new ethers.Contract(data.escrowAddress, ESCROW_READ_ABI, this.provider)
    const [
      client,
      contractor,
      arbiter,
      token,
      treasury,
      totalAmount,
      fundedAmount,
      releasedAmount,
      feeBps,
      statusRaw,
      metadataURI,
      milestonesCountRaw,
    ] = await Promise.all([
      contract.client(),
      contract.contractor(),
      contract.arbiter(),
      contract.token(),
      contract.treasury(),
      contract.totalAmount(),
      contract.fundedAmount(),
      contract.releasedAmount(),
      contract.feeBps(),
      contract.status(),
      contract.metadataURI(),
      contract.getMilestonesCount(),
    ])

    const milestonesCount = Number(milestonesCountRaw)
    const milestones = await Promise.all(
      Array.from({ length: milestonesCount }, async (_, index) => {
        const milestone = await contract.getMilestone(index)
        return {
          amount: milestone.amount.toString(),
          deadline: new Date(Number(milestone.deadline) * 1000),
          descriptionURI: milestone.descriptionURI as string,
        }
      }),
    )

    let createdAt: Date | undefined
    if (data.blockNumber) {
      const block = await this.provider.getBlock(data.blockNumber)
      if (block?.timestamp !== undefined) {
        createdAt = new Date(Number(block.timestamp) * 1000)
      }
    }

    return this.createDeal({
      escrowAddress: data.escrowAddress,
      factoryAddress: data.factoryAddress,
      client,
      contractor,
      arbiter,
      treasury,
      token,
      totalAmount: totalAmount.toString(),
      fundedAmount: fundedAmount.toString(),
      releasedAmount: releasedAmount.toString(),
      feeBps: Number(feeBps),
      status: statusByIndex[Number(statusRaw)] || DealStatus.Created,
      metadataURI,
      milestones,
      blockNumber: data.blockNumber,
      txHash: data.txHash,
      createdAt,
    })
  }

  /**
   * Create a new deal from on-chain EscrowCreated event
   */
  async createDeal(data: {
    escrowAddress: string
    factoryAddress: string
    client: string
    contractor: string
    arbiter: string
    treasury: string
    token: string
    totalAmount: string
    fundedAmount?: string
    releasedAmount?: string
    feeBps: number
    status?: DealStatus
    metadataURI?: string
    milestones?: Array<{ amount: string; deadline: Date; descriptionURI?: string }>
    blockNumber?: number
    txHash?: string
    createdAt?: Date
  }): Promise<DealDto> {
    const existing = await repository.getDealByEscrowAddress(data.escrowAddress)
    if (existing) {
      let milestones = existing.milestones || []

      if (milestones.length === 0 && data.milestones && data.milestones.length > 0) {
        milestones = []
        for (let i = 0; i < data.milestones.length; i++) {
          const m = data.milestones[i]
          const milestone = await repository.createMilestone({
            dealId: existing.id,
            milestoneIndex: i,
            amount: m.amount,
            deadline: m.deadline,
            descriptionURI: m.descriptionURI,
          })
          milestones.push(milestone)
        }
      }

      return this.formatDealDto(existing, milestones, existing.disputes)
    }

    // Create the deal
    const deal = await repository.createDeal({
      escrowAddress: data.escrowAddress,
      factoryAddress: data.factoryAddress,
      client: data.client,
      contractor: data.contractor,
      arbiter: data.arbiter,
      treasury: data.treasury,
      token: data.token,
      totalAmount: data.totalAmount,
      fundedAmount: data.fundedAmount,
      releasedAmount: data.releasedAmount,
      feeBps: data.feeBps,
      metadataURI: data.metadataURI,
      status: data.status || DealStatus.Created,
      createdBlockNumber: data.blockNumber,
      createdTxHash: data.txHash,
      createdAt: data.createdAt,
    })

    // Create milestones if provided
    const milestones = []
    if (data.milestones && data.milestones.length > 0) {
      for (let i = 0; i < data.milestones.length; i++) {
        const m = data.milestones[i]
        const milestone = await repository.createMilestone({
          dealId: deal.id,
          milestoneIndex: i,
          amount: m.amount,
          deadline: m.deadline,
          descriptionURI: m.descriptionURI,
        })
        milestones.push(milestone)
      }
    }

    return this.formatDealDto(deal, milestones, [])
  }

  /**
   * Get deal by ID with all related data
   */
  async getDealById(dealId: string): Promise<DealDto | null> {
    const deal = await repository.getDealById(dealId)
    if (!deal) return null

    const milestones = await repository.getMilestonesByDealId(dealId)
    return this.formatDealDto(deal, milestones, deal.disputes)
  }

  /**
   * Get deal by escrow contract address
   */
  async getDealByEscrowAddress(escrowAddress: string): Promise<DealDto | null> {
    const deal = await repository.getDealByEscrowAddress(escrowAddress)
    if (!deal) return null
    return this.formatDealDto(deal, deal.milestones, deal.disputes)
  }

  /**
   * Get all deals with pagination
   */
  async getAllDeals(
    limit: number = 50,
    offset: number = 0,
    filters?: { status?: string; client?: string; contractor?: string }
  ): Promise<{ deals: DealSummaryDto[]; total: number }> {
    const dealFilters = filters ? { status: filters.status } : undefined

    const { deals, total } = await repository.getAllDeals(limit, offset, dealFilters)
    return {
      deals: deals.map((d: any) => this.formatDealSummaryDto(d)),
      total,
    }
  }

  /**
   * Get deals by client address
   */
  async getDealsByClient(
    client: string,
    limit: number = 50,
    offset: number = 0
  ): Promise<{ deals: DealSummaryDto[]; total: number }> {
    const { deals, total } = await repository.getDealsByClient(client, limit, offset)
    return {
      deals: deals.map((d: any) => this.formatDealSummaryDto(d)),
      total,
    }
  }

  /**
   * Get deals by contractor address
   */
  async getDealsByContractor(
    contractor: string,
    limit: number = 50,
    offset: number = 0
  ): Promise<{ deals: DealSummaryDto[]; total: number }> {
    const { deals, total } = await repository.getDealsByContractor(contractor, limit, offset)
    return {
      deals: deals.map((d: any) => this.formatDealSummaryDto(d)),
      total,
    }
  }

  /**
   * Handle DealAccepted event
   */
  async handleDealAccepted(dealId: string, contractor: string): Promise<void> {
    await repository.acceptDeal(dealId, contractor)
  }

  /**
   * Handle DealFunded event
   */
  async handleDealFunded(dealId: string, amount: string): Promise<void> {
    await repository.updateDealAmounts(dealId, amount)
    await repository.updateDealStatus(dealId, DealStatus.Funded)
  }

  /**
   * Handle DealCancelled event
   */
  async handleDealCancelled(dealId: string): Promise<void> {
    await repository.updateDealStatus(dealId, DealStatus.Cancelled)
  }

  /**
   * Handle MilestoneSubmitted event
   */
  async handleMilestoneSubmitted(
    dealId: string,
    milestoneIndex: number,
    resultURI: string
  ): Promise<void> {
    const milestones = await repository.getMilestonesByDealId(dealId)
    const milestone = milestones[milestoneIndex]
    if (milestone) {
      await repository.updateMilestoneStatus(milestone.id, MilestoneStatus.Submitted, resultURI)
    }
  }

  /**
   * Handle MilestoneApproved event
   */
  async handleMilestoneApproved(
    dealId: string,
    milestoneIndex: number,
    grossAmount: string,
    feeAmount: string,
    netAmount: string
  ): Promise<void> {
    const milestones = await repository.getMilestonesByDealId(dealId)
    const milestone = milestones[milestoneIndex]
    if (milestone) {
      await repository.approveMilestone(milestone.id, grossAmount, feeAmount, netAmount)
    }

    // Check if all milestones are approved to update deal status
    const allMilestones = await repository.getMilestonesByDealId(dealId)
    const allApproved = allMilestones.every((m) => m.status === MilestoneStatus.Approved)
    if (allApproved) {
      await repository.updateDealStatus(dealId, DealStatus.Completed)
    }
  }

  /**
   * Handle StatusChanged event
   */
  async handleStatusChanged(dealId: string, newStatus: number): Promise<void> {
    const statusMap: { [key: number]: DealStatus } = {
      0: DealStatus.Created,
      1: DealStatus.Accepted,
      2: DealStatus.Funded,
      3: DealStatus.InProgress,
      4: DealStatus.Disputed,
      5: DealStatus.Resolved,
      6: DealStatus.Completed,
      7: DealStatus.Cancelled,
    }

    const status = statusMap[newStatus]
    if (status) {
      await repository.updateDealStatus(dealId, status)
    }
  }

  // Helper formatting methods
  private formatDealDto(deal: any, milestones: any[], disputes: any[]): DealDto {
    return {
      id: deal.id,
      escrowAddress: deal.escrowAddress,
      factoryAddress: deal.factoryAddress,
      client: deal.client,
      contractor: deal.contractor,
      arbiter: deal.arbiter,
      treasury: deal.treasury,
      token: deal.token,
      totalAmount: deal.totalAmount,
      fundedAmount: deal.fundedAmount,
      releasedAmount: deal.releasedAmount,
      feeBps: deal.feeBps,
      status: deal.status as any,
      metadataURI: deal.metadataURI,
      disputeReasonURI: deal.disputeReasonURI,
      milestones: milestones.map((m) => ({
        id: m.id,
        milestoneIndex: m.milestoneIndex,
        amount: m.amount,
        grossAmount: m.grossAmount,
        feeAmount: m.feeAmount,
        netAmount: m.netAmount,
        deadline: m.deadline.toISOString(),
        status: m.status as any,
        descriptionURI: m.descriptionURI,
        resultURI: m.resultURI,
        submittedAt: m.submittedAt?.toISOString() || null,
        approvedAt: m.approvedAt?.toISOString() || null,
      })),
      disputes: disputes.map((d) => ({
        id: d.id,
        openedBy: d.openedBy,
        reasonURI: d.reasonURI,
        status: d.status,
        resolutionType: d.resolutionType,
        clientAmount: d.clientAmount,
        contractorAmount: d.contractorAmount,
        openedAt: d.openedAt.toISOString(),
        resolvedAt: d.resolvedAt?.toISOString() || null,
      })),
      createdAt: deal.createdAt.toISOString(),
      updatedAt: deal.updatedAt.toISOString(),
    }
  }

  private formatDealSummaryDto(deal: any): DealSummaryDto {
    return {
      id: deal.id,
      escrowAddress: deal.escrowAddress,
      client: deal.client,
      contractor: deal.contractor,
      token: deal.token,
      totalAmount: deal.totalAmount,
      fundedAmount: deal.fundedAmount,
      status: deal.status as any,
      metadataURI: deal.metadataURI,
      createdAt: deal.createdAt.toISOString(),
    }
  }
}
