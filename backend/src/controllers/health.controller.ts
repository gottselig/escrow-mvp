import { Request, Response } from 'express'
import { ethers } from 'ethers'

import prisma from '../config/db'
import { config } from '../config/env'
import { logger } from '../utils/logger'

export const healthCheck = async (req: Request, res: Response) => {
  let dbStatus: 'ok' | 'error' = 'ok'
  let rpcStatus: 'ok' | 'error' = 'ok'

  try {
    await prisma.$queryRawUnsafe('SELECT 1')
  } catch (error) {
    dbStatus = 'error'
    logger.error('Health check DB probe failed:', error)
  }

  try {
    const provider = new ethers.JsonRpcProvider(config.rpcUrl)
    await provider.getBlockNumber()
  } catch (error) {
    rpcStatus = 'error'
    logger.error('Health check RPC probe failed:', error)
  }

  const isHealthy = dbStatus === 'ok' && rpcStatus === 'ok'
  const payload = {
    status: isHealthy ? 'ok' : 'degraded',
    services: {
      database: dbStatus,
      rpc: rpcStatus,
    },
    timestamp: new Date().toISOString(),
  }

  res.status(isHealthy ? 200 : 503).json(payload)
}
