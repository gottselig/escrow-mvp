// Deals repository
import { PrismaClient, DealStatus } from '@prisma/client'

const prisma = new PrismaClient()

export class DealsRepository {
  /**
   * Check if an event with the same tx hash and log index was already processed
   */
  async hasEvent(txHash: string, logIndex: number, eventName?: string): Promise<boolean> {
    const event = await prisma.eventLog.findFirst({
      where: {
        txHash,
        logIndex,
        ...(eventName ? { eventName } : {}),
      },
      select: { id: true },
    })

    return Boolean(event)
  }

  /**
   * Create a new deal in the database
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
    createdBlockNumber?: number
    createdTxHash?: string
    createdAt?: Date
  }): Promise<any> {
    return prisma.deal.create({
      data: {
        escrowAddress: data.escrowAddress,
        factoryAddress: data.factoryAddress,
        client: data.client,
        contractor: data.contractor,
        arbiter: data.arbiter,
        treasury: data.treasury,
        token: data.token,
        totalAmount: data.totalAmount,
        fundedAmount: data.fundedAmount || '0',
        releasedAmount: data.releasedAmount || '0',
        feeBps: data.feeBps,
        status: data.status || DealStatus.Created,
        metadataURI: data.metadataURI,
        createdBlockNumber: data.createdBlockNumber,
        createdTxHash: data.createdTxHash,
        ...(data.createdAt ? { createdAt: data.createdAt } : {}),
      },
    })
  }

  /**
   * Get a deal by ID
   */
  async getDealById(id: string): Promise<any | null> {
    return prisma.deal.findUnique({
      where: { id },
      include: {
        milestones: true,
        disputes: true,
      },
    })
  }

  /**
   * Get a deal by escrow contract address
   */
  async getDealByEscrowAddress(escrowAddress: string): Promise<any | null> {
    return prisma.deal.findUnique({
      where: { escrowAddress },
      include: {
        milestones: true,
        disputes: true,
      },
    })
  }

  /**
   * Get all deals with pagination
   */
  async getAllDeals(
    limit: number = 50,
    offset: number = 0,
    filters?: {
      status?: string
      client?: string
      contractor?: string
    }
  ): Promise<{ deals: any[]; total: number }> {
    const where: any = {}
    if (filters?.status) where.status = filters.status
    if (filters?.client) where.client = filters.client
    if (filters?.contractor) where.contractor = filters.contractor

    const [deals, total] = await Promise.all([
      prisma.deal.findMany({
        where,
        include: { milestones: true, disputes: true },
        take: limit,
        skip: offset,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.deal.count({ where }),
    ])

    return { deals, total }
  }

  /**
   * Get deals by client address
   */
  async getDealsByClient(client: string, limit: number = 50, offset: number = 0) {
    const [deals, total] = await Promise.all([
      prisma.deal.findMany({
        where: { client },
        include: { milestones: true, disputes: true },
        take: limit,
        skip: offset,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.deal.count({ where: { client } }),
    ])
    return { deals, total }
  }

  /**
   * Get deals by contractor address
   */
  async getDealsByContractor(contractor: string, limit: number = 50, offset: number = 0) {
    const [deals, total] = await Promise.all([
      prisma.deal.findMany({
        where: { contractor },
        include: { milestones: true, disputes: true },
        take: limit,
        skip: offset,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.deal.count({ where: { contractor } }),
    ])
    return { deals, total }
  }

  /**
   * Update deal status
   */
  async updateDealStatus(dealId: string, status: DealStatus): Promise<any> {
    return prisma.deal.update({
      where: { id: dealId },
      data: { status, updatedAt: new Date() },
      include: { milestones: true, disputes: true },
    })
  }

  /**
   * Set contractor once when a deal is accepted.
   */
  async acceptDeal(dealId: string, contractor: string): Promise<any> {
    return prisma.deal.update({
      where: { id: dealId },
      data: { contractor, status: DealStatus.Accepted, updatedAt: new Date() },
      include: { milestones: true, disputes: true },
    })
  }

  /**
   * Update deal amounts (funded, released)
   */
  async updateDealAmounts(
    dealId: string,
    fundedAmount?: string,
    releasedAmount?: string
  ): Promise<any> {
    const updateData: any = { updatedAt: new Date() }
    if (fundedAmount !== undefined) updateData.fundedAmount = fundedAmount
    if (releasedAmount !== undefined) updateData.releasedAmount = releasedAmount

    return prisma.deal.update({
      where: { id: dealId },
      data: updateData,
      include: { milestones: true, disputes: true },
    })
  }

  /**
   * Update deal dispute reason
   */
  async updateDealDisputeReason(dealId: string, reasonURI: string): Promise<any> {
    return prisma.deal.update({
      where: { id: dealId },
      data: { disputeReasonURI: reasonURI, updatedAt: new Date() },
    })
  }

  /**
   * Create a milestone for a deal
   */
  async createMilestone(data: {
    dealId: string
    milestoneIndex: number
    amount: string
    deadline: Date
    descriptionURI?: string
  }): Promise<any> {
    return prisma.milestone.create({
      data: {
        dealId: data.dealId,
        milestoneIndex: data.milestoneIndex,
        amount: data.amount,
        deadline: data.deadline,
        descriptionURI: data.descriptionURI,
        status: 'Pending',
      },
    })
  }

  /**
   * Get milestone by ID
   */
  async getMilestoneById(milestoneId: string): Promise<any | null> {
    return prisma.milestone.findUnique({ where: { id: milestoneId } })
  }

  /**
   * Update milestone status
   */
  async updateMilestoneStatus(
    milestoneId: string,
    status: string,
    resultURI?: string
  ): Promise<any> {
    const updateData: any = { status, updatedAt: new Date() }
    if (resultURI) {
      updateData.resultURI = resultURI
      updateData.submittedAt = new Date()
    }

    return prisma.milestone.update({
      where: { id: milestoneId },
      data: updateData,
    })
  }

  /**
   * Approve milestone (set gross/fee/net amounts and mark as approved)
   */
  async approveMilestone(
    milestoneId: string,
    grossAmount: string,
    feeAmount: string,
    netAmount: string
  ): Promise<any> {
    return prisma.milestone.update({
      where: { id: milestoneId },
      data: {
        status: 'Approved',
        grossAmount,
        feeAmount,
        netAmount,
        approvedAt: new Date(),
        updatedAt: new Date(),
      },
    })
  }

  /**
   * Get all milestones for a deal
   */
  async getMilestonesByDealId(dealId: string): Promise<any[]> {
    return prisma.milestone.findMany({
      where: { dealId },
      orderBy: { milestoneIndex: 'asc' },
    })
  }

  /**
   * Log an event (audit trail)
   */
  async logEvent(data: {
    dealId: string
    eventName: string
    eventData: any
    blockNumber: number
    txHash: string
    logIndex: number
  }): Promise<any> {
    return prisma.eventLog.create({
      data: {
        dealId: data.dealId,
        eventName: data.eventName,
        eventData: JSON.stringify(data.eventData),
        blockNumber: data.blockNumber,
        txHash: data.txHash,
        logIndex: data.logIndex,
      },
    })
  }
}
