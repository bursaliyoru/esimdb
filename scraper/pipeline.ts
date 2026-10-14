/** Shared job runner used by both the CLI (run.ts) and the long-running worker (worker.ts). */
import type { Payload } from 'payload'
import { loadRates } from './currency'
import { getPayloadClient, type JobResult } from './db'
import { HttpClient } from './http'
import { createLogger, type Logger } from './log'
import { runLogos } from './logos'
import { loadProviders } from './providers'
import { loadCountryRefs, runPrices } from './sync'
import { runTrustpilot } from './trustpilot'

export type JobName = 'prices' | 'trustpilot' | 'logos' | 'all'

export interface RunOptions {
  job: JobName
  provider?: string
  dryRun: boolean
  noProxy: boolean
  force: boolean
  countries?: string[]
  log?: Logger
}

export interface RunSummary {
  results: JobResult[]
  /** True when the prices job ran at least one adapter and every one of them failed. */
  allAdaptersFailed: boolean
}

export async function runJobs(o: RunOptions): Promise<RunSummary> {
  const log = o.log ?? createLogger()
  const http = new HttpClient({ noProxy: o.noProxy, log: log.child('http') })
  let payload: Payload | null = null
  try {
    try {
      payload = await getPayloadClient()
    } catch (err) {
      if (!o.dryRun) throw err
      log.warn(`Payload unavailable, dry run continues with built-in provider defaults: ${(err as Error).message}`)
    }
    const providers = await loadProviders(payload, { slug: o.provider, includeDefaults: o.dryRun })
    if (o.provider && providers.length === 0) throw new Error(`unknown provider "${o.provider}"`)
    log.info(
      `job=${o.job}${o.provider ? ` provider=${o.provider}` : ''}${o.dryRun ? ' DRY RUN' : ''} proxies=${http.usingProxies ? 'on' : 'off'} providers=${providers.length}`,
    )

    const results: JobResult[] = []
    let priceResults: JobResult[] = []
    if (o.job === 'prices' || o.job === 'all') {
      const rates = await loadRates(http, log.child('fx'))
      log.info(`exchange rates: ${rates.source}`)
      const countries = await loadCountryRefs(payload, o.countries)
      priceResults = await runPrices({ payload, http, providers, countries, rates, log: log.child('prices'), dryRun: o.dryRun, explicit: !!o.provider })
      results.push(...priceResults)
    }
    if (o.job === 'trustpilot' || o.job === 'all') {
      results.push(...(await runTrustpilot({ payload, http, providers, log: log.child('trustpilot'), dryRun: o.dryRun })))
    }
    if (o.job === 'logos' || o.job === 'all') {
      results.push(...(await runLogos({ payload, http, providers, log: log.child('logos'), dryRun: o.dryRun, force: o.force })))
    }

    const attempted = priceResults.filter((r) => !r.skipped)
    const summary: RunSummary = { results, allAdaptersFailed: attempted.length > 0 && attempted.every((r) => !r.ok) }
    for (const r of results) {
      log.info(`${r.skipped ? 'SKIP' : r.ok ? 'OK  ' : 'FAIL'} ${r.job.padEnd(22)} found=${r.found} changed=${r.changed}${r.error ? ` error=${r.error.slice(0, 160)}` : ''}`)
    }
    return summary
  } finally {
    await http.close()
  }
}
