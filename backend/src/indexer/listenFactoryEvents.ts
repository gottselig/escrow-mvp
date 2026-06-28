// Listen for factory events
import { IndexerService } from '../services/indexer.service'
import { logger } from '../utils/logger'
import { config } from '../config/env'

// ABI for EscrowFactory - using event signatures
const FACTORY_ABI = [
  'event EscrowCreated(address indexed escrow, address indexed client, address indexed contractor, address arbiter, address token, uint256 totalAmount, string metadataURI)',
  'event TreasuryUpdated(address indexed oldTreasury, address indexed newTreasury)',
  'event DefaultArbiterUpdated(address indexed oldArbiter, address indexed newArbiter)',
  'event FeeBpsUpdated(uint96 oldFeeBps, uint96 newFeeBps)',
  'event AllowedTokenUpdated(address indexed oldToken, address indexed newToken)',
  'event PaymentTokenUpdated(address indexed oldToken, address indexed newToken)',
  'event MosUSDCUpdated(address indexed oldToken, address indexed newToken)',
  'event FeesWithdrawn(address indexed token, address indexed recipient, uint256 amount)',
]

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

let indexer: IndexerService

export async function startFactoryEventListener(
  factoryAddress: string,
  fromBlock: number = 0
): Promise<IndexerService> {
  try {
    logger.info(`Starting Factory event listener for ${factoryAddress}`)
    indexer = new IndexerService()
    indexer.setAbis(FACTORY_ABI as any, ESCROW_ABI as any)

    // Start listening for new EscrowCreated events
    await indexer.listenToFactoryEvents(factoryAddress, fromBlock)

    logger.info('Factory event listener started successfully')
    return indexer
  } catch (error) {
    logger.error('Failed to start Factory event listener:', error)
    throw error
  }
}

export function getIndexer(): IndexerService {
  if (!indexer) {
    throw new Error('IndexerService not initialized. Call startFactoryEventListener first.')
  }
  return indexer
}

export { IndexerService }
