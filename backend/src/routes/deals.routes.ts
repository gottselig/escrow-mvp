import { Router } from 'express'
import * as dealsController from '../controllers/deals.controller'

const router = Router()

router.get('/', dealsController.getDeals)
router.post('/', dealsController.createDeal)

export default router
