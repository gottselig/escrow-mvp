import app from './app'
import { startFactoryEventListener } from './indexer/listenFactoryEvents'
import { logger } from './utils/logger'
import dotenv from 'dotenv'
import fs from 'fs'
import path from 'path'

dotenv.config()

const envCandidates = [
  path.resolve(process.cwd(), '.env.local'),
  path.resolve(process.cwd(), 'backend/.env.local'),
  path.resolve(__dirname, '../.env.local'),
]

for (const envPath of envCandidates) {
  if (fs.existsSync(envPath)) {
    dotenv.config({ path: envPath, override: true })
  }
}

const PORT = process.env.PORT || 3001
const FACTORY_ADDRESS = process.env.ESCROW_FACTORY_ADDRESS || process.env.NEXT_PUBLIC_ESCROW_FACTORY_ADDRESS
const DEPLOY_BLOCK =
  process.env.ESCROW_FACTORY_DEPLOY_BLOCK || process.env.NEXT_PUBLIC_ESCROW_FACTORY_DEPLOY_BLOCK

app.listen(PORT, async () => {
  logger.info(`Server running on port ${PORT}`)

  // Start the indexer if factory address is configured
  if (FACTORY_ADDRESS) {
    try {
      const fromBlock = DEPLOY_BLOCK ? parseInt(DEPLOY_BLOCK) : 0
      logger.info(`Initializing event indexer for factory at ${FACTORY_ADDRESS} from block ${fromBlock}`)
      await startFactoryEventListener(FACTORY_ADDRESS, fromBlock)
      logger.info('Event indexer successfully initialized')
    } catch (error) {
      logger.error('Failed to initialize event indexer:', error)
      // Don't fail the server startup if indexer fails
    }
  } else {
    logger.warn('ESCROW_FACTORY_ADDRESS not configured. Event indexer will not start.')
  }
})
