/**
 * HTTP client for the scrapers.
 *
 * - Proxy rotation from SCRAPER_PROXIES (comma separated http://user:pass@host:port), via undici ProxyAgent.
 *   Without SCRAPER_PROXIES (or with --no-proxy) requests go direct, still honouring the standard
 *   HTTP(S)_PROXY / NO_PROXY env vars through undici's EnvHttpProxyAgent.
 * - Realistic browser headers with User-Agent rotation.
 * - Per-request timeout, retries with exponential backoff + jitter (rotating proxy on each retry),
 *   honours Retry-After.
 * - Per-host politeness delay (SCRAPER_HOST_DELAY_MS, default 1500 ms) — requests to the same host are serialised.
 */
import { Agent, EnvHttpProxyAgent, ProxyAgent, fetch, type Dispatcher } from 'undici'
import type { Logger } from './log'

export interface HttpOptions {
  /** Ignore SCRAPER_PROXIES. */
  noProxy?: boolean
  proxies?: string[]
  timeoutMs?: number
  retries?: number
  hostDelayMs?: number
  log?: Logger
}

export interface RequestOptions {
  method?: 'GET' | 'POST'
  headers?: Record<string, string>
  body?: string
  /** 'html' (default) or 'json' — only changes the Accept header family. */
  accept?: 'html' | 'json' | 'image' | 'any'
  /** Extra status codes that should be returned instead of thrown (e.g. 404). */
  okStatuses?: number[]
  timeoutMs?: number
  retries?: number
}

export interface HttpResponse {
  status: number
  url: string
  headers: Headers
  body: Buffer
}

export class HttpError extends Error {
  constructor(
    message: string,
    public readonly status: number | null,
    public readonly url: string,
  ) {
    super(message)
    this.name = 'HttpError'
  }
}

const USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.6 Safari/605.1.15',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:143.0) Gecko/20100101 Firefox/143.0',
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36 Edg/139.0.0.0',
]

const ACCEPT: Record<NonNullable<RequestOptions['accept']>, string> = {
  html: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
  json: 'application/json, text/plain, */*',
  image: 'image/avif,image/webp,image/svg+xml,image/png,image/*;q=0.8,*/*;q=0.5',
  any: '*/*',
}

const RETRY_STATUSES = new Set([403, 408, 425, 429, 500, 502, 503, 504, 520, 521, 522, 524])

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

export function parseProxyList(raw: string | undefined): string[] {
  if (!raw) return []
  return raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
    .filter((s) => {
      try {
        const u = new URL(s)
        return u.protocol === 'http:' || u.protocol === 'https:'
      } catch {
        return false
      }
    })
}

/** Exponential backoff with full jitter: attempt 1 → ~0.5–1s, 2 → ~1–2s, 3 → ~2–4s … capped at 30s. */
export function backoffMs(attempt: number, baseMs = 1000): number {
  const exp = Math.min(30_000, baseMs * 2 ** (attempt - 1))
  return Math.round(exp / 2 + Math.random() * (exp / 2))
}

/** undici wraps network errors as "fetch failed"; surface the underlying cause. */
export function describeError(err: unknown): string {
  if (!(err instanceof Error)) return String(err)
  const cause = (err as Error & { cause?: unknown }).cause
  const causeMsg = cause instanceof Error ? `${(cause as Error & { code?: string }).code ?? cause.name}: ${cause.message}` : cause ? String(cause) : ''
  return causeMsg ? `${err.message} (${causeMsg})` : err.message
}

function redactProxy(p: string): string {
  try {
    const u = new URL(p)
    return `${u.protocol}//${u.username ? '***@' : ''}${u.host}`
  } catch {
    return '<invalid proxy>'
  }
}

export class HttpClient {
  private readonly proxies: string[]
  private readonly proxyAgents = new Map<string, ProxyAgent>()
  private readonly direct: Dispatcher
  private proxyIdx = Math.floor(Math.random() * 1000)
  private uaIdx = Math.floor(Math.random() * USER_AGENTS.length)
  private readonly hostQueues = new Map<string, Promise<void>>()
  private readonly hostLast = new Map<string, number>()
  readonly timeoutMs: number
  readonly retries: number
  readonly hostDelayMs: number
  private readonly log?: Logger

