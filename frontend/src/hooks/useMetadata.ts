'use client'

import { useQuery } from '@tanstack/react-query'

import { metadataApi } from '@/lib/api'

export type DealMetadata = {
  title?: string
  description?: string
  category?: string
  attachments?: Array<{ name: string; uri: string }>
}

export type MilestoneMetadata = {
  title?: string
  description?: string
  acceptanceCriteria?: string[]
  deliverables?: string[]
}

export function useMetadata<T = any>(uri?: string | null) {
  return useQuery({
    queryKey: ['metadata', uri],
    enabled: Boolean(uri?.startsWith('metadata://')),
    staleTime: 60_000,
    retry: false,
    queryFn: async () => {
      if (!uri) return undefined
      const response = await metadataApi.get(uri)
      return response.data?.data as T | undefined
    },
  })
}
