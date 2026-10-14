import type { CollectionConfig } from 'payload'

export const Clicks: CollectionConfig = {
  slug: 'clicks',
  admin: { group: 'Data', defaultColumns: ['provider', 'plan', 'source', 'createdAt'] },
  fields: [
    { name: 'provider', type: 'relationship', relationTo: 'providers', required: true },
    { name: 'plan', type: 'relationship', relationTo: 'plans' },
    { name: 'source', type: 'text', admin: { description: 'Page the click came from' } },
  ],
}
