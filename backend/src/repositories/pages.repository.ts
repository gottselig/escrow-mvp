import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

export class PagesRepository {
  async list() {
    return prisma.cmsPage.findMany({ orderBy: { updatedAt: 'desc' } })
  }

  async getBySlug(slug: string) {
    return prisma.cmsPage.findUnique({ where: { slug } })
  }

  async upsert(slug: string, data: { title: string; content: string; access: string; published: boolean }) {
    return prisma.cmsPage.upsert({
      where: { slug },
      create: { slug, ...data },
      update: data,
    })
  }
}
