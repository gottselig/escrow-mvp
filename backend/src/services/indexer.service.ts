// Indexer service logic
import { ethers } from 'ethers'
import { DealStatus } from '@prisma/client'
import { config } from '../config/env'
import { DealsService } from './deals.service'
import { DisputesService } from './disputes.service'
import { DealsRepository } from '../repositories/deals.repository'
import { IndexerStateService } from './indexer-state.service'
import { logger } from '../utils/logger'

const dealsService = new DealsService()
const disputesService = new DisputesService()
const dealsRepository = new DealsRepository()
const stateService = new IndexerStateService()
const BACKFILL_LOG_BLOCK_SPAN = 9 // Free-tier RPC usually allows up to 10-block eth_getLogs spans.

export class IndexerService {
  private provider: ethers.Provider
  private escrowFactoryAbi: any = []
  private escrowAbi: any = []

  constructor() {
    this.provider = new ethers.JsonRpcProvider(config.rpcUrl)
  }

  /**
   * Initialize the indexer with ABI definitions (would be imported in real implementation)
   */
  setAbis(escrowFactoryAbi: any, escrowAbi: any) {
    this.escrowFactoryAbi = escrowFactoryAbi
    this.escrowAbi = escrowAbi
  }

  private getFactoryCursorKey(factoryAddress: string): string {
    return `factory:${factoryAddress.toLowerCase()}`
  }

  private getEscrowCursorKey(escrowAddress: string): string {
    return `escrow:${escrowAddress.toLowerCase()}`
  }

