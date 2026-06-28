import { Router } from 'express'
import * as dealsController from '../controllers/deals.controller'

const router = Router()

// GET /api/deals - All deals with pagination and filters
router.get('/', dealsController.getDeals)

// POST /api/deals - Create a new deal (called by indexer)
router.post('/', dealsController.createDeal)

// GET /api/deals/client/:address - Get deals by client address
router.get('/client/:address', dealsController.getDealsByClient)

// GET /api/deals/contractor/:address - Get deals by contractor address
router.get('/contractor/:address', dealsController.getDealsByContractor)

// GET /api/deals/:address/milestones - Get milestones for a deal
router.get('/:address/milestones', dealsController.getMilestonesByAddress)

// GET /api/deals/:address/disputes - Get disputes for a deal
router.get('/:address/disputes', dealsController.getDisputesByAddress)

// GET /api/deals/:address - Get a specific deal by escrow address
router.get('/:address', dealsController.getDealByAddress)

export default router
