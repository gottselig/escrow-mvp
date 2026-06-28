import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

export class MetadataRepository {
  async create(type: string, data: unknown) {
    return prisma.metadataRecord.create({
      data: {
        type,
        data: data as object,
      },
    })
  }

  async getById(id: string) {
    return prisma.metadataRecord.findUnique({ where: { id } })
  }
}
