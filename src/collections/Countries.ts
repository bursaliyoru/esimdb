import type { CollectionConfig } from 'payload'

export const Countries: CollectionConfig = {
  slug: 'countries',
  admin: { useAsTitle: 'name', group: 'Catalog', defaultColumns: ['name', 'iso2', 'popular'] },
  access: { read: () => true },
  fields: [
    { name: 'name', type: 'text', required: true },
    { name: 'slug', type: 'text', required: true, unique: true, index: true },
    { name: 'iso2', type: 'text', required: true, unique: true, index: true, maxLength: 2 },
    { name: 'flag', type: 'text' },
    { name: 'popular', type: 'checkbox', defaultValue: false },
    { name: 'regions', type: 'relationship', relationTo: 'regions', hasMany: true },
    { name: 'networks', type: 'array', fields: [{ name: 'name', type: 'text', required: true }] },
  ],
}
