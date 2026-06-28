import { promises as fs } from 'fs'
import path from 'path'

import { logger } from '../utils/logger'

const STATE_DIR = path.resolve(process.cwd(), 'data')
const STATE_FILE = path.join(STATE_DIR, 'indexer-state.json')

type IndexerState = Record<string, number>

export class IndexerStateService {
  private cache: IndexerState | null = null

  private async ensureStateLoaded(): Promise<IndexerState> {
    if (this.cache) {
      return this.cache
    }

    try {
      const raw = await fs.readFile(STATE_FILE, 'utf-8')
      const parsed = JSON.parse(raw) as IndexerState
      this.cache = parsed
      return parsed
    } catch (error) {
      await fs.mkdir(STATE_DIR, { recursive: true })
      this.cache = {}
      return this.cache
    }
  }

  async getLastProcessedBlock(cursorKey: string): Promise<number | null> {
    const state = await this.ensureStateLoaded()
    return state[cursorKey] ?? null
  }

  async setLastProcessedBlock(cursorKey: string, blockNumber: number): Promise<void> {
    const state = await this.ensureStateLoaded()
    state[cursorKey] = blockNumber

    try {
      await fs.mkdir(STATE_DIR, { recursive: true })
      await fs.writeFile(STATE_FILE, JSON.stringify(state, null, 2), 'utf-8')
    } catch (error) {
      logger.error('Failed to persist indexer state:', error)
      throw error
    }
  }
}
