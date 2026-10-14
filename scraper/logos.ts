/**
 * Logo fetcher: for each provider without logoUrl (or all with --force), fetch the website HTML, pick
 * the best icon, download it to public/logos/<slug>.<ext> and set provider.logoUrl = '/logos/<slug>.<ext>'.
 *
 * Preference order: apple-touch-icon (largest) → JSON-LD Organization logo → og:image →
 * <link rel="icon"> (largest; SVG counts as largest) → /favicon.ico.
 */
import fs from 'node:fs/promises'
import path from 'node:path'
import * as cheerio from 'cheerio'
import type { Payload } from 'payload'
import { ROOT_DIR, recordRun, type JobResult } from './db'
import type { HttpClient } from './http'
import { errorMessage, type Logger } from './log'
import { extractJsonLd } from './parse'
import type { ProviderRow } from './providers'

export interface IconCandidate {
  url: string
  kind: 'apple-touch-icon' | 'jsonld-logo' | 'og:image' | 'icon' | 'favicon'
  size: number
}

const KIND_RANK: Record<IconCandidate['kind'], number> = { 'apple-touch-icon': 0, 'jsonld-logo': 1, 'og:image': 2, icon: 3, favicon: 4 }

function parseSizes(sizes: string | undefined, href: string): number {
  if (/\.svg(\?|$)/i.test(href) || sizes === 'any') return 10_000
  if (!sizes) return 0
  return Math.max(0, ...sizes.split(/\s+/).map((s) => Number(s.toLowerCase().split('x')[0]) || 0))
}

function abs(href: string, base: string): string | undefined {
  try {
    const u = new URL(href.trim(), base)
    return u.protocol === 'http:' || u.protocol === 'https:' || u.protocol === 'data:' ? u.href : undefined
  } catch {
    return undefined
  }
}

/** Returns icon candidates from best to worst. Pure (no network). */
export function pickIcons(html: string, baseUrl: string): IconCandidate[] {
  const $ = cheerio.load(html)
  const base = abs($('base[href]').attr('href') ?? '', baseUrl) ?? baseUrl
  const out: IconCandidate[] = []
  const push = (href: string | undefined, kind: IconCandidate['kind'], size = 0) => {
    if (!href) return
    const url = abs(href, base)
    if (url && !out.some((c) => c.url === url)) out.push({ url, kind, size })
  }

  $('link[rel]').each((_, el) => {
    const rel = ($(el).attr('rel') ?? '').toLowerCase().split(/\s+/)
    const href = $(el).attr('href')
    if (!href) return
    const size = parseSizes($(el).attr('sizes'), href)
    if (rel.includes('apple-touch-icon') || rel.includes('apple-touch-icon-precomposed')) push(href, 'apple-touch-icon', size)
    else if (rel.includes('icon') || rel.includes('shortcut') || rel.includes('mask-icon')) push(href, 'icon', rel.includes('mask-icon') ? -1 : size)
  })

  for (const block of extractJsonLd(html)) {
    const types = ([] as unknown[]).concat(block['@type'] ?? [])
    if (!types.some((t) => /Organization|Corporation|Brand|WebSite|LocalBusiness/.test(String(t)))) continue
    const logo = block.logo
    const href = typeof logo === 'string' ? logo : logo && typeof logo === 'object' ? (logo as Record<string, unknown>).url : undefined
    if (typeof href === 'string') push(href, 'jsonld-logo')
  }

  push($('meta[property="og:image"]').attr('content') ?? $('meta[name="og:image"]').attr('content'), 'og:image')
  push('/favicon.ico', 'favicon')

  return out.sort((a, b) => KIND_RANK[a.kind] - KIND_RANK[b.kind] || b.size - a.size)
}

const EXT_BY_TYPE: Record<string, string> = {
  'image/svg+xml': 'svg',
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'image/x-icon': 'ico',
  'image/vnd.microsoft.icon': 'ico',
  'image/ico': 'ico',
  'image/avif': 'avif',
}

