import type { CollectionConfig } from 'payload'

export const Regions: CollectionConfig = {
  slug: 'regions',
  admin: { useAsTitle: 'name', group: 'Catalog' },
  access: { read: () => true },
  fields: [
    { name: 'name', type: 'text', required: true },
    { name: 'slug', type: 'text', required: true, unique: true, index: true },
    { name: 'countryCount', type: 'number', admin: { description: 'Number of countries the provider plans in this region usually cover.' } },
  ],
}
