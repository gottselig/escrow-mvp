import request from 'supertest'

import app from '../app'

const mockQueryRawUnsafe = jest.fn()
const mockGetBlockNumber = jest.fn()

jest.mock('../config/db', () => ({
  __esModule: true,
  default: {
    $queryRawUnsafe: (...args: unknown[]) => mockQueryRawUnsafe(...args),
  },
}))

jest.mock('../config/env', () => ({
  config: {
    rpcUrl: 'http://127.0.0.1:8545',
  },
}))

jest.mock('ethers', () => ({
  ethers: {
    JsonRpcProvider: jest.fn().mockImplementation(() => ({
      getBlockNumber: (...args: unknown[]) => mockGetBlockNumber(...args),
    })),
  },
}))

describe('GET /api/health', () => {
  beforeEach(() => {
    mockQueryRawUnsafe.mockReset()
    mockGetBlockNumber.mockReset()
  })

  it('returns 200 when DB and RPC are available', async () => {
    mockQueryRawUnsafe.mockResolvedValueOnce([{ '?column?': 1 }])
    mockGetBlockNumber.mockResolvedValueOnce(123)

    const response = await request(app).get('/api/health')

    expect(response.status).toBe(200)
    expect(response.body.status).toBe('ok')
    expect(response.body.services).toEqual({
      database: 'ok',
      rpc: 'ok',
    })
    expect(response.body.timestamp).toEqual(expect.any(String))
  })

  it('returns 503 when DB probe fails', async () => {
    mockQueryRawUnsafe.mockRejectedValueOnce(new Error('db unavailable'))
    mockGetBlockNumber.mockResolvedValueOnce(123)

    const response = await request(app).get('/api/health')

    expect(response.status).toBe(503)
    expect(response.body.status).toBe('degraded')
    expect(response.body.services).toEqual({
      database: 'error',
      rpc: 'ok',
    })
  })

  it('returns 503 when RPC probe fails', async () => {
    mockQueryRawUnsafe.mockResolvedValueOnce([{ '?column?': 1 }])
    mockGetBlockNumber.mockRejectedValueOnce(new Error('rpc unavailable'))

    const response = await request(app).get('/api/health')

    expect(response.status).toBe(503)
    expect(response.body.status).toBe('degraded')
    expect(response.body.services).toEqual({
      database: 'ok',
      rpc: 'error',
    })
  })
})
