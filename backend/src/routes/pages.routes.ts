import { Router } from 'express'

import * as pagesController from '../controllers/pages.controller'

const router = Router()

router.get('/', pagesController.listPages)
router.get('/:slug', pagesController.getPage)
router.put('/:slug', pagesController.upsertPage)

export default router
