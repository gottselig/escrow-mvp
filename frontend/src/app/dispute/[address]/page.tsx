import { redirect } from 'next/navigation'

export default async function DisputeRedirect({ params }: { params: Promise<{ address: string }> }) {
  const { address } = await params
  redirect(`/deals/${address}`)
}