  constructor(opts: HttpOptions = {}) {
    this.proxies = opts.noProxy ? [] : (opts.proxies ?? parseProxyList(process.env.SCRAPER_PROXIES))
    this.timeoutMs = opts.timeoutMs ?? Number(process.env.SCRAPER_TIMEOUT_MS || 30_000)
    this.retries = opts.retries ?? Number(process.env.SCRAPER_RETRIES || 3)
    this.hostDelayMs = opts.hostDelayMs ?? Number(process.env.SCRAPER_HOST_DELAY_MS || 1500)
    this.log = opts.log
    this.direct = process.env.HTTPS_PROXY || process.env.HTTP_PROXY || process.env.https_proxy || process.env.http_proxy
      ? new EnvHttpProxyAgent()
      : new Agent({ connect: { timeout: this.timeoutMs } })
  }

  get usingProxies(): boolean {
    return this.proxies.length > 0
  }

  private nextDispatcher(): { dispatcher: Dispatcher; label: string } {
    if (this.proxies.length === 0) return { dispatcher: this.direct, label: 'direct' }
    const proxy = this.proxies[this.proxyIdx++ % this.proxies.length]!
    let agent = this.proxyAgents.get(proxy)
    if (!agent) {
      agent = new ProxyAgent({ uri: proxy })
      this.proxyAgents.set(proxy, agent)
    }
    return { dispatcher: agent, label: redactProxy(proxy) }
  }

  private nextUserAgent(): string {
    return USER_AGENTS[this.uaIdx++ % USER_AGENTS.length]!
  }

  /** Waits until this host may be hit again, serialising requests per host. */
  private async politeness(host: string): Promise<void> {
    const prev = this.hostQueues.get(host) ?? Promise.resolve()
    let release!: () => void
    const mine = new Promise<void>((r) => (release = r))
    this.hostQueues.set(host, prev.then(() => mine))
    await prev
    const last = this.hostLast.get(host) ?? 0
    const wait = last + this.hostDelayMs + Math.random() * (this.hostDelayMs / 2) - Date.now()
    if (wait > 0) await sleep(wait)
    this.hostLast.set(host, Date.now())
    // Release on next tick so the following request measures from our start time.
    queueMicrotask(release)
  }

  buildHeaders(url: URL, opts: RequestOptions): Record<string, string> {
    const ua = this.nextUserAgent()
    const isChrome = /Chrome\//.test(ua) && !/Edg\//.test(ua)
    const h: Record<string, string> = {
      'user-agent': ua,
      accept: ACCEPT[opts.accept ?? 'html'],
      'accept-language': 'en-US,en;q=0.9',
      'accept-encoding': 'gzip, deflate, br',
      'cache-control': 'no-cache',
      pragma: 'no-cache',
    }
    if ((opts.accept ?? 'html') === 'html') {
      h['upgrade-insecure-requests'] = '1'
      h['sec-fetch-dest'] = 'document'
      h['sec-fetch-mode'] = 'navigate'
      h['sec-fetch-site'] = 'none'
      h['sec-fetch-user'] = '?1'
    } else {
      h['sec-fetch-dest'] = 'empty'
      h['sec-fetch-mode'] = 'cors'
      h['sec-fetch-site'] = 'same-origin'
      h.referer = `${url.origin}/`
    }
    if (isChrome) {
      h['sec-ch-ua'] = '"Chromium";v="140", "Not=A?Brand";v="24", "Google Chrome";v="140"'
      h['sec-ch-ua-mobile'] = '?0'
      h['sec-ch-ua-platform'] = /Windows/.test(ua) ? '"Windows"' : /Mac OS/.test(ua) ? '"macOS"' : '"Linux"'
    }
    for (const [k, v] of Object.entries(opts.headers ?? {})) h[k.toLowerCase()] = v
    return h
  }

