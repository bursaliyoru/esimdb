import type { Metadata } from 'next'
import { getAllActivePlans, getProviders } from '@/lib/data'
import { getCurrency } from '@/components/currency'
import { money } from '@/lib/format'
import { ProviderMark } from '@/components/ProviderMark'

export const metadata: Metadata = { title: 'eSIM providers', description: 'Every travel eSIM provider we track, with Trustpilot ratings, features and starting prices.' }

export default async function ProvidersPage() {
  const cur = await getCurrency()
  const [providers, plans] = await Promise.all([getProviders(), getAllActivePlans()])
  return (
    <>
      <section className="chead"><div className="wrap"><div className="crumb"><a href="/">Home</a> / Providers</div><h1>eSIM providers</h1><p className="sub">Ratings come from Trustpilot and refresh daily together with prices.</p></div></section>
      <section className="wrap">
        <div className="prov-grid">
          {providers.map((p) => {
            const mine = plans.filter((x) => x.provider.id === p.id)
            const min = mine.length ? Math.min(...mine.map((x) => x.priceUsd)) : null
            const ft = [p.topUp && 'Top-up', p.hotspot && 'Hotspot', p.phoneNumber && 'Phone number', mine.some((x) => x.dataMb == null) && 'Unlimited'].filter(Boolean) as string[]
            return (
              <a className="pcard" key={p.id} href={`/providers/${p.slug}`}>
                <div className="top-r">
                  <ProviderMark provider={p} size={48} />
                  <div>
                    <div className="nmn">{p.name}</div>
                    <div className="d">{p.trustScore ? <><span className="stars">★</span> {p.trustScore.toFixed(1)} on Trustpilot{p.trustReviewCount ? ` · ${p.trustReviewCount.toLocaleString('en-US')} reviews` : ''}</> : p.tagline}</div>
                  </div>
                </div>
                <div className="ft">{ft.map((x) => <span className="tag" key={x}>{x}</span>)}</div>
                <div className="from"><span>{mine.length} plans</span><span>from <b>{money(min, cur)}</b></span></div>
              </a>
            )
          })}
        </div>
      </section>
    </>
  )
}
