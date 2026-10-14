/**
 * Long-running scraper worker: runs the `all` job on SCRAPER_CRON (default '0 3 * * *', UTC).
 * SCRAPER_RUN_ON_START=true also runs once at startup. Runs never overlap.
 *   npm run worker
 */
import cron from 'node-cron'
import { closePayload, loadEnv } from './db'
import { createLogger } from './log'

loadEnv()
const log = createLogger('worker')
const { runJobs } = await import('./pipeline')

const expr = process.env.SCRAPER_CRON || '0 3 * * *'
if (!cron.validate(expr)) {
  log.error(`invalid SCRAPER_CRON expression: ${expr}`)
  process.exit(1)
}

let running = false
async function tick(reason: string): Promise<void> {
  if (running) {
    log.warn(`previous run still in progress — skipping (${reason})`)
    return
  }
  running = true
  const t0 = Date.now()
  log.info(`run started (${reason})`)
  try {
    const s = await runJobs({ job: 'all', dryRun: false, noProxy: process.env.SCRAPER_NO_PROXY === 'true', force: false, log })
    const failed = s.results.filter((r) => !r.ok && !r.skipped).length
    log.info(`run finished in ${Math.round((Date.now() - t0) / 1000)}s: ${s.results.length - failed} ok, ${failed} failed`)
  } catch (err) {
    log.error(`run crashed: ${(err as Error).stack ?? String(err)}`)
  } finally {
    running = false
  }
}

const task = cron.schedule(expr, () => tick('cron'), { timezone: 'UTC', noOverlap: true, name: 'scrape-all' })
log.info(`scheduled "${expr}" (UTC); next run: ${task.getNextRun()?.toISOString() ?? 'unknown'}`)

if (process.env.SCRAPER_RUN_ON_START === 'true') void tick('startup')

const shutdown = async (sig: string) => {
  log.info(`${sig} received, stopping`)
  await task.stop()
  await closePayload()
  process.exit(0)
}
process.on('SIGINT', () => void shutdown('SIGINT'))
process.on('SIGTERM', () => void shutdown('SIGTERM'))
