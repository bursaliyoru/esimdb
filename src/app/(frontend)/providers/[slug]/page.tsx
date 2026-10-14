import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { getCoupons, getPlansForProvider, getProvider, getReviews, isCouponLive, siteRatingSummary, planCountryIds, getCountries } from '@/lib/data'
import { getCurrency } from '@/components/currency'
import { dataLabel, formatDate, money, perGbUsd } from '@/lib/format'
import { ProviderMark } from '@/components/ProviderMark'
import { Stars, TrustpilotBadge } from '@/components/Stars'
import { ReviewForm } from '@/components/ReviewForm'
import { CopyButton } from '@/components/CopyButton'
import { buyHref } from '@/components/PlanRow'

type Props = { params: Promise<{ slug: string }>; searchParams: Promise<{ country?: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const p = await getProvider((await params).slug)
  if (!p) return {}
  return { title: `${p.name} eSIM review, prices and promo codes`, description: `${p.name} eSIM plans, prices by country, Trustpilot rating and user reviews.`, alternates: { canonical: `/providers/${p.slug}` } }
}

export default async function ProviderPage({ params, searchParams }: Props) {
  const p = await getProvider((await params).slug)
  if (!p) notFound()
  const cur = await getCurrency()
  const [plans, coupons, tp, site, mine, countries] = await Promise.all([
    getPlansForProvider(p.id), getCoupons(p.id), getReviews(p.id, 'trustpilot', 8), getReviews(p.id, 'site', 30), siteRatingSummary(p.id), getCountries(),
  ])
  const live = coupons.filter((c) => isCouponLive(c))
  const singleCountryIds = new Set(plans.filter((x) => x.scope === 'single').flatMap((x) => planCountryIds(x).map(String)))
  const cs = countries.filter((c) => singleCountryIds.has(String(c.id)))
  const want = (await searchParams).country
  const selected = cs.find((c) => c.slug === want) ?? cs[0]
  const rows = selected ? plans.filter((x) => x.scope === 'single' && planCountryIds(x).map(String).includes(String(selected.id))).sort((a, b) => a.priceUsd - b.priceUsd) : []
  const yes = (b?: boolean | null) => (b ? <span className="yes">Yes</span> : 'No')

  return (
    <>
      <section className="chead" style={{ ['--tint' as string]: p.brandColor || '#3EE0B3' }}>
        <div className="wrap">
          <div className="crumb"><a href="/providers">Providers</a> / {p.name}</div>
          <h1><ProviderMark provider={p} size={52} />{p.name}</h1>
          <p className="sub">{p.tagline}</p>
          <div className="cstats">
            {p.trustScore ? <div><b>{p.trustScore.toFixed(1)}</b>Trustpilot score</div> : null}
            {mine ? <div><b>{mine.avg.toFixed(1)}</b>{mine.count} reviews here</div> : null}
            <div><b>{plans.length}</b>plans</div>
            <div><b>{cs.length}</b>countries</div>
          </div>
        </div>
      </section>
      <div className="pgrid wrap">
        <div className="stack">
          {live.length > 0 && (
            <div className="sec-card">
              <h2>{p.name} promo codes</h2>
              {live.slice(0, 2).map((c) => (
                <div key={c.id} className="coupon" style={{ marginTop: 8 }}><code>{c.code}</code><span style={{ fontSize: 13, color: 'var(--muted)' }}>{c.title}</span><CopyButton text={c.code} /></div>
              ))}
              <a href={`/promo-codes/${p.slug}`} style={{ display: 'inline-block', marginTop: 12, fontWeight: 700 }}>All {p.name} promo codes →</a>
            </div>
          )}
          <div className="sec-card">
            <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', marginBottom: 12 }}>
              <h2 style={{ margin: 0 }}>Plans</h2>
              <form style={{ marginLeft: 'auto', display: 'flex', gap: 8, alignItems: 'center' }}>
                <label htmlFor="pc" style={{ fontSize: 14, color: 'var(--muted)' }}>Country</label>
                <select id="pc" name="country" defaultValue={selected?.slug} style={{ padding: '8px 10px', borderRadius: 10, border: '1px solid var(--line)', background: 'var(--bg)' }}>
                  {cs.map((c) => <option key={c.id} value={c.slug}>{c.flag} {c.name}</option>)}
                </select>
                <button className="btn ghost" type="submit" style={{ padding: '7px 12px' }}>Show</button>
              </form>
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table className="ptable">
                <thead><tr><th>Plan</th><th className="r">Data</th><th className="r">Validity</th><th className="r">Per GB</th><th className="r">Price</th><th /></tr></thead>
                <tbody>
                  {rows.map((r) => {
                    const pg = perGbUsd(r)
                    return (
                      <tr key={r.id}>
                        <td>{r.name}{r.fiveG ? <> <span className="tag g">5G</span></> : null}</td>
                        <td className="r num">{dataLabel(r.dataMb, r.dailyMb)}</td>
                        <td className="r num">{r.validityDays} days</td>
                        <td className="r num">{pg ? money(pg, cur) : '—'}</td>
                        <td className="r num"><b>{money(r.priceUsd, cur)}</b></td>
                        <td className="r"><a className="btn acc" style={{ padding: '6px 12px' }} href={buyHref(p.slug, r.id, `providers/${p.slug}`)} target="_blank" rel="noopener sponsored nofollow">Buy</a></td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>

          <div className="sec-card" id="trustpilot">
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginBottom: 6 }}>
              <h2 style={{ margin: 0 }}>Reviews from Trustpilot</h2>
              <TrustpilotBadge />
              {p.trustpilotDomain && <a style={{ marginLeft: 'auto', fontSize: 14 }} href={`https://www.trustpilot.com/review/${p.trustpilotDomain}`} target="_blank" rel="noopener nofollow">See all on Trustpilot →</a>}
            </div>
            {p.trustScore ? (
              <p className="method" style={{ marginTop: 0 }}>TrustScore {p.trustScore.toFixed(1)} out of 5{p.trustReviewCount ? ` from ${p.trustReviewCount.toLocaleString('en-US')} reviews` : ''}. Updated {formatDate(p.trustUpdatedAt)}.</p>
            ) : null}
            {tp.docs.length ? tp.docs.map((r) => (
              <div className="review" key={r.id}>
                <div className="meta"><Stars value={r.rating} /><span className="rt">{r.authorName}</span>{r.authorCountry && <span>{r.authorCountry}</span>}<span>{formatDate(r.publishedAt)}</span>
                  <a className="src-badge tpb" href={r.externalUrl || `https://www.trustpilot.com/review/${p.trustpilotDomain}`} target="_blank" rel="noopener nofollow">Review via Trustpilot</a></div>
                {r.title && <b>{r.title}</b>}
                <p>{r.body}</p>
              </div>
            )) : <p className="method">Trustpilot reviews appear here after the next daily update.</p>}
          </div>

          <div className="sec-card" id="reviews">
            <h2>Reviews from our readers{mine ? <span style={{ fontSize: 15, fontWeight: 600, color: 'var(--muted)', marginLeft: 10 }}><Stars value={mine.avg} /> {mine.avg.toFixed(1)} · {mine.count}</span> : null}</h2>
            {site.docs.length ? site.docs.map((r) => (
              <div className="review" key={r.id}>
                <div className="meta"><Stars value={r.rating} /><span className="rt">{r.authorName}</span>{r.authorCountry && <span>used in {r.authorCountry}</span>}<span>{formatDate(r.publishedAt)}</span></div>
                {r.title && <b>{r.title}</b>}
                <p>{r.body}</p>
              </div>
            )) : <p className="method" style={{ marginTop: 0 }}>No reader reviews yet. Be the first to share how {p.name} worked for you.</p>}
          </div>

          <div className="sec-card" id="write-review">
            <h2>Write a review</h2>
            <ReviewForm providerSlug={p.slug} providerName={p.name} />
          </div>
        </div>
        <aside className="card">
          <dl className="facts">
            {p.headquarters && <><dt>Headquarters</dt><dd>{p.headquarters}</dd></>}
            {p.founded && <><dt>Founded</dt><dd className="num">{p.founded}</dd></>}
            <dt>Mobile app</dt><dd>{yes(p.hasApp)}</dd>
            <dt>Top-up</dt><dd>{yes(p.topUp)}</dd>
            <dt>Hotspot</dt><dd>{yes(p.hotspot)}</dd>
            <dt>Phone number</dt><dd>{yes(p.phoneNumber)}</dd>
            {p.kyc && <><dt>ID check</dt><dd>{p.kyc}</dd></>}
          </dl>
          {p.description && <p style={{ fontSize: 14, color: 'var(--muted)' }}>{p.description}</p>}
          <a className="btn acc" style={{ marginTop: 16, width: '100%' }} href={buyHref(p.slug, undefined, `providers/${p.slug}`)} target="_blank" rel="noopener sponsored nofollow">Visit {p.name}</a>
          <a className="btn ghost" style={{ marginTop: 8, width: '100%' }} href="#write-review">Write a review</a>
        </aside>
      </div>
    </>
  )
}
