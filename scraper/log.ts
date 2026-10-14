export interface Logger {
  info(msg: string): void
  warn(msg: string): void
  error(msg: string): void
  debug(msg: string): void
  child(scope: string): Logger
}

export function createLogger(scope = 'scraper', verbose = process.env.SCRAPER_DEBUG === 'true'): Logger {
  const stamp = () => new Date().toISOString()
  return {
    info: (m) => console.log(`${stamp()} [${scope}] ${m}`),
    warn: (m) => console.warn(`${stamp()} [${scope}] WARN ${m}`),
    error: (m) => console.error(`${stamp()} [${scope}] ERROR ${m}`),
    debug: (m) => {
      if (verbose) console.log(`${stamp()} [${scope}] debug ${m}`)
    },
    child: (s) => createLogger(`${scope}:${s}`, verbose),
  }
}

/** A logger that discards everything (for tests). */
export const silentLogger: Logger = {
  info() {},
  warn() {},
  error() {},
  debug() {},
  child: () => silentLogger,
}

export function errorMessage(err: unknown): string {
  if (err instanceof Error) return err.message
  return String(err)
}