  async request(rawUrl: string, opts: RequestOptions = {}): Promise<HttpResponse> {
    const url = new URL(rawUrl)
    const retries = opts.retries ?? this.retries
    const timeoutMs = opts.timeoutMs ?? this.timeoutMs
    let lastErr: unknown
    for (let attempt = 1; attempt <= retries + 1; attempt++) {
      await this.politeness(url.host)
      const { dispatcher, label } = this.nextDispatcher()
      const ctrl = new AbortController()
      const timer = setTimeout(() => ctrl.abort(), timeoutMs)
      try {
        const res = await fetch(url, {
          method: opts.method ?? 'GET',
          headers: this.buildHeaders(url, opts),
          body: opts.body,
          dispatcher,
          signal: ctrl.signal,
          redirect: 'follow',
        })
        const body = Buffer.from(await res.arrayBuffer())
        if (res.ok || opts.okStatuses?.includes(res.status)) {
          this.log?.debug(`${res.status} ${url.href} via ${label}`)
          return { status: res.status, url: res.url || url.href, headers: res.headers as unknown as Headers, body }
        }
        const err = new HttpError(`HTTP ${res.status} for ${url.href}`, res.status, url.href)
        if (!RETRY_STATUSES.has(res.status) || attempt > retries) throw err
        lastErr = err
        const retryAfter = Number(res.headers.get('retry-after'))
        const wait = Number.isFinite(retryAfter) && retryAfter > 0 ? Math.min(retryAfter * 1000, 60_000) : backoffMs(attempt)
        this.log?.warn(`${res.status} ${url.href} via ${label}; retry ${attempt}/${retries} in ${wait}ms`)
        await sleep(wait)
      } catch (err) {
        if (err instanceof HttpError && (err.status === null || !RETRY_STATUSES.has(err.status) || attempt > retries)) throw err
        if (!(err instanceof HttpError)) {
          lastErr = err
          if (attempt > retries) break
          const wait = backoffMs(attempt)
          const msg = ctrl.signal.aborted ? `timeout after ${timeoutMs}ms` : describeError(err)
          this.log?.warn(`${url.href} via ${label}: ${msg}; retry ${attempt}/${retries} in ${wait}ms`)
          await sleep(wait)
        }
      } finally {
        clearTimeout(timer)
      }
    }
    if (lastErr instanceof HttpError) throw lastErr
    throw new HttpError(`Request failed for ${url.href}: ${describeError(lastErr)}`, null, url.href)
  }

  async getText(url: string, opts: RequestOptions = {}): Promise<string> {
    const res = await this.request(url, { accept: 'html', ...opts })
    return res.body.toString('utf8')
  }

  async getJson<T = unknown>(url: string, opts: RequestOptions = {}): Promise<T> {
    const res = await this.request(url, { accept: 'json', ...opts })
    const text = res.body.toString('utf8')
    try {
      return JSON.parse(text) as T
    } catch {
      throw new HttpError(`Invalid JSON from ${url} (starts with: ${JSON.stringify(text.slice(0, 80))})`, res.status, url)
    }
  }

  async postJson<T = unknown>(url: string, payload: unknown, opts: RequestOptions = {}): Promise<T> {
    return this.getJson<T>(url, {
      ...opts,
      method: 'POST',
      body: JSON.stringify(payload),
      headers: { 'content-type': 'application/json', ...(opts.headers ?? {}) },
    })
  }

  async getBuffer(url: string, opts: RequestOptions = {}): Promise<{ body: Buffer; contentType: string; url: string }> {
    const res = await this.request(url, { accept: 'image', ...opts })
    return { body: res.body, contentType: (res.headers.get('content-type') ?? '').split(';')[0]!.trim().toLowerCase(), url: res.url }
  }

  async close(): Promise<void> {
    await Promise.allSettled([...this.proxyAgents.values()].map((a) => a.close()))
    await this.direct.close().catch(() => {})
  }
}

// Module-level convenience helpers using a lazily created default client.
let defaultClient: HttpClient | null = null
export function defaultHttp(): HttpClient {
  defaultClient ??= new HttpClient()
  return defaultClient
}
export const getText = (url: string, opts?: RequestOptions) => defaultHttp().getText(url, opts)
export const getJson = <T = unknown>(url: string, opts?: RequestOptions) => defaultHttp().getJson<T>(url, opts)
