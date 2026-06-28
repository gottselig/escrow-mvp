import { PageClient } from './PageClient'

type PageProps = {
  params: Promise<{ slug: string }>
}

export default async function CmsPageRoute({ params }: PageProps) {
  const { slug } = await params
  return <PageClient slug={slug} />
}
