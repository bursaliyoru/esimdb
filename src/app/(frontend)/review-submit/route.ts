import crypto from 'node:crypto'
import { NextResponse, type NextRequest } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/data'

const Body = z.object({
  provider: z.string().min(1).max(80),
  rating: z.coerce.number().int().min(1).max(5),
  title: z.string().max(120).optional().default(''),
  body: z.string().trim().min(20, 'Please write at least 20 characters.').max(3000),
  authorName: z.string().trim().min(1).max(60),
  authorEmail: z.string().trim().email('Enter a valid email address.').max(120),
  authorCountry: z.string().trim().max(60).optional().default(''),
  website: z.string().optional(), // honeypot
})

const recent = new Map<string, number[]>()
function rateLimited(key: string, max = 3, windowMs = 60 * 60 * 1000) {
  const now = Date.now()
  const list = (recent.get(key) ?? []).filter((t) => now - t < windowMs)
  list.push(now)
  recent.set(key, list)
  return list.length > max
}

export async function POST(req: NextRequest) {
  const json = await req.json().catch(() => null)
  const parsed = Body.safeParse(json)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message || 'Check the form and try again.' }, { status: 400 })
  const d = parsed.data
  if (d.website) return NextResponse.json({ ok: true }) // bot filled the hidden field
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'
  const ipHash = crypto.createHash('sha256').update(ip + (process.env.PAYLOAD_SECRET || '')).digest('hex').slice(0, 32)
  if (rateLimited(ipHash)) return NextResponse.json({ error: 'Too many reviews from this connection. Try again in an hour.' }, { status: 429 })

  const payload = await db()
  const found = await payload.find({ collection: 'providers', where: { slug: { equals: d.provider } }, limit: 1, depth: 0 })
  const provider = found.docs[0]
  if (!provider) return NextResponse.json({ error: 'Unknown provider.' }, { status: 404 })

  await payload.create({
    collection: 'reviews',
    overrideAccess: true,
    data: {
      provider: provider.id,
      source: 'site',
      status: 'pending',
      rating: d.rating,
      title: d.title || undefined,
      body: d.body,
      authorName: d.authorName,
      authorEmail: d.authorEmail,
      authorCountry: d.authorCountry || undefined,
      publishedAt: new Date().toISOString(),
      ipHash,
    },
  })
  return NextResponse.json({ ok: true })
}
