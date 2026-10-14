import type { CollectionConfig } from 'payload'

export const PriceSnapshots: CollectionConfig = {
  slug: 'price-snapshots',
  admin: { group: 'Data', defaultColumns: ['plan', 'priceUsd', 'capturedAt'] },
  access: { read: () => true },
  fields: [
    { name: 'plan', type: 'relationship', relationTo: 'plans', required: true, index: true },
    { name: 'priceUsd', type: 'number', required: true },
    { name: 'capturedAt', type: 'date', required: true },
  ],
}
