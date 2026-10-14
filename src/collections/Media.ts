import type { CollectionConfig } from 'payload'

export const Media: CollectionConfig = {
  slug: 'media',
  admin: { group: 'Admin' },
  access: { read: () => true },
  upload: { staticDir: 'public/media', mimeTypes: ['image/*'] },
  fields: [{ name: 'alt', type: 'text' }],
}
