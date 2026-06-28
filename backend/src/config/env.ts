import dotenv from 'dotenv'
import fs from 'fs'
import path from 'path'

dotenv.config()

const envCandidates = [
  path.resolve(process.cwd(), '.env.local'),
  path.resolve(process.cwd(), 'backend/.env.local'),
  path.resolve(__dirname, '../../.env.local'),
]

for (const envPath of envCandidates) {
  if (fs.existsSync(envPath)) {
    dotenv.config({ path: envPath, override: true })
  }
}

export const config = {
  databaseUrl: process.env.DATABASE_URL!,
  rpcUrl: process.env.RPC_URL || process.env.NEXT_PUBLIC_RPC_URL!,
  privateKey: process.env.PRIVATE_KEY!,
  factoryAddress: process.env.ESCROW_FACTORY_ADDRESS || process.env.NEXT_PUBLIC_ESCROW_FACTORY_ADDRESS,
}
