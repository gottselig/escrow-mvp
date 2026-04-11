import express from 'express'
import cors from 'cors'
import dealsRoutes from './routes/deals.routes'
import disputesRoutes from './routes/disputes.routes'
import healthRoutes from './routes/health.routes'

const app = express()

app.use(cors())
app.use(express.json())

app.use('/api/deals', dealsRoutes)
app.use('/api/disputes', disputesRoutes)
app.use('/api/health', healthRoutes)

export default app
