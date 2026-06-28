'use client'

import { useQuery } from '@tanstack/react-query'

import { settingsApi } from '@/lib/api'

export function useSettings() {
  return useQuery({
    queryKey: ['settings'],
    staleTime: 60_000,
    queryFn: async () => {
      const response = await settingsApi.get()
      if (!response.success || !response.data) {
        throw new Error(response.error || 'Failed to fetch settings')
      }
      return response.data
    },
  })
}
