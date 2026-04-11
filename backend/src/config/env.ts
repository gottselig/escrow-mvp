import dotenv from 'dotenv'

dotenv.config()

export const config = {
  databaseUrl: process.env.DATABASE_URL!,
  rpcUrl: process.env.RPC_URL!,
  privateKey: process.env.PRIVATE_KEY!,
}
