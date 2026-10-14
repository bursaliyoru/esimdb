import type { CollectionConfig } from 'payload'

export const Reviews: CollectionConfig = {
  slug: 'reviews',
  admin: { useAsTitle: 'title', group: 'Community', defaultColumns: ['provider', 'source', 'rating', 'status', 'publishedAt'] },
  access: {
    // Public visitors only ever see approved reviews. Submissions go through /api/reviews/submit.
    read: ({ req }) => (req.user ? true : { status: { equals: 'approved' } }),
    create: ({ req }) => Boolean(req.user),
  },
  fields: [
    { name: 'provider', type: 'relationship', relationTo: 'providers', required: true, index: true },
    { name: 'source', type: 'select', options: ['site', 'trustpilot'], defaultValue: 'site', required: true, index: true },
    { name: 'status', type: 'select', options: ['pending', 'approved', 'rejected'], defaultValue: 'pending', required: true, index: true },
    { name: 'rating', type: 'number', min: 1, max: 5, required: true },
    { name: 'title', type: 'text' },
    { name: 'body', type: 'textarea', required: true },
    { name: 'authorName', type: 'text', required: true },
    { name: 'authorCountry', type: 'text' },
    { name: 'authorEmail', type: 'email', admin: { description: 'Site reviews only. Never shown publicly.' }, access: { read: ({ req }) => Boolean(req.user) } },
    { name: 'publishedAt', type: 'date', required: true },
    { name: 'externalId', type: 'text', unique: true, index: true, admin: { description: 'Trustpilot review id' } },
    { name: 'externalUrl', type: 'text', admin: { description: 'Link to the original review on Trustpilot' } },
    { name: 'ipHash', type: 'text', admin: { hidden: true } },
  ],
}
