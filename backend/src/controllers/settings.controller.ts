import { Request, Response } from 'express'

import { SettingsService } from '../services/settings.service'
import { logger } from '../utils/logger'

const settingsService = new SettingsService()

export const getSettings = async (_req: Request, res: Response) => {
  try {
    const settings = await settingsService.getAll()
    return res.json({ success: true, data: settings })
  } catch (error) {
    logger.error('Error fetching settings:', error)
    return res.status(500).json({ success: false, error: 'Failed to fetch settings' })
  }
}

export const updateSettings = async (req: Request, res: Response) => {
  try {
    const { scope } = req.params
    const { data, address, message, signature, dataHash } = req.body
    const expectedHash = settingsService.hashData(data)

    if (expectedHash !== dataHash) {
      return res.status(400).json({ success: false, error: 'Invalid settings payload hash' })
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

    const result = await settingsService.update(scope, data)
    return res.json({ success: true, data: result })
  } catch (error) {
    logger.error('Error updating settings:', error)
    return res.status(500).json({ success: false, error: 'Failed to update settings' })
  }
}
