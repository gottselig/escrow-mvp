import { Router } from 'express'

import * as settingsController from '../controllers/settings.controller'

const router = Router()

router.get('/', settingsController.getSettings)
router.put('/:scope', settingsController.updateSettings)

export default router
