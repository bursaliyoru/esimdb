import { NextResponse, type NextRequest } from 'next/server'
import { db } from '@/lib/data'

// Affiliate redirect: /go/airalo?plan=123&src=esim/japan → logs a click, then 302 to the provider.
export async function GET(req: NextRequest, { params }: { params: Promise<{ provider: string }> }) {
  const { provider: slug } = await params
  const payload = await db()
  const found = await payload.find({ collection: 'providers', where: { slug: { equals: slug } }, limit: 1, depth: 0 })
  const provider = found.docs[0]
  if (!provider) return NextResponse.redirect(new URL('/', req.url))
  const planId = req.nextUrl.searchParams.get('plan')
  let target = provider.affiliateUrl || provider.website
  let plan: number | undefined
  if (planId && /^\d+$/.test(planId)) {
    const p = await payload.findByID({ collection: 'plans', id: Number(planId), depth: 0, disableErrors: true })
    if (p && String(p.provider) === String(provider.id)) {
      plan = p.id
      if (!provider.affiliateUrl && p.url) target = p.url
    }
  }
  payload
    .create({ collection: 'clicks', data: { provider: provider.id, plan, source: (req.nextUrl.searchParams.get('src') || '').slice(0, 120) } })
    .catch(() => {})
  return NextResponse.redirect(target, 302)
}
