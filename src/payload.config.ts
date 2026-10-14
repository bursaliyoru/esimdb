import path from 'path'
import { fileURLToPath } from 'url'
import { buildConfig } from 'payload'
import { postgresAdapter } from '@payloadcms/db-postgres'
import { sqliteAdapter } from '@payloadcms/db-sqlite'
import sharp from 'sharp'

import { Users } from './collections/Users'
import { Media } from './collections/Media'
import { Regions } from './collections/Regions'
import { Countries } from './collections/Countries'
import { Providers } from './collections/Providers'
import { Plans } from './collections/Plans'
import { PriceSnapshots } from './collections/PriceSnapshots'
import { Coupons } from './collections/Coupons'
import { Rankings } from './collections/Rankings'
import { Reviews } from './collections/Reviews'
import { ScrapeRuns } from './collections/ScrapeRuns'
import { Clicks } from './collections/Clicks'

const filename = fileURLToPath(import.meta.url)
const dirname = path.dirname(filename)
const dbUri = process.env.DATABASE_URI || ''

export default buildConfig({
  admin: { user: Users.slug, meta: { titleSuffix: ' · eSIM Compare admin' } },
  collections: [Providers, Plans, Countries, Regions, Coupons, Rankings, Reviews, PriceSnapshots, ScrapeRuns, Clicks, Media, Users],
  secret: process.env.PAYLOAD_SECRET || 'dev-secret-change-me',
  typescript: { outputFile: path.resolve(dirname, 'payload-types.ts') },
  db: dbUri.startsWith('postgres')
    ? postgresAdapter({ pool: { connectionString: dbUri }, migrationDir: path.resolve(dirname, 'migrations'), push: false })
    : sqliteAdapter({ client: { url: `file:${path.resolve(dirname, '../data/esimdb.db')}` } }),
  sharp,
})
