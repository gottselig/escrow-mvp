import { MetadataRepository } from '../repositories/metadata.repository'

const repository = new MetadataRepository()

export function toMetadataUri(id: string) {
  return `metadata://${id}`
}

export function parseMetadataUri(uri: string) {
  if (!uri.startsWith('metadata://')) return null
  return uri.slice('metadata://'.length)
}

export class MetadataService {
  async create(type: string, data: unknown) {
    const record = await repository.create(type, data)
    return {
      id: record.id,
      type: record.type,
      uri: toMetadataUri(record.id),
      data: record.data,
      createdAt: record.createdAt.toISOString(),
      updatedAt: record.updatedAt.toISOString(),
    }
  }

  async get(idOrUri: string) {
    const id = parseMetadataUri(idOrUri) || idOrUri
    const record = await repository.getById(id)
    if (!record) return null

    return {
      id: record.id,
      type: record.type,
      uri: toMetadataUri(record.id),
      data: record.data,
      createdAt: record.createdAt.toISOString(),
      updatedAt: record.updatedAt.toISOString(),
    }
  }
}
