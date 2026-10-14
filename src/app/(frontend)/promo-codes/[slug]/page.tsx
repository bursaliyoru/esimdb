import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { getCoupons, getPlansForProvider, getProvider, isCouponLive } from '@/lib/data'
import { getCurrency } from '@/components/currency'
import { dataLabel, formatDate, money } from '@/lib/format'
import { ProviderMark } from '@/components/ProviderMark'
import { CopyButton } from '@/components/CopyButton'
import { buyHref } from '@/components/PlanRow'
import { site } from '@/lib/site'

type Props = { params: Promise<{ slug: string }> }

const month = () => new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' })

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const p = await getProvider((await params).slug)
  if (!p) return {}
  return {
    title: `${p.name} promo code ${month()}`,
    description: `Working ${p.name} promo codes and discount codes for ${month()}, verified by ${site.name}. Copy a code and save on your travel eSIM.`,
    alternates: { canonical: `/promo-codes/${p.slug}` },
  }
}

export default async function ProviderPromoPage({ params }: Props) {
  const p = await getProvider((await params).slug)
  if (!p) notFound()
  const cur = await getCurrency()
  const [coupons, plans] = await Promise.all([getCoupons(p.id), getPlansForProvider(p.id)])
  const live = coupons.filter((c) => isCouponLive(c))
  const expired = coupons.filter((c) => !isCouponLive(c) && c.expiresAt && new Date(c.expiresAt) < new Date())
  const cheapest = plans.filter((x) => x.scope === 'single').sort((a, b) => a.priceUsd - b.priceUsd).slice(0, 5)
  const go = buyHref(p.slug, undefined, `promo-codes/${p.slug}`)
  const faq = [
    [`Does ${p.name} have a promo code right now?`, live.length ? `Yes. ${live.length} code${live.length > 1 ? 's are' : ' is'} working as of ${formatDate(live[0].verifiedAt || new Date())}. The best one is ${live[0].code} (${live[0].title}).` : `Not at the moment. We check ${p.name} regularly and list new codes here as soon as they appear.`],
    [`How do I use a ${p.name} promo code?`, `Copy the code, open ${p.name}, add a plan to your cart and paste the code in the promo or discount field at checkout before you pay.`],
    [`Can I combine ${p.name} codes?`, 'Usually not. Most providers accept one code per order.'],
  ]
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faq.map(([q, a]) => ({ '@type': 'Question', name: q, acceptedAnswer: { '@type': 'Answer', text: a } })),
  }
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <section className="chead" style={{ ['--tint' as string]: p.brandColor || '#3EE0B3' }}>
        <div className="wrap">
          <div className="crumb"><a href="/promo-codes">Promo codes</a> / {p.name}</div>
          <h1><ProviderMark provider={p} size={52} />{p.name} promo codes</h1>
          <p className="sub">{live.length ? `${live.length} working code${live.length > 1 ? 's' : ''} for ${month()}.` : `No working code for ${month()} yet.`} Last checked {formatDate(live[0]?.verifiedAt || p.updatedAt)}.</p>
        </div>
      </section>
      <div className="pgrid wrap">
        <div className="stack">
          <div style={{ display: 'grid', gap: 12 }}>
            {live.length ? live.map((c) => (
              <div className="coupon-row" key={c.id}>
                <div className="lab">{c.discountLabel || 'DEAL'}</div>
                <div style={{ minWidth: 0 }}>
                  <h3>{c.title}</h3>
                  <div className="m">{c.exclusive && <span className="tag d" style={{ marginRight: 6 }}>Exclusive</span>}{c.newUsersOnly ? 'New customers only · ' : ''}{c.verifiedAt ? `Verified ${formatDate(c.verifiedAt)}` : ''}{c.expiresAt ? ` · Expires ${formatDate(c.expiresAt)}` : ''}</div>
                  {c.terms && <div className="m" style={{ marginTop: 4 }}>{c.terms}</div>}
                </div>
                <div className="act" style={{ display: 'grid', gap: 6 }}>
                  <div className="codebox"><code>{c.code}</code><CopyButton text={c.code} /></div>
                  <a className="btn acc" href={go} target="_blank" rel="noopener sponsored nofollow">Go to {p.name}</a>
                </div>
              </div>
            )) : <div className="empty">No working {p.name} code right now. The plans below are already the cheapest we found.</div>}
          </div>

          <div className="sec-card">
            <h2>How to use your {p.name} promo code</h2>
            <ol className="howto">
              <li>Copy a code from this page.</li>
              <li>Open {p.name} and pick a plan for your destination.</li>
              <li>Paste the code in the promo or discount field at checkout.</li>
              <li>Check that the discount shows before you pay, then install the eSIM with the QR code.</li>
            </ol>
          </div>

          {cheapest.length > 0 && (
            <div className="sec-card">
              <h2>Cheapest {p.name} plans</h2>
              <div style={{ overflowX: 'auto' }}>
                <table className="ptable">
                  <thead><tr><th>Plan</th><th className="r">Data</th><th className="r">Validity</th><th className="r">Price</th></tr></thead>
                  <tbody>{cheapest.map((r) => <tr key={r.id}><td>{r.name}</td><td className="r num">{dataLabel(r.dataMb, r.dailyMb)}</td><td className="r num">{r.validityDays} days</td><td className="r num"><b>{money(r.priceUsd, cur)}</b></td></tr>)}</tbody>
                </table>
              </div>
            </div>
          )}

          <div className="sec-card faq">
            <h2>FAQ</h2>
            {faq.map(([q, a], i) => <details key={q} open={i === 0}><summary>{q}</summary><p>{a}</p></details>)}
          </div>

          {expired.length > 0 && (
            <div>
              <h2 style={{ fontFamily: 'var(--f-display)', fontSize: 20 }}>Expired {p.name} codes</h2>
              <div style={{ display: 'grid', gap: 10 }}>
                {expired.map((c) => (
                  <div className="coupon-row exp" key={c.id}>
                    <div className="lab">{c.discountLabel || 'DEAL'}</div>
                    <div><h3>{c.title}</h3><div className="m">Expired {formatDate(c.expiresAt)}</div></div>
                    <div className="act"><code className="num" style={{ textDecoration: 'line-through' }}>{c.code}</code></div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
        <aside className="card">
          <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 12 }}><ProviderMark provider={p} size={44} /><div><b>{p.name}</b><div className="method">{p.trustScore ? `${p.trustScore.toFixed(1)} on Trustpilot` : p.tagline}</div></div></div>
          <a className="btn ghost" style={{ width: '100%' }} href={`/providers/${p.slug}`}>{p.name} review and plans</a>
          <a className="btn acc" style={{ width: '100%', marginTop: 8 }} href={go} target="_blank" rel="noopener sponsored nofollow">Visit {p.name}</a>
        </aside>
      </div>
    </>
  )
}
