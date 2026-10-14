import type { CollectionConfig } from 'payload'

export const Rankings: CollectionConfig = {
  slug: 'rankings',
  admin: { useAsTitle: 'title', group: 'Marketing', defaultColumns: ['title', 'country', 'mode'] },
  access: { read: () => true },
  fields: [
    { name: 'title', type: 'text', required: true },
    { name: 'slug', type: 'text', required: true, unique: true, index: true, admin: { description: '"global" for /best-esim, or the country slug for /best-esim/[country]' } },
    { name: 'country', type: 'relationship', relationTo: 'countries' },
    { name: 'intro', type: 'textarea' },
    {
      name: 'mode',
      type: 'select',
      defaultValue: 'hybrid',
      options: [
        { label: 'Hybrid: automatic score, editor pins and exclusions win', value: 'hybrid' },
        { label: 'Automatic only', value: 'auto' },
        { label: 'Manual: use the order below exactly', value: 'manual' },
      ],
    },
    { name: 'size', type: 'number', defaultValue: 10 },
    {
      name: 'entries',
      type: 'array',
      admin: { description: 'Drag to reorder. In hybrid mode only pinned or excluded rows change the automatic order.' },
      fields: [
        { name: 'provider', type: 'relationship', relationTo: 'providers', required: true },
        {
          type: 'row',
          fields: [
            { name: 'pinnedPosition', type: 'number', admin: { description: '1 = top' } },
            { name: 'excluded', type: 'checkbox', defaultValue: false },
            { name: 'sponsored', type: 'checkbox', defaultValue: false },
          ],
        },
        { name: 'badge', type: 'text', admin: { description: 'e.g. "Best for unlimited data"' } },
        { name: 'pros', type: 'array', fields: [{ name: 'text', type: 'text', required: true }] },
        { name: 'cons', type: 'array', fields: [{ name: 'text', type: 'text', required: true }] },
        { name: 'note', type: 'textarea' },
      ],
    },
  ],
}
