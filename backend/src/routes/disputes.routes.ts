import { Router } from 'express'
import * as disputesController from '../controllers/disputes.controller'

const router = Router()

router.get('/', disputesController.getDisputes)
router.post('/', disputesController.createDispute)

export default router
