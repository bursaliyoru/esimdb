import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import type { Payload } from 'payload'

export const ROOT_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

/** Loads .env from the project root if present (Node ≥ 20.12 / 21.7). Call before reading process.env. */
export function loadEnv(): void {
  const file = path.join(ROOT_DIR, '.env')
  if (fs.existsSync(file)) process.loadEnvFile?.(file)
}

let cached: Promise<Payload> | null = null

/** Payload Local API instance. Imported lazily so pure modules/tests never boot Payload. */
export function getPayloadClient(): Promise<Payload> {
  cached ??= (async () => {
    const [{ getPayload }, { default: config }] = await Promise.all([import('payload'), import('../src/payload.config')])
    return getPayload({ config })
  })()
  return cached
}

export async function closePayload(): Promise<void> {
  if (!cached) return
  const p = await cached
  await p.db?.destroy?.().catch(() => {})
  cached = null
}

export interface JobResult {
  job: string
  ok: boolean
  /** Skipped (e.g. stub adapter) — neither success nor failure. */
  skipped?: boolean
  found: number
  changed: number
  error?: string
}

/** Writes one scrape-runs row. */
export async function recordRun(
  payload: Payload,
  job: string,
  startedAt: string,
  status: 'ok' | 'failed',
  itemsFound: number,
  itemsChanged: number,
  error?: string,
): Promise<void> {
  await payload.create({
    collection: 'scrape-runs',
    data: { job, status, startedAt, finishedAt: new Date().toISOString(), itemsFound, itemsChanged, error: error ?? null },
  })
}