/** Chooses a file extension from the content-type, then the URL, then magic bytes. */
export function iconExtension(contentType: string, url: string, body?: Buffer): string | undefined {
  if (EXT_BY_TYPE[contentType]) return EXT_BY_TYPE[contentType]
  const m = new URL(url).pathname.toLowerCase().match(/\.(svg|png|jpe?g|webp|gif|ico|avif)$/)
  if (m) return m[1] === 'jpeg' ? 'jpg' : m[1]
  if (body) {
    if (body.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'png'
    if (body[0] === 0xff && body[1] === 0xd8) return 'jpg'
    if (body.subarray(0, 4).equals(Buffer.from([0, 0, 1, 0]))) return 'ico'
    if (/^\s*(<\?xml[^>]*>\s*)?<svg/i.test(body.subarray(0, 300).toString('utf8'))) return 'svg'
  }
  return undefined
}

function decodeDataUrl(url: string): { body: Buffer; contentType: string } | undefined {
  const m = url.match(/^data:([^;,]+)(;base64)?,(.*)$/s)
  if (!m) return undefined
  const body = m[2] ? Buffer.from(m[3]!, 'base64') : Buffer.from(decodeURIComponent(m[3]!), 'utf8')
  return { body, contentType: m[1]!.toLowerCase() }
}

async function downloadBest(http: HttpClient, candidates: IconCandidate[], log: Logger): Promise<{ body: Buffer; ext: string; from: IconCandidate } | undefined> {
  for (const c of candidates) {
    try {
      const res = c.url.startsWith('data:') ? decodeDataUrl(c.url) : await http.getBuffer(c.url, { retries: 1 })
      if (!res || res.body.length < 100) continue
      if (res.contentType.startsWith('text/html')) continue
      const ext = iconExtension(res.contentType, c.url.startsWith('data:') ? 'https://x/' : c.url, res.body)
      if (!ext) continue
      return { body: res.body, ext, from: c }
    } catch (err) {
      log.debug(`${c.url}: ${errorMessage(err)}`)
    }
  }
  return undefined
}

export async function runLogos(opts: {
  payload: Payload | null
  http: HttpClient
  providers: ProviderRow[]
  log: Logger
  dryRun: boolean
  force: boolean
}): Promise<JobResult[]> {
  const results: JobResult[] = []
  const dir = path.join(ROOT_DIR, 'public', 'logos')
  for (const p of opts.providers) {
    if (p.logoUrl && !opts.force) continue
    const job = `logos:${p.slug}`
    const log = opts.log.child(p.slug)
    const started = new Date().toISOString()
    try {
      const res = await opts.http.request(p.website, { accept: 'html' })
      const candidates = pickIcons(res.body.toString('utf8'), res.url || p.website)
      log.debug(`candidates: ${candidates.map((c) => `${c.kind}:${c.url}`).join(', ')}`)
      const best = await downloadBest(opts.http, candidates, log)
      if (!best) throw new Error('no usable icon found')
      const file = `${p.slug}.${best.ext}`
      log.info(`${best.from.kind} ${best.from.url.slice(0, 120)} → /logos/${file} (${best.body.length} bytes)`)
      if (!opts.dryRun && opts.payload && p.id !== undefined) {
        await fs.mkdir(dir, { recursive: true })
        // Remove older files for this slug with a different extension.
        for (const f of await fs.readdir(dir)) if (f.startsWith(`${p.slug}.`) && f !== file) await fs.rm(path.join(dir, f)).catch(() => {})
        await fs.writeFile(path.join(dir, file), best.body)
        await opts.payload.update({ collection: 'providers', id: p.id, data: { logoUrl: `/logos/${file}` } })
        await recordRun(opts.payload, job, started, 'ok', 1, 1)
      }
      results.push({ job, ok: true, found: 1, changed: opts.dryRun ? 0 : 1 })
    } catch (err) {
      const msg = errorMessage(err)
      log.error(msg)
      if (!opts.dryRun && opts.payload) await recordRun(opts.payload, job, started, 'failed', 0, 0, msg).catch(() => {})
      results.push({ job, ok: false, found: 0, changed: 0, error: msg })
    }
  }
  return results
}
