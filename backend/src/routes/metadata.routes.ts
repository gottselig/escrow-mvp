import { Router } from 'express'

import * as metadataController from '../controllers/metadata.controller'

const router = Router()

router.post('/', metadataController.createMetadata)
router.get('/resolve', metadataController.getMetadata)
router.get('/:id', metadataController.getMetadata)

export default router
