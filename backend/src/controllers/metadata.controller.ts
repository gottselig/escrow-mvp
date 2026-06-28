import { Request, Response } from 'express'

import { MetadataService } from '../services/metadata.service'
import { logger } from '../utils/logger'

const metadataService = new MetadataService()

export const createMetadata = async (req: Request, res: Response) => {
  try {
    const { type, data } = req.body

    if (!type || typeof type !== 'string' || data === undefined) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: type, data',
      })
    }

    const record = await metadataService.create(type, data)
    return res.status(201).json({ success: true, data: record })
  } catch (error) {
    logger.error('Error creating metadata:', error)
    return res.status(500).json({ success: false, error: 'Failed to create metadata' })
  }
}

export const getMetadata = async (req: Request, res: Response) => {
  try {
    const idOrUri = (req.query.uri as string | undefined) || req.params.id
    const record = await metadataService.get(idOrUri)

    if (!record) {
      return res.status(404).json({ success: false, error: 'Metadata not found' })
    }

    return res.json({ success: true, data: record })
  } catch (error) {
    logger.error('Error fetching metadata:', error)
    return res.status(500).json({ success: false, error: 'Failed to fetch metadata' })
  }
}
