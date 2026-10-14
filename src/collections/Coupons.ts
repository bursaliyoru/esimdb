import type { CollectionConfig } from 'payload'

export const Coupons: CollectionConfig = {
  slug: 'coupons',
  admin: { useAsTitle: 'code', group: 'Marketing', defaultColumns: ['code', 'provider', 'discountLabel', 'expiresAt', 'exclusive'] },
  access: { read: () => true },
  fields: [
    { name: 'provider', type: 'relationship', relationTo: 'providers', required: true, index: true },
    { name: 'code', type: 'text', required: true },
    { name: 'title', type: 'text', required: true, admin: { description: 'e.g. "10% off your first eSIM"' } },
    {
      type: 'row',
      fields: [
        { name: 'discountType', type: 'select', options: ['percent', 'fixed', 'other'], defaultValue: 'percent' },
        { name: 'discountValue', type: 'number' },
        { name: 'discountLabel', type: 'text', admin: { description: 'Short badge, e.g. "10% OFF"' } },
      ],
    },
    { name: 'terms', type: 'textarea' },
    {
      type: 'row',
      fields: [
        { name: 'startsAt', type: 'date' },
        { name: 'expiresAt', type: 'date' },
        { name: 'verifiedAt', type: 'date' },
      ],
    },
    { name: 'exclusive', type: 'checkbox', defaultValue: false },
    { name: 'newUsersOnly', type: 'checkbox', defaultValue: false },
    { name: 'url', type: 'text', admin: { description: 'Optional landing URL for this code' } },
  ],
}
