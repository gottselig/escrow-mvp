import { Request, Response } from 'express'

import { PagesService } from '../services/pages.service'
import { SettingsService } from '../services/settings.service'
import { logger } from '../utils/logger'

const pagesService = new PagesService()
const settingsService = new SettingsService()

export const listPages = async (_req: Request, res: Response) => {
  try {
    const pages = await pagesService.list()
    return res.json({ success: true, data: pages })
  } catch (error) {
    logger.error('Error fetching pages:', error)
    return res.status(500).json({ success: false, error: 'Failed to fetch pages' })
  }
}

export const getPage = async (req: Request, res: Response) => {
  try {
    const page = await pagesService.get(req.params.slug)
    if (!page) {
      return res.status(404).json({ success: false, error: 'Page not found' })
    }

    return res.json({ success: true, data: page })
  } catch (error) {
    logger.error('Error fetching page:', error)
    return res.status(500).json({ success: false, error: 'Failed to fetch page' })
  }
}

export const upsertPage = async (req: Request, res: Response) => {
  try {
    const { slug } = req.params
    const { data, address, message, signature, dataHash } = req.body
    const expectedHash = settingsService.hashData(data)
    const scope = `page:${slug}`

    if (expectedHash !== dataHash) {
      return res.status(400).json({ success: false, error: 'Invalid page payload hash' })
    }

    const isAdmin = await settingsService.verifyAdminSignature({
      address,
      message,
      signature,
      dataHash,
      scope,
    })

    if (!isAdmin) {
      return res.status(403).json({ success: false, error: 'Admin signature required' })
    }

    const page = await pagesService.upsert(slug, data)
    return res.json({ success: true, data: page })
  } catch (error) {
    logger.error('Error saving page:', error)
    return res.status(500).json({ success: false, error: 'Failed to save page' })
  }
}
