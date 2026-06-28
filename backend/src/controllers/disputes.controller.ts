import { Request, Response } from 'express'
import { DisputesService } from '../services/disputes.service'
import { ApiResponse, ApiListResponse } from '../types/api'
import { logger } from '../utils/logger'

const disputesService = new DisputesService()

/**
 * GET /api/disputes - Get all disputes with pagination
 */
export const getDisputes = async (req: Request, res: Response) => {
  try {
    const limit = Math.min(parseInt(req.query.limit as string) || 50, 100)
    const offset = parseInt(req.query.offset as string) || 0

    const { disputes, total } = await disputesService.getAllDisputes(limit, offset)

    const response: ApiListResponse<any> = {
      success: true,
      data: disputes,
      total,
      offset,
      limit,
    }

    res.json(response)
  } catch (error) {
    logger.error('Error fetching disputes:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to fetch disputes',
    })
  }
}

/**
 * GET /api/disputes/active - Get active (unresolved) disputes
 */
export const getActiveDisputes = async (req: Request, res: Response) => {
  try {
    const limit = Math.min(parseInt(req.query.limit as string) || 50, 100)
    const offset = parseInt(req.query.offset as string) || 0

    const { disputes, total } = await disputesService.getActiveDisputes(limit, offset)

    const response: ApiListResponse<any> = {
      success: true,
      data: disputes,
      total,
      offset,
      limit,
    }

    res.json(response)
  } catch (error) {
    logger.error('Error fetching active disputes:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to fetch disputes',
    })
  }
}

/**
 * GET /api/disputes/deal/:dealId - Get disputes for a specific deal
 */
export const getDisputesByDeal = async (req: Request, res: Response) => {
  try {
    const { dealId } = req.params

    const disputes = await disputesService.getDisputesByDealId(dealId)

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

/**
 * POST /api/disputes - Create/open a new dispute
 * This endpoint is called by the on-chain indexer when DisputeOpened event is emitted
 */
export const createDispute = async (req: Request, res: Response) => {
  try {
    const { dealId, openedBy, reasonURI, blockNumber, txHash } = req.body

    // Validate required fields
    if (!dealId || !openedBy) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: dealId, openedBy',
      })
    }

    const dispute = await disputesService.openDispute({
      dealId,
      openedBy,
      reasonURI,
      blockNumber,
      txHash,
    })

    const response: ApiResponse<any> = {
      success: true,
      data: dispute,
    }

    res.status(201).json(response)
  } catch (error) {
    logger.error('Error creating dispute:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to create dispute',
    })
  }
}

/**
 * GET /api/disputes/:id - Get a single dispute
 */
export const getDisputeById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params

    const dispute = await disputesService.getDisputeById(id)

    if (!dispute) {
      return res.status(404).json({
        success: false,
        error: 'Dispute not found',
      })
    }

    const response: ApiResponse<any> = {
      success: true,
      data: dispute,
    }

    res.json(response)
  } catch (error) {
    logger.error('Error fetching dispute:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to fetch dispute',
    })
  }
}
