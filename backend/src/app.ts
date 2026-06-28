import express from 'express'
import cors from 'cors'
import dealsRoutes from './routes/deals.routes'
import disputesRoutes from './routes/disputes.routes'
import healthRoutes from './routes/health.routes'
import metadataRoutes from './routes/metadata.routes'
import pagesRoutes from './routes/pages.routes'
import settingsRoutes from './routes/settings.routes'

const app = express()

app.use(cors())
app.use(express.json())

app.get('/', (_req, res) => {
  res.json({
    name: 'Escrow MVP API',
    version: '1.0.0',
    endpoints: {
      health: '/api/health',
      deals: '/api/deals',
      disputes: '/api/disputes',
      pages: '/api/pages',
      settings: '/api/settings',
    },
  })
})

app.use('/api/deals', dealsRoutes)
app.use('/api/disputes', disputesRoutes)
app.use('/api/metadata', metadataRoutes)
app.use('/api/pages', pagesRoutes)
app.use('/api/settings', settingsRoutes)
app.use('/api/health', healthRoutes)

export default app
