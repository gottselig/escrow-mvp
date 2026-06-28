import { DealDetailClient } from './DealDetailClient'

type DealDetailPageProps = {
  params: Promise<{ address: string }>
}

export default async function DealDetailPage({ params }: DealDetailPageProps) {
  const { address } = await params
  return <DealDetailClient address={address} />
}
