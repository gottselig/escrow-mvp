// Disputes repository
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

export class DisputesRepository {
  /**
   * Create a new dispute
   */
  async createDispute(data: {
    dealId: string
    openedBy: string
    reasonURI?: string
    eventBlockNumber?: number
    eventTxHash?: string
  }): Promise<any> {
    return prisma.dispute.create({
      data: {
        dealId: data.dealId,
        openedBy: data.openedBy,
        reasonURI: data.reasonURI,
        status: 'Open',
        eventBlockNumber: data.eventBlockNumber,
        eventTxHash: data.eventTxHash,
      },
    })
  }

  /**
   * Get dispute by ID
   */
  async getDisputeById(id: string): Promise<any | null> {
    return prisma.dispute.findUnique({ where: { id } })
  }

  /**
   * Get all disputes for a deal
   */
  async getDisputesByDealId(dealId: string): Promise<any[]> {
    return prisma.dispute.findMany({
      where: { dealId },
      orderBy: { createdAt: 'desc' },
    })
  }

  /**
   * Get active (unresolved) disputes
   */
  async getActiveDisputes(limit: number = 50, offset: number = 0) {
    const [disputes, total] = await Promise.all([
      prisma.dispute.findMany({
        where: { status: 'Open' },
        include: { deal: true },
        take: limit,
        skip: offset,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.dispute.count({ where: { status: 'Open' } }),
    ])
    return { disputes, total }
  }

  /**
   * Get all disputes with pagination
   */
  async getAllDisputes(limit: number = 50, offset: number = 0) {
    const [disputes, total] = await Promise.all([
      prisma.dispute.findMany({
        include: { deal: true },
        take: limit,
        skip: offset,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.dispute.count(),
    ])
    return { disputes, total }
  }

  /**
   * Resolve dispute to client
   */
  async resolveToClient(
    disputeId: string,
    clientAmount: string,
    txHash: string
  ): Promise<any> {
    return prisma.dispute.update({
      where: { id: disputeId },
      data: {
        status: 'Resolved',
        resolutionType: 'ToClient',
        clientAmount,
        contractorAmount: '0',
        resolvedAt: new Date(),
        resolvedTxHash: txHash,
      },
    })
  }

  /**
   * Resolve dispute to contractor
   */
  async resolveToContractor(
    disputeId: string,
    contractorAmount: string,
    txHash: string
  ): Promise<any> {
    return prisma.dispute.update({
      where: { id: disputeId },
      data: {
        status: 'Resolved',
        resolutionType: 'ToContractor',
        clientAmount: '0',
        contractorAmount,
        resolvedAt: new Date(),
        resolvedTxHash: txHash,
      },
    })
  }

  /**
   * Resolve dispute with split
   */
  async resolveSplit(
    disputeId: string,
    clientAmount: string,
    contractorAmount: string,
    txHash: string
  ): Promise<any> {
    return prisma.dispute.update({
      where: { id: disputeId },
      data: {
        status: 'Resolved',
        resolutionType: 'Split',
        clientAmount,
        contractorAmount,
        resolvedAt: new Date(),
        resolvedTxHash: txHash,
      },
    })
  }
}
