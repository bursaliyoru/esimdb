import type { CollectionConfig } from 'payload'

export const Plans: CollectionConfig = {
  slug: 'plans',
  admin: { useAsTitle: 'name', group: 'Catalog', defaultColumns: ['name', 'provider', 'priceUsd', 'dataMb', 'validityDays', 'active'] },
  access: { read: () => true },
  fields: [
    { name: 'key', type: 'text', required: true, unique: true, index: true, admin: { description: 'providerSlug:externalId', readOnly: true } },
    { name: 'provider', type: 'relationship', relationTo: 'providers', required: true, index: true },
    { name: 'externalId', type: 'text', required: true },
    { name: 'name', type: 'text', required: true },
    { name: 'scope', type: 'select', options: ['single', 'regional', 'global'], defaultValue: 'single', required: true },
    { name: 'region', type: 'relationship', relationTo: 'regions' },
    { name: 'countries', type: 'relationship', relationTo: 'countries', hasMany: true, index: true },
    { name: 'dataMb', type: 'number', admin: { description: 'Empty = unlimited' } },
    { name: 'dailyMb', type: 'number', admin: { description: 'Set for "X GB per day" plans' } },
    { name: 'validityDays', type: 'number', required: true },
    { name: 'priceUsd', type: 'number', required: true, index: true },
    { name: 'originalPriceUsd', type: 'number' },
    { name: 'price', type: 'number' },
    { name: 'currency', type: 'text', defaultValue: 'USD' },
    { name: 'network', type: 'text' },
    {
      type: 'row',
      fields: [
        { name: 'fiveG', type: 'checkbox', defaultValue: false },
        { name: 'hotspot', type: 'checkbox', defaultValue: true },
        { name: 'phoneNumber', type: 'checkbox', defaultValue: false },
        { name: 'newUsersOnly', type: 'checkbox', defaultValue: false },
      ],
    },
    { name: 'url', type: 'text' },
    { name: 'active', type: 'checkbox', defaultValue: true, index: true },
    { name: 'lastSeenAt', type: 'date' },
    { name: 'source', type: 'select', options: ['scraper', 'manual', 'seed'], defaultValue: 'manual' },
  ],
}
