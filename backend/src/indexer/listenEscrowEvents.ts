// Listen for escrow events
import { IndexerService } from '../services/indexer.service'
import { logger } from '../utils/logger'
import { config } from '../config/env'

// ABI imports - these would be imported from contract deployments
// For now, using minimal definitions; in production use the full ABI JSON
const ESCROW_ABI = [
  'event DealAccepted(address indexed contractor)',
  'event DealFunded(address indexed client, uint256 amount)',
  'event DealCancelled(address indexed client)',
  'event MilestoneSubmitted(uint256 indexed milestoneId, string resultURI)',
  'event MilestoneApproved(uint256 indexed milestoneId, uint256 grossAmount, uint256 feeAmount, uint256 netAmount)',
  'event DisputeOpened(address indexed openedBy, string reasonURI)',
  'event DisputeResolvedToClient(uint256 amount)',
  'event DisputeResolvedToContractor(uint256 amount)',
  'event DisputeResolvedSplit(uint256 clientAmount, uint256 contractorAmount)',
  'event StatusChanged(uint8 oldStatus, uint8 newStatus)',
]

export async function startEscrowEventListener() {
  try {
    logger.info('Starting Escrow event listener...')
    const indexer = new IndexerService()
    indexer.setAbis([], ESCROW_ABI as any)

    // These will be called from the factory listener as new escrows are created
    logger.info('Escrow event listener initialized (will attach to escrows as they are created)')
    return indexer
  } catch (error) {
    logger.error('Failed to start Escrow event listener:', error)
    throw error
  }
}

export { IndexerService }
