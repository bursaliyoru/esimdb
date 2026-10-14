import type { Metadata } from 'next'
import { WEIGHTS } from '@/lib/ranking'

export const metadata: Metadata = { title: 'How we rank eSIM providers' }

export default function HowWeRank() {
  const rows: [string, number, string][] = [
    ['Price', WEIGHTS.price, 'The provider’s best price per GB in that country, compared with the cheapest provider there.'],
    ['Trust', WEIGHTS.trust, 'The provider’s TrustScore on Trustpilot, refreshed every day.'],
    ['Coverage', WEIGHTS.coverage, 'How many countries the provider sells plans for.'],
    ['Features', WEIGHTS.features, 'Top-ups, hotspot, phone numbers, an app, and the share of plans with 5G.'],
    ['Choice', WEIGHTS.choice, 'How many plans the provider offers for that destination.'],
  ]
  return (
    <article className="doc wrap">
      <div className="crumb"><a href="/">Home</a> / How we rank</div>
      <h1>How we rank eSIM providers</h1>
      <p className="lead">Every Top 10 list starts from an automatic score out of 10. Prices are scraped from each provider every 24 hours, so the order moves when prices do.</p>
      <div className="tw"><table><thead><tr><th>Factor</th><th>Weight</th><th>What it measures</th></tr></thead>
        <tbody>{rows.map(([f, w, d]) => <tr key={f}><td><b>{f}</b></td><td className="num">{Math.round(w * 100)}%</td><td>{d}</td></tr>)}</tbody></table></div>
      <h2>Editorial changes</h2>
      <p>Our editors can pin a provider to a position or remove one, for example after repeated reports of failed activations. Sponsored placements are always labelled “Sponsored”.</p>
      <h2>Reviews</h2>
      <p>Reviews marked “Review via Trustpilot” are published on Trustpilot and link back to the original. Reader reviews are written on this site and checked by a person before they appear.</p>
    </article>
  )
}
