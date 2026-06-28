import { Router } from 'express'
import * as disputesController from '../controllers/disputes.controller'

const router = Router()

// GET /api/disputes - All disputes with pagination
router.get('/', disputesController.getDisputes)

// POST /api/disputes - Create/open a new dispute (called by indexer)
router.post('/', disputesController.createDispute)

// GET /api/disputes/active - Get active (unresolved) disputes
router.get('/active', disputesController.getActiveDisputes)

// GET /api/disputes/deal/:dealId - Get disputes for a specific deal
router.get('/deal/:dealId', disputesController.getDisputesByDeal)

// GET /api/disputes/:id - Get a specific dispute
router.get('/:id', disputesController.getDisputeById)

export default router
