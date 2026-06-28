'use client'

import { getDefaultConfig } from '@rainbow-me/rainbowkit'
import { http } from 'wagmi'
import { hardhat, sepolia } from 'wagmi/chains'

export const wagmiConfig = getDefaultConfig({
  appName: 'Escrow MVP',
  projectId: process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || 'escrow-mvp-local',
  chains: [sepolia, hardhat],
  transports: {
    [sepolia.id]: http(process.env.NEXT_PUBLIC_RPC_URL),
    [hardhat.id]: http(),
  },
  ssr: true,
})
