import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

export class SettingsRepository {
  async get(key: string) {
    return prisma.appSetting.findUnique({ where: { key } })
  }

  async getMany(keys: string[]) {
    return prisma.appSetting.findMany({ where: { key: { in: keys } } })
  }

  async upsert(key: string, data: unknown) {
    return prisma.appSetting.upsert({
      where: { key },
      create: { key, data: data as object },
      update: { data: data as object },
    })
  }
}
