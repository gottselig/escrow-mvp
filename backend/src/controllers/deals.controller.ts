import { Request, Response } from 'express'
import { DealsService } from '../services/deals.service'
import { DisputesService } from '../services/disputes.service'
import { ApiResponse, ApiListResponse } from '../types/api'
import { logger } from '../utils/logger'

const dealsService = new DealsService()
const disputesService = new DisputesService()

/**
 * GET /api/deals - Get all deals with pagination
 */
export const getDeals = async (req: Request, res: Response) => {
  try {
    const limit = Math.min(parseInt(req.query.limit as string) || 50, 100)
    const offset = parseInt(req.query.offset as string) || 0
    const status = req.query.status as string | undefined
    const client = req.query.client as string | undefined
    const contractor = req.query.contractor as string | undefined

    const { deals, total } = await dealsService.getAllDeals(limit, offset, { status, client, contractor })

    const response: ApiListResponse<any> = {
      success: true,
      data: deals,
      total,
      offset,
      limit,
    }

    res.json(response)
  } catch (error) {
    logger.error('Error fetching deals:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to fetch deals',
    })
  }
}

/**
 * GET /api/deals/:address - Get a single deal by escrow address
 */
export const getDealByAddress = async (req: Request, res: Response) => {
  try {
    const { address } = req.params
    const deal = await dealsService.getDealByEscrowAddress(address)

    if (!deal) {
      return res.status(404).json({
        success: false,
        error: 'Deal not found',
      })
    }

    const response: ApiResponse<any> = {
      success: true,
      data: deal,
    }

    res.json(response)
  } catch (error) {
    logger.error('Error fetching deal:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to fetch deal',
    })
  }
}

/**
 * GET /api/deals/client/:address - Get deals by client address
 */
export const getDealsByClient = async (req: Request, res: Response) => {
  try {
    const { address } = req.params
    const limit = Math.min(parseInt(req.query.limit as string) || 50, 100)
    const offset = parseInt(req.query.offset as string) || 0

    const { deals, total } = await dealsService.getDealsByClient(address, limit, offset)

    const response: ApiListResponse<any> = {
      success: true,
      data: deals,
      total,
      offset,
      limit,
    }

    res.json(response)
  } catch (error) {
    logger.error('Error fetching client deals:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to fetch deals',
    })
  }
}

/**
 * GET /api/deals/contractor/:address - Get deals by contractor address
 */
export const getDealsByContractor = async (req: Request, res: Response) => {
  try {
    const { address } = req.params
    const limit = Math.min(parseInt(req.query.limit as string) || 50, 100)
    const offset = parseInt(req.query.offset as string) || 0

    const { deals, total } = await dealsService.getDealsByContractor(address, limit, offset)

    const response: ApiListResponse<any> = {
      success: true,
      data: deals,
      total,
      offset,
      limit,
    }

    res.json(response)
  } catch (error) {
    logger.error('Error fetching contractor deals:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to fetch deals',
    })
  }
}

/**
 * POST /api/deals - Create a new deal (would be called by indexer, not frontend)
 */
export const createDeal = async (req: Request, res: Response) => {
  try {
    if (req.body.verifyOnChain) {
      const { escrowAddress, factoryAddress, txHash, blockNumber } = req.body

      if (!escrowAddress || !factoryAddress) {
        return res.status(400).json({
          success: false,
          error: 'Missing required fields: escrowAddress, factoryAddress',
        })
      }

      const deal = await dealsService.verifyAndCreateDeal({
        escrowAddress,
        factoryAddress,
        txHash,
        blockNumber,
      })

      const response: ApiResponse<any> = {
        success: true,
        data: deal,
      }

      return res.status(201).json(response)
    }

    const {
      escrowAddress,
      factoryAddress,
      client,
      contractor,
      arbiter,
      treasury,
      token,
      totalAmount,
      feeBps,
      metadataURI,
      milestones,
    } = req.body

    // Validate required fields
    if (!escrowAddress || !client || !token || !totalAmount) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: escrowAddress, client, token, totalAmount',
      })
    }

    const deal = await dealsService.createDeal({
      escrowAddress,
      factoryAddress,
      client,
      contractor: contractor || '',
      arbiter: arbiter || '',
      treasury: treasury || '',
      token,
      totalAmount,
      feeBps: feeBps || 500,
      metadataURI,
      milestones,
    })

    const response: ApiResponse<any> = {
      success: true,
      data: deal,
    }

    res.status(201).json(response)
  } catch (error) {
    logger.error('Error creating deal:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to create deal',
    })
  }
}

/**
 * GET /api/deals/:address/milestones - Get milestones for a deal by escrow address
 */
export const getMilestonesByAddress = async (req: Request, res: Response) => {
  try {
    const { address } = req.params
    const deal = await dealsService.getDealByEscrowAddress(address)

    if (!deal) {
      return res.status(404).json({
        success: false,
        error: 'Deal not found',
      })
    }

    const response: ApiResponse<any> = {
      success: true,
      data: deal.milestones,
    }

    res.json(response)
  } catch (error) {
    logger.error('Error fetching milestones:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to fetch milestones',
    })
  }
}

/**
 * GET /api/deals/:address/disputes - Get disputes for a deal by escrow address
 */
export const getDisputesByAddress = async (req: Request, res: Response) => {
  try {
    const { address } = req.params
    const deal = await dealsService.getDealByEscrowAddress(address)

    if (!deal) {
      return res.status(404).json({
        success: false,
        error: 'Deal not found',
      })
    }

    const disputes = await disputesService.getDisputesByDealId(deal.id)

    const response: ApiResponse<any> = {
      success: true,
      data: disputes,
    }

    res.json(response)
  } catch (error) {
    logger.error('Error fetching deal disputes:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to fetch disputes',
    })
  }
}
