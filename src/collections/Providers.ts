import type { CollectionConfig } from 'payload'

export const Providers: CollectionConfig = {
  slug: 'providers',
  admin: { useAsTitle: 'name', group: 'Catalog', defaultColumns: ['name', 'trustScore', 'scraper', 'active'] },
  access: { read: () => true },
  fields: [
    { name: 'name', type: 'text', required: true },
    { name: 'slug', type: 'text', required: true, unique: true, index: true },
    { name: 'active', type: 'checkbox', defaultValue: true },
    { name: 'website', type: 'text', required: true },
    { name: 'affiliateUrl', type: 'text', admin: { description: 'Used by the Buy buttons. Falls back to the website.' } },
    { name: 'brandColor', type: 'text', defaultValue: '#0B2027' },
    { name: 'logo', type: 'upload', relationTo: 'media' },
    { name: 'logoUrl', type: 'text', admin: { description: 'Filled by the logo fetcher. Local path under /logos.' } },
    { name: 'tagline', type: 'text' },
    { name: 'description', type: 'textarea' },
    { name: 'headquarters', type: 'text' },
    { name: 'founded', type: 'number' },
    {
      type: 'row',
      fields: [
        { name: 'hasApp', type: 'checkbox', defaultValue: true },
        { name: 'topUp', type: 'checkbox', defaultValue: true },
        { name: 'hotspot', type: 'checkbox', defaultValue: true },
        { name: 'phoneNumber', type: 'checkbox', defaultValue: false },
      ],
    },
    { name: 'kyc', type: 'text', admin: { description: 'Identity verification, e.g. "Not required".' } },
    {
      type: 'collapsible',
      label: 'Trustpilot',
      fields: [
        { name: 'trustpilotDomain', type: 'text', admin: { description: 'e.g. airalo.com → trustpilot.com/review/airalo.com' } },
        { name: 'trustScore', type: 'number', admin: { readOnly: true } },
        { name: 'trustReviewCount', type: 'number', admin: { readOnly: true } },
        { name: 'trustUpdatedAt', type: 'date', admin: { readOnly: true } },
      ],
    },
    {
      type: 'collapsible',
      label: 'Scraper',
      fields: [
        { name: 'scraper', type: 'text', admin: { description: 'Adapter key in scraper/adapters, e.g. "airalo". Empty = not scraped.' } },
        { name: 'lastScrapedAt', type: 'date', admin: { readOnly: true } },
        { name: 'lastScrapeStatus', type: 'text', admin: { readOnly: true } },
      ],
    },
  ],
}
