import type { RankedRow } from '@/lib/data'
import { dataLabel, formatDate, money, perGbUsd, type Currency } from '@/lib/format'
import { ProviderMark } from '@/components/ProviderMark'
import { CopyButton } from '@/components/CopyButton'
import { buyHref } from '@/components/PlanRow'

const BARS: [keyof RankedRow['score'], string][] = [['price', 'Price'], ['trust', 'Trust'], ['coverage', 'Coverage'], ['features', 'Features'], ['choice', 'Choice']]

export function RankingView({ rows, cur, src }: { rows: RankedRow[]; cur: Currency; src: string }) {
  return (
    <div style={{ display: 'grid', gap: 14 }}>
      {rows.map((r) => {
        const pros = r.entry?.pros?.map((x) => x.text) ?? []
        const cons = r.entry?.cons?.map((x) => x.text) ?? []
        if (!pros.length) {
          if (r.score.price >= 0.8) pros.push('Among the lowest prices per GB')
          if (r.provider.topUp) pros.push('Top up without a new eSIM')
          if (r.provider.hotspot) pros.push('Hotspot / tethering allowed')
          if (r.provider.phoneNumber) pros.push('Optional phone number')
        }
        if (!cons.length) {
          if (!r.provider.hotspot) cons.push('No hotspot on most plans')
          if (!r.provider.topUp) cons.push('No top-ups')
          if (r.score.price < 0.5) cons.push('Higher price per GB than the cheapest options')
        }
        const pg = r.bestPlan ? perGbUsd(r.bestPlan) : null
        return (
          <article className={`rank${r.position === 1 ? ' first' : ''}`} key={r.provider.id}>
            <div className="pos">{r.position}</div>
            <div style={{ minWidth: 0 }}>
              <h3><ProviderMark provider={r.provider} size={36} /><a href={`/providers/${r.provider.slug}`} style={{ color: 'inherit', textDecoration: 'none' }}>{r.provider.name}</a>
                {r.entry?.badge && <span className="tag g">{r.entry.badge}</span>}
                {r.entry?.sponsored && <span className="tag">Sponsored</span>}
              </h3>
              <div className="method" style={{ marginTop: 6 }}>
                {r.provider.trustScore ? `${r.provider.trustScore.toFixed(1)} on Trustpilot · ` : ''}{r.planCount} plans
                {r.cheapestPlan ? ` · from ${money(r.cheapestPlan.priceUsd, cur)}` : ''}
                {r.bestPlan && pg ? ` · best value ${dataLabel(r.bestPlan.dataMb)} for ${money(r.bestPlan.priceUsd, cur)} (${money(pg, cur)}/GB)` : ''}
              </div>
              {r.entry?.note && <p style={{ margin: '10px 0 0' }}>{r.entry.note}</p>}
              <div className="procon">
                <ul className="pro">{pros.slice(0, 4).map((x) => <li key={x}>{x}</li>)}</ul>
                <ul className="con">{cons.slice(0, 3).map((x) => <li key={x}>{x}</li>)}</ul>
              </div>
              {r.coupon && (
                <div className="codebox" style={{ marginTop: 12, display: 'inline-flex' }}><span className="m" style={{ fontSize: 13 }}>{r.coupon.discountLabel || r.coupon.title}</span><code>{r.coupon.code}</code><CopyButton text={r.coupon.code} /></div>
              )}
            </div>
            <div className="side">
              <div className="score"><b>{r.score.total.toFixed(1)}</b><span className="method">/ 10</span></div>
              <div className="bars5">
                {BARS.map(([k, l]) => <div className="b" key={k}><span>{l}</span><span className="t"><i style={{ width: `${Math.round((r.score[k] as number) * 100)}%` }} /></span></div>)}
              </div>
              <a className="btn acc" href={buyHref(r.provider.slug, r.bestPlan?.id, src)} target="_blank" rel="noopener sponsored nofollow">See {r.provider.name} plans</a>
            </div>
          </article>
        )
      })}
      <p className="method">Scores update every day from current prices and Trustpilot ratings. Last calculated {formatDate(new Date())}. <a href="/how-we-rank">How we rank</a></p>
    </div>
  )
}
