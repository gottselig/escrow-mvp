import { PagesRepository } from '../repositories/pages.repository'

const repository = new PagesRepository()

export type PageAccess = 'PUBLIC' | 'AUTHENTICATED'

function normalizeSlug(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-_]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

function normalizeAccess(value: unknown): PageAccess {
  return value === 'AUTHENTICATED' ? 'AUTHENTICATED' : 'PUBLIC'
}

export class PagesService {
  async list() {
    const pages = await repository.list()
    return pages.map((page) => this.format(page))
  }

  async get(slug: string) {
    const normalizedSlug = normalizeSlug(slug)
    if (!normalizedSlug) return null

    const page = await repository.getBySlug(normalizedSlug)
    if (!page || !page.published) return null
    return this.format(page)
  }

  async upsert(slug: string, data: unknown) {
    const normalizedSlug = normalizeSlug(slug)
    if (!normalizedSlug) {
      throw new Error('Invalid page slug')
    }

    const source = typeof data === 'object' && data !== null ? (data as Record<string, unknown>) : {}
    const page = await repository.upsert(normalizedSlug, {
      title: this.stringValue(source.title, normalizedSlug),
      content: this.stringValue(source.content, ''),
      access: normalizeAccess(source.access),
      published: source.published !== false,
    })

    return this.format(page)
  }

  private stringValue(value: unknown, fallback: string) {
    const text = typeof value === 'string' ? value.trim() : ''
    return text || fallback
  }

  private format(page: any) {
    return {
      id: page.id,
      slug: page.slug,
      title: page.title,
      content: page.content,
      access: page.access as PageAccess,
      published: page.published,
      createdAt: page.createdAt.toISOString(),
      updatedAt: page.updatedAt.toISOString(),
    }
  }
}
