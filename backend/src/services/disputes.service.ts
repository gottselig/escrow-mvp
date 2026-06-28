// Disputes service logic
import { DisputesRepository } from '../repositories/disputes.repository'
import { DealsRepository } from '../repositories/deals.repository'
import { DisputeDto } from '../types/api'

const disputesRepository = new DisputesRepository()
const dealsRepository = new DealsRepository()
const DealStatus = {
  Disputed: 'Disputed',
  Resolved: 'Resolved',
} as const

export class DisputesService {
  /**
   * Open a new dispute
   */
  async openDispute(data: {
    dealId: string
    openedBy: string
    reasonURI?: string
    blockNumber?: number
    txHash?: string
  }): Promise<DisputeDto> {
    // Update deal status to Disputed
    await dealsRepository.updateDealStatus(data.dealId, DealStatus.Disputed)

    // Create dispute record
    const dispute = await disputesRepository.createDispute({
      dealId: data.dealId,
      openedBy: data.openedBy,
      reasonURI: data.reasonURI,
      eventBlockNumber: data.blockNumber,
      eventTxHash: data.txHash,
    })

    return this.formatDisputeDto(dispute)
  }

  /**
   * Get dispute by ID
   */
  async getDisputeById(id: string): Promise<DisputeDto | null> {
    const dispute = await disputesRepository.getDisputeById(id)
    if (!dispute) return null
    return this.formatDisputeDto(dispute)
  }

  /**
   * Get all disputes for a deal
   */
  async getDisputesByDealId(dealId: string): Promise<DisputeDto[]> {
    const disputes = await disputesRepository.getDisputesByDealId(dealId)
    return disputes.map((d) => this.formatDisputeDto(d))
  }

  /**
   * Get active disputes
   */
  async getActiveDisputes(limit: number = 50, offset: number = 0) {
    const { disputes, total } = await disputesRepository.getActiveDisputes(limit, offset)
    return {
      disputes: disputes.map((d: any) => ({
        id: d.id,
        dealId: d.dealId,
        openedBy: d.openedBy,
        reasonURI: d.reasonURI,
        status: d.status,
        resolutionType: d.resolutionType,
        clientAmount: d.clientAmount,
        contractorAmount: d.contractorAmount,
        openedAt: d.openedAt.toISOString(),
        resolvedAt: d.resolvedAt?.toISOString() || null,
      })),
      total,
    }
  }

  /**
   * Get all disputes
   */
  async getAllDisputes(limit: number = 50, offset: number = 0) {
    const { disputes, total } = await disputesRepository.getAllDisputes(limit, offset)
    return {
      disputes: disputes.map((d: any) => this.formatDisputeDto(d)),
      total,
    }
  }

  /**
   * Handle DisputeResolvedToClient event
   */
  async handleDisputeResolvedToClient(
    dealId: string,
    amount: string,
    txHash: string
  ): Promise<void> {
    const disputes = await disputesRepository.getDisputesByDealId(dealId)
    const openDispute = disputes.find((d) => d.status === 'Open')

    if (openDispute) {
      await disputesRepository.resolveToClient(openDispute.id, amount, txHash)
    }

    // Update deal status to Resolved
    await dealsRepository.updateDealStatus(dealId, DealStatus.Resolved)
  }

  /**
   * Handle DisputeResolvedToContractor event
   */
  async handleDisputeResolvedToContractor(
    dealId: string,
    amount: string,
    txHash: string
  ): Promise<void> {
    const disputes = await disputesRepository.getDisputesByDealId(dealId)
    const openDispute = disputes.find((d) => d.status === 'Open')

    if (openDispute) {
      await disputesRepository.resolveToContractor(openDispute.id, amount, txHash)
    }

    // Update deal status to Resolved
    await dealsRepository.updateDealStatus(dealId, DealStatus.Resolved)
  }

  /**
   * Handle DisputeResolvedSplit event
   */
  async handleDisputeResolvedSplit(
    dealId: string,
    clientAmount: string,
    contractorAmount: string,
    txHash: string
  ): Promise<void> {
    const disputes = await disputesRepository.getDisputesByDealId(dealId)
    const openDispute = disputes.find((d) => d.status === 'Open')

    if (openDispute) {
      await disputesRepository.resolveSplit(
        openDispute.id,
        clientAmount,
        contractorAmount,
        txHash
      )
    }

    // Update deal status to Resolved
    await dealsRepository.updateDealStatus(dealId, DealStatus.Resolved)
  }

  private formatDisputeDto(dispute: any): DisputeDto {
    return {
      id: dispute.id,
      openedBy: dispute.openedBy,
      reasonURI: dispute.reasonURI,
      status: dispute.status,
      resolutionType: dispute.resolutionType,
      clientAmount: dispute.clientAmount,
      contractorAmount: dispute.contractorAmount,
      openedAt: dispute.openedAt.toISOString(),
      resolvedAt: dispute.resolvedAt?.toISOString() || null,
    }
  }
}