  private async withRetry<T>(label: string, fn: () => Promise<T>, retries: number = 3): Promise<T> {
    let lastError: unknown

    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        return await fn()
      } catch (error) {
        lastError = error
        if (attempt === retries) {
          break
        }

        const backoffMs = 200 * Math.pow(2, attempt - 1)
        logger.warn(`${label} failed on attempt ${attempt}/${retries}, retrying in ${backoffMs}ms`)
        await new Promise((resolve) => setTimeout(resolve, backoffMs))
      }
    }

    throw lastError
  }

  private async resolveStartBlock(cursorKey: string, fromBlock: number): Promise<number> {
    const savedBlock = await stateService.getLastProcessedBlock(cursorKey)

    if (savedBlock === null) {
      return fromBlock
    }

    // Continue from the next block after the one already fully processed.
    return Math.max(fromBlock, savedBlock + 1)
  }

  private async processEvent(options: {
    eventName: string
    txHash: string
    logIndex: number
    blockNumber: number
    cursorKey: string
    handler: () => Promise<void>
  }): Promise<void> {
    const { eventName, txHash, logIndex, blockNumber, cursorKey, handler } = options

    if (txHash) {
      const alreadyProcessed = await dealsRepository.hasEvent(txHash, logIndex, eventName)
      if (alreadyProcessed) {
        logger.info(`Skipping duplicate ${eventName} event ${txHash}:${logIndex}`)
        return
      }
    }

    await this.withRetry(`Process ${eventName}`, handler)

    if (blockNumber > 0) {
      await stateService.setLastProcessedBlock(cursorKey, blockNumber)
    }
  }

  private mapChainStatusToDealStatus(status: number): DealStatus {
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

    return statusMap[status] || DealStatus.Created
  }

  private getEventMeta(event: any): { txHash?: string; logIndex?: number; blockNumber?: number } {
    const eventLog = event?.log || event

    return {
      txHash: eventLog?.transactionHash || event?.transactionHash,
      logIndex: eventLog?.index ?? eventLog?.logIndex ?? event?.index ?? event?.logIndex,
      blockNumber: eventLog?.blockNumber ?? event?.blockNumber,
    }
  }

  private async inferEscrowCreationFromCode(escrowAddress: string): Promise<{ blockNumber?: number; createdAt?: Date }> {
    const latestBlock = await this.provider.getBlockNumber()
    const latestCode = await this.provider.getCode(escrowAddress)
    if (!latestCode || latestCode === '0x') {
      return {}
    }

    let left = 0
    let right = latestBlock
    let firstWithCode = latestBlock

    while (left <= right) {
      const mid = Math.floor((left + right) / 2)
      const codeAtMid = await this.provider.getCode(escrowAddress, mid)

      if (codeAtMid && codeAtMid !== '0x') {
        firstWithCode = mid
        right = mid - 1
      } else {
        left = mid + 1
      }
    }

    const block = await this.provider.getBlock(firstWithCode)
    if (!block) {
      return { blockNumber: firstWithCode }
    }

    return {
      blockNumber: firstWithCode,
      createdAt: new Date(Number(block.timestamp) * 1000),
    }
  }

  private async syncMissingFactoryDeals(factoryAddress: string): Promise<void> {
    const factoryReadContract = new ethers.Contract(
      factoryAddress,
      ['function getAllEscrows() view returns (address[])'],
      this.provider,
    )

    const escrowReadAbi = [
      'function getSummary() view returns (address,address,address,address,address,uint256,uint256,uint256,uint96,uint8,string,string)',
    ]

    const escrows = (await this.withRetry('Read all escrows from factory', () =>
      factoryReadContract.getAllEscrows(),
    )) as string[]

    for (const escrowAddress of escrows) {
      const existing = await dealsRepository.getDealByEscrowAddress(escrowAddress)
      if (existing) continue

      try {
        const escrowContract = new ethers.Contract(escrowAddress, escrowReadAbi, this.provider)
        const summary = (await this.withRetry(`Read summary for ${escrowAddress}`, () =>
          escrowContract.getSummary(),
        )) as [string, string, string, string, string, bigint, bigint, bigint, bigint, number, string, string]

        const [client, contractor, arbiter, token, treasury, totalAmount, fundedAmount, releasedAmount, feeBps, status, metadataURI] =
          summary

        let inferredCreation: { blockNumber?: number; createdAt?: Date } = {}
        try {
          inferredCreation = await this.withRetry(
            `Infer creation timestamp for ${escrowAddress}`,
            () => this.inferEscrowCreationFromCode(escrowAddress),
            2,
          )
        } catch (error) {
          logger.warn(`Could not infer creation timestamp for ${escrowAddress}, continuing without it`)
        }

        await dealsService.createDeal({
          escrowAddress,
          factoryAddress,
          client,
          contractor,
          arbiter,
          treasury,
          token,
          totalAmount: totalAmount.toString(),
          feeBps: Number(feeBps),
          status: this.mapChainStatusToDealStatus(Number(status)),
          metadataURI,
          blockNumber: inferredCreation.blockNumber,
          createdAt: inferredCreation.createdAt,
        })

        // Keep DB amounts consistent with current on-chain summary.
        const createdDeal = await dealsRepository.getDealByEscrowAddress(escrowAddress)
        if (createdDeal) {
          await dealsRepository.updateDealAmounts(
            createdDeal.id,
            fundedAmount.toString(),
            releasedAmount.toString(),
          )
        }

        logger.info(`Synced missing deal from factory list: ${escrowAddress}`)
      } catch (error) {
        logger.error(`Failed syncing missing deal ${escrowAddress}:`, error)
      }
    }
  }

  /**
   * Start listening for EscrowFactory events
   */
  async listenToFactoryEvents(factoryAddress: string, fromBlock: number = 0): Promise<void> {
    try {
      const cursorKey = this.getFactoryCursorKey(factoryAddress)
      const startBlock = await this.resolveStartBlock(cursorKey, fromBlock)
      logger.info(`Starting to listen for Factory events from block ${startBlock}`)

      const contract = new ethers.Contract(factoryAddress, this.escrowFactoryAbi, this.provider)

      // Listen for EscrowCreated events
      contract.on('EscrowCreated', async (escrow, client, contractor, arbiter, token, totalAmount, metadataURI, event) => {
        const eventMeta = this.getEventMeta(event)

        await this.processEvent({
          eventName: 'EscrowCreated',
          txHash: eventMeta.txHash || '',
          logIndex: eventMeta.logIndex ?? 0,
          blockNumber: eventMeta.blockNumber ?? 0,
          cursorKey,
          handler: async () =>
            this.handleEscrowCreated({
              escrow,
              client,
              contractor,
              arbiter,
              token,
              totalAmount: totalAmount.toString(),
              metadataURI,
              blockNumber: eventMeta.blockNumber,
              txHash: eventMeta.txHash,
              logIndex: eventMeta.logIndex,
              factoryAddress,
            }),
        })
      })

      logger.info('Factory event listener started')
    } catch (error) {
      logger.error('Error setting up factory event listener:', error)
    }
  }

  /**
   * Start listening for Escrow contract events
   */
  async listenToEscrowEvents(escrowAddress: string): Promise<void> {
    try {
      logger.info(`Starting to listen for Escrow events at ${escrowAddress}`)

      const contract = new ethers.Contract(escrowAddress, this.escrowAbi, this.provider)
      const cursorKey = this.getEscrowCursorKey(escrowAddress)

      contract.on('DealAccepted', async (contractor, event) => {
        await this.processEvent({
          eventName: 'DealAccepted',
          txHash: event.transactionHash,
          logIndex: event.logIndex,
          blockNumber: event.blockNumber,
          cursorKey,
          handler: async () => this.handleDealAccepted(escrowAddress, contractor, event),
        })
      })

      contract.on('DealFunded', async (client, amount, event) => {
        await this.processEvent({
          eventName: 'DealFunded',
          txHash: event.transactionHash,
          logIndex: event.logIndex,
          blockNumber: event.blockNumber,
          cursorKey,
          handler: async () => this.handleDealFunded(escrowAddress, amount.toString(), event),
        })
      })

      contract.on('DealCancelled', async (client, event) => {
        await this.processEvent({
          eventName: 'DealCancelled',
          txHash: event.transactionHash,
          logIndex: event.logIndex,
          blockNumber: event.blockNumber,
          cursorKey,
          handler: async () => this.handleDealCancelled(escrowAddress, event),
        })
      })

      contract.on('MilestoneSubmitted', async (milestoneId, resultURI, event) => {
        await this.processEvent({
          eventName: 'MilestoneSubmitted',
          txHash: event.transactionHash,
          logIndex: event.logIndex,
          blockNumber: event.blockNumber,
          cursorKey,
          handler: async () =>
            this.handleMilestoneSubmitted(escrowAddress, milestoneId.toNumber(), resultURI, event),
        })
      })

      contract.on('MilestoneApproved', async (milestoneId, grossAmount, feeAmount, netAmount, event) => {
        await this.processEvent({
          eventName: 'MilestoneApproved',
          txHash: event.transactionHash,
          logIndex: event.logIndex,
          blockNumber: event.blockNumber,
          cursorKey,
          handler: async () =>
            this.handleMilestoneApproved(
              escrowAddress,
              milestoneId.toNumber(),
              grossAmount.toString(),
              feeAmount.toString(),
              netAmount.toString(),
              event
            ),
        })
      })

      contract.on('DisputeOpened', async (openedBy, reasonURI, event) => {
        await this.processEvent({
          eventName: 'DisputeOpened',
          txHash: event.transactionHash,
          logIndex: event.logIndex,
          blockNumber: event.blockNumber,
          cursorKey,
          handler: async () => this.handleDisputeOpened(escrowAddress, openedBy, reasonURI, event),
        })
      })

      contract.on('DisputeResolvedToClient', async (amount, event) => {
        await this.processEvent({
          eventName: 'DisputeResolvedToClient',
          txHash: event.transactionHash,
          logIndex: event.logIndex,
          blockNumber: event.blockNumber,
          cursorKey,
          handler: async () => this.handleDisputeResolvedToClient(escrowAddress, amount.toString(), event),
        })
      })

      contract.on('DisputeResolvedToContractor', async (amount, event) => {
        await this.processEvent({
          eventName: 'DisputeResolvedToContractor',
          txHash: event.transactionHash,
          logIndex: event.logIndex,
          blockNumber: event.blockNumber,
          cursorKey,
          handler: async () => this.handleDisputeResolvedToContractor(escrowAddress, amount.toString(), event),
        })
      })

      contract.on('DisputeResolvedSplit', async (clientAmount, contractorAmount, event) => {
        await this.processEvent({
          eventName: 'DisputeResolvedSplit',
          txHash: event.transactionHash,
          logIndex: event.logIndex,
          blockNumber: event.blockNumber,
          cursorKey,
          handler: async () =>
            this.handleDisputeResolvedSplit(
              escrowAddress,
              clientAmount.toString(),
              contractorAmount.toString(),
              event
            ),
        })
      })

      contract.on('StatusChanged', async (oldStatus, newStatus, event) => {
        await this.processEvent({
          eventName: 'StatusChanged',
          txHash: event.transactionHash,
          logIndex: event.logIndex,
          blockNumber: event.blockNumber,
          cursorKey,
          handler: async () => this.handleStatusChanged(escrowAddress, newStatus.toNumber(), event),
        })
      })

      logger.info(`Escrow event listener started for ${escrowAddress}`)
    } catch (error) {
      logger.error(`Error setting up escrow event listener for ${escrowAddress}:`, error)
    }
  }

  /**
   * Process past events (backfill)
   */
  async processPastEvents(
    escrowAddress: string,
    factoryAddress: string,
    fromBlock: number,
    toBlock: number
  ): Promise<void> {
    await this.processPastFactoryEvents(factoryAddress, fromBlock, toBlock)
  }

  private async processPastFactoryEvents(factoryAddress: string, fromBlock: number, toBlock: number): Promise<void> {
    try {
      logger.info(`Processing past events from block ${fromBlock} to ${toBlock}`)
      const cursorKey = this.getFactoryCursorKey(factoryAddress)

      const factoryContract = new ethers.Contract(factoryAddress, this.escrowFactoryAbi, this.provider)

      for (let chunkFrom = fromBlock; chunkFrom <= toBlock; chunkFrom += BACKFILL_LOG_BLOCK_SPAN + 1) {
        const chunkTo = Math.min(chunkFrom + BACKFILL_LOG_BLOCK_SPAN, toBlock)

        let factoryEvents: ethers.Log[] = []
        try {
          factoryEvents = await this.withRetry(
            `Fetch factory logs ${chunkFrom}-${chunkTo}`,
            () =>
              this.provider.getLogs({
                address: factoryAddress,
                fromBlock: chunkFrom,
                toBlock: chunkTo,
              }),
            5,
          )
        } catch (error) {
          logger.warn(`Skipping factory log chunk ${chunkFrom}-${chunkTo} after retries`)
          continue
        }

        for (const eventLog of factoryEvents) {
          try {
            const event = factoryContract.interface.parseLog(eventLog)
            if (event && event.name === 'EscrowCreated') {
              await this.processEvent({
                eventName: 'EscrowCreated',
                txHash: eventLog.transactionHash,
                logIndex: eventLog.index,
                blockNumber: eventLog.blockNumber,
                cursorKey,
                handler: async () =>
                  this.handleEscrowCreated({
                    escrow: event.args[0],
                    client: event.args[1],
                    contractor: event.args[2],
                    arbiter: event.args[3],
                    token: event.args[4],
                    totalAmount: event.args[5].toString(),
                    metadataURI: event.args[6],
                    blockNumber: eventLog.blockNumber,
                    txHash: eventLog.transactionHash,
                    logIndex: eventLog.index,
                    factoryAddress,
                  }),
              })
            }
          } catch (error) {
            logger.error('Error processing factory event:', error)
          }
        }
      }

      logger.info('Finished processing past events')
    } catch (error) {
      logger.error('Error processing past events:', error)
    }
  }

  // Event handlers

  private async handleEscrowCreated(data: any) {
    try {
      logger.info(`Handling EscrowCreated for escrow: ${data.escrow}`)

      let createdAt: Date | undefined
      if (data.blockNumber) {
        const block = await this.withRetry(
          `Fetch block timestamp ${data.blockNumber}`,
          () => this.provider.getBlock(data.blockNumber),
          5,
        )

        if (block?.timestamp !== undefined) {
          createdAt = new Date(Number(block.timestamp) * 1000)
        }
      }

      const deal = await dealsService.createDeal({
        escrowAddress: data.escrow,
        factoryAddress: data.factoryAddress,
        client: data.client,
        contractor: data.contractor,
        arbiter: data.arbiter,
        treasury: data.treasury || ethers.ZeroAddress,
        token: data.token,
        totalAmount: data.totalAmount,
        feeBps: 500, // Default 5%, should fetch from factory
        metadataURI: data.metadataURI,
        blockNumber: data.blockNumber,
        txHash: data.txHash,
        createdAt,
      })

      // Log event
      await dealsRepository.logEvent({
        dealId: deal.id,
        eventName: 'EscrowCreated',
        eventData: data,
        blockNumber: data.blockNumber ?? 0,
        txHash: data.txHash || '',
        logIndex: data.logIndex ?? 0,
      })

      logger.info(`Successfully created deal: ${deal.id}`)

      // Start listening to this escrow's events
      await this.listenToEscrowEvents(data.escrow)
    } catch (error) {
      logger.error('Error handling EscrowCreated:', error)
      throw error
    }
  }

  private async handleDealAccepted(escrowAddress: string, contractor: string, event: any) {
    try {
      const deal = await dealsRepository.getDealByEscrowAddress(escrowAddress)
      if (deal) {
        await dealsService.handleDealAccepted(deal.id, contractor)
        await dealsRepository.logEvent({
          dealId: deal.id,
          eventName: 'DealAccepted',
          eventData: { contractor },
          blockNumber: event.blockNumber,
          txHash: event.transactionHash,
          logIndex: event.logIndex,
        })
      }
    } catch (error) {
      logger.error('Error handling DealAccepted:', error)
      throw error
    }
  }

  private async handleDealFunded(escrowAddress: string, amount: string, event: any) {
    try {
      const deal = await dealsRepository.getDealByEscrowAddress(escrowAddress)
      if (deal) {
        await dealsService.handleDealFunded(deal.id, amount)
        await dealsRepository.logEvent({
          dealId: deal.id,
          eventName: 'DealFunded',
          eventData: { amount },
          blockNumber: event.blockNumber,
          txHash: event.transactionHash,
          logIndex: event.logIndex,
        })
      }
    } catch (error) {
      logger.error('Error handling DealFunded:', error)
      throw error
    }
  }

  private async handleDealCancelled(escrowAddress: string, event: any) {
    try {
      const deal = await dealsRepository.getDealByEscrowAddress(escrowAddress)
      if (deal) {
        await dealsService.handleDealCancelled(deal.id)
        await dealsRepository.logEvent({
          dealId: deal.id,
          eventName: 'DealCancelled',
          eventData: {},
          blockNumber: event.blockNumber,
          txHash: event.transactionHash,
          logIndex: event.logIndex,
        })
      }
    } catch (error) {
      logger.error('Error handling DealCancelled:', error)
      throw error
    }
  }

  private async handleMilestoneSubmitted(escrowAddress: string, milestoneIndex: number, resultURI: string, event: any) {
    try {
      const deal = await dealsRepository.getDealByEscrowAddress(escrowAddress)
      if (deal) {
        await dealsService.handleMilestoneSubmitted(deal.id, milestoneIndex, resultURI)
        await dealsRepository.logEvent({
          dealId: deal.id,
          eventName: 'MilestoneSubmitted',
          eventData: { milestoneIndex, resultURI },
          blockNumber: event.blockNumber,
          txHash: event.transactionHash,
          logIndex: event.logIndex,
        })
      }
    } catch (error) {
      logger.error('Error handling MilestoneSubmitted:', error)
      throw error
    }
  }

  private async handleMilestoneApproved(
    escrowAddress: string,
    milestoneIndex: number,
    grossAmount: string,
    feeAmount: string,
    netAmount: string,
    event: any
  ) {
    try {
      const deal = await dealsRepository.getDealByEscrowAddress(escrowAddress)
      if (deal) {
        await dealsService.handleMilestoneApproved(deal.id, milestoneIndex, grossAmount, feeAmount, netAmount)
        await dealsRepository.logEvent({
          dealId: deal.id,
          eventName: 'MilestoneApproved',
          eventData: { milestoneIndex, grossAmount, feeAmount, netAmount },
          blockNumber: event.blockNumber,
          txHash: event.transactionHash,
          logIndex: event.logIndex,
        })
      }
    } catch (error) {
      logger.error('Error handling MilestoneApproved:', error)
      throw error
    }
  }

  private async handleDisputeOpened(escrowAddress: string, openedBy: string, reasonURI: string, event: any) {
    try {
      const deal = await dealsRepository.getDealByEscrowAddress(escrowAddress)
      if (deal) {
        await disputesService.openDispute({
          dealId: deal.id,
          openedBy,
          reasonURI,
          blockNumber: event.blockNumber,
          txHash: event.transactionHash,
        })
        await dealsRepository.logEvent({
          dealId: deal.id,
          eventName: 'DisputeOpened',
          eventData: { openedBy, reasonURI },
          blockNumber: event.blockNumber,
          txHash: event.transactionHash,
          logIndex: event.logIndex,
        })
      }
    } catch (error) {
      logger.error('Error handling DisputeOpened:', error)
      throw error
    }
  }

  private async handleDisputeResolvedToClient(escrowAddress: string, amount: string, event: any) {
    try {
      const deal = await dealsRepository.getDealByEscrowAddress(escrowAddress)
      if (deal) {
        await disputesService.handleDisputeResolvedToClient(deal.id, amount, event.transactionHash)
        await dealsRepository.logEvent({
          dealId: deal.id,
          eventName: 'DisputeResolvedToClient',
          eventData: { amount },
          blockNumber: event.blockNumber,
          txHash: event.transactionHash,
          logIndex: event.logIndex,
        })
      }
    } catch (error) {
      logger.error('Error handling DisputeResolvedToClient:', error)
      throw error
    }
  }

  private async handleDisputeResolvedToContractor(escrowAddress: string, amount: string, event: any) {
    try {
      const deal = await dealsRepository.getDealByEscrowAddress(escrowAddress)
      if (deal) {
        await disputesService.handleDisputeResolvedToContractor(deal.id, amount, event.transactionHash)
        await dealsRepository.logEvent({
          dealId: deal.id,
          eventName: 'DisputeResolvedToContractor',
          eventData: { amount },
          blockNumber: event.blockNumber,
          txHash: event.transactionHash,
          logIndex: event.logIndex,
        })
      }
    } catch (error) {
      logger.error('Error handling DisputeResolvedToContractor:', error)
      throw error
    }
  }

  private async handleDisputeResolvedSplit(
    escrowAddress: string,
    clientAmount: string,
    contractorAmount: string,
    event: any
  ) {
    try {
      const deal = await dealsRepository.getDealByEscrowAddress(escrowAddress)
      if (deal) {
        await disputesService.handleDisputeResolvedSplit(deal.id, clientAmount, contractorAmount, event.transactionHash)
        await dealsRepository.logEvent({
          dealId: deal.id,
          eventName: 'DisputeResolvedSplit',
          eventData: { clientAmount, contractorAmount },
          blockNumber: event.blockNumber,
          txHash: event.transactionHash,
          logIndex: event.logIndex,
        })
      }
    } catch (error) {
      logger.error('Error handling DisputeResolvedSplit:', error)
      throw error
    }
  }

  private async handleStatusChanged(escrowAddress: string, newStatus: number, event: any) {
    try {
      const deal = await dealsRepository.getDealByEscrowAddress(escrowAddress)
      if (deal) {
        await dealsService.handleStatusChanged(deal.id, newStatus)
        await dealsRepository.logEvent({
          dealId: deal.id,
          eventName: 'StatusChanged',
          eventData: { newStatus },
          blockNumber: event.blockNumber,
          txHash: event.transactionHash,
          logIndex: event.logIndex,
        })
      }
    } catch (error) {
      logger.error('Error handling StatusChanged:', error)
      throw error
    }
  }
}
