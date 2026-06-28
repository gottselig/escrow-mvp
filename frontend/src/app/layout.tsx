import type { Metadata } from 'next'
import '@rainbow-me/rainbowkit/styles.css'
import '../styles/globals.css'
import { Providers } from './providers'
import { AppNav } from '@/components/AppNav'

export const metadata: Metadata = {
  title: 'Escrow MVP',
  description: 'Escrow deals with ETH or MosUSDC payments',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>
        <Providers>
          <AppNav />
          {children}
        </Providers>
      </body>
    </html>
  )
}
