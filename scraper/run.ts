/**
 * CLI: npm run scrape -- [prices|trustpilot|logos|all] [--provider airalo] [--dry-run] [--no-proxy]
 *                        [--countries US,JP] [--force]
 */
import { pathToFileURL } from 'node:url'
import { closePayload, loadEnv } from './db'
import type { JobName } from './pipeline'

const HELP = `Usage: npm run scrape -- [job] [options]

Jobs:
  prices       Scrape plans/prices with the provider adapters and sync them to the DB
  trustpilot   Update TrustScore, review count and latest Trustpilot reviews
  logos        Download provider logos into public/logos (only providers without logoUrl)
  all          All of the above (default)

Options:
  --provider <slug>    Only this provider (also runs stub adapters, which then fail)
  --countries <codes>  Comma-separated ISO2 codes for per-country adapters (e.g. US,JP,FR)
  --dry-run            Fetch and print results; write nothing to the DB or disk
  --no-proxy           Ignore SCRAPER_PROXIES and connect directly
  --force              logos: refetch even if the provider already has a logo
  -h, --help           Show this help

Exit code is 1 when every price adapter that ran failed (or on a fatal error).`

export interface CliArgs {
  job: JobName
  provider?: string
  countries?: string[]
  dryRun: boolean
  noProxy: boolean
  force: boolean
  help: boolean
}

export function parseArgs(argv: string[]): CliArgs {
  const args: CliArgs = { job: 'all', dryRun: false, noProxy: false, force: false, help: false }
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]!
    const [flag, inline] = a.startsWith('--') && a.includes('=') ? [a.slice(0, a.indexOf('=')), a.slice(a.indexOf('=') + 1)] : [a, undefined]
    const value = () => {
      const v = inline ?? argv[++i]
      if (!v || v.startsWith('--')) throw new Error(`${flag} needs a value`)
      return v
    }
    switch (flag) {
      case 'prices':
      case 'trustpilot':
      case 'logos':
      case 'all':
        args.job = flag
        break
      case '--provider':
        args.provider = value().toLowerCase()
        break
      case '--countries':
        args.countries = value()
          .split(',')
          .map((c) => c.trim().toUpperCase())
          .filter((c) => /^[A-Z]{2}$/.test(c))
        break
      case '--dry-run':
        args.dryRun = true
        break
      case '--no-proxy':
        args.noProxy = true
        break
      case '--force':
        args.force = true
        break
      case '-h':
      case '--help':
        args.help = true
        break
      default:
        throw new Error(`unknown argument: ${a}`)
    }
  }
  return args
}

async function main(): Promise<number> {
  let args: CliArgs
  try {
    args = parseArgs(process.argv.slice(2))
  } catch (err) {
    console.error(`${(err as Error).message}\n\n${HELP}`)
    return 2
  }
  if (args.help) {
    console.log(HELP)
    return 0
  }
  loadEnv()
  const { runJobs } = await import('./pipeline')
  try {
    const summary = await runJobs(args)
    return summary.allAdaptersFailed ? 1 : 0
  } catch (err) {
    console.error(`fatal: ${(err as Error).stack ?? String(err)}`)
    return 1
  } finally {
    await closePayload()
  }
}

const isMain = !!process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href
if (isMain) {
  main().then((code) => process.exit(code))
}
