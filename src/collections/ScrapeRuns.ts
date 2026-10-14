import type { CollectionConfig } from 'payload'

export const ScrapeRuns: CollectionConfig = {
  slug: 'scrape-runs',
  admin: { useAsTitle: 'job', group: 'Data', defaultColumns: ['job', 'status', 'itemsFound', 'startedAt'] },
  fields: [
    { name: 'job', type: 'text', required: true },
    { name: 'status', type: 'select', options: ['running', 'ok', 'failed'], required: true },
    { name: 'startedAt', type: 'date', required: true },
    { name: 'finishedAt', type: 'date' },
    { name: 'itemsFound', type: 'number' },
    { name: 'itemsChanged', type: 'number' },
    { name: 'error', type: 'textarea' },
  ],
}
