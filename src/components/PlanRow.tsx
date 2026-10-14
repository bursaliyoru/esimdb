import type { Currency } from '@/lib/format'
import { dataLabel, money, perGbUsd } from '@/lib/format'
import type { PlanWithProvider } from '@/lib/data'
import { ProviderMark } from './ProviderMark'
import { Signal } from './Signal'
import { CompareButton, type ComparePlan } from './Compare'

export function buyHref(providerSlug: string, planId?: number | string, src?: string) {
  const q = new URLSearchParams()
  if (planId != null) q.set('plan', String(planId))
  if (src) q.set('src', src)
  return `/go/${providerSlug}${q.size ? `?${q}` : ''}`
}

export function toComparePlan(p: PlanWithProvider, cur: Currency, src: string): ComparePlan {
  const pg = perGbUsd(p)
  const scope = p.scope === 'single' ? 'Single country' : p.scope === 'global' ? 'Global' : 'Regional'
  return {
    id: String(p.id),
    provider: p.provider.name,
    providerSlug: p.provider.slug,
    providerColor: p.provider.brandColor || '#0B2027',
    rating: p.provider.trustScore ?? null,
    name: p.name,
    data: dataLabel(p.dataMb, p.dailyMb),
    days: p.validityDays,
    price: money(p.priceUsd, cur),
    priceUsd: p.priceUsd,
    perGb: pg ? money(pg, cur) : '',
    perGbUsd: pg,
    dataMb: p.dataMb ?? null,
    scope,
    network: p.network || '—',
    fiveG: Boolean(p.fiveG),
    hotspot: Boolean(p.hotspot),
    phone: Boolean(p.phoneNumber),
    topUp: Boolean(p.provider.topUp),
    buyHref: buyHref(p.provider.slug, p.id, src),
  }
}

export function PlanRow({ plan, cur, best, src }: { plan: PlanWithProvider; cur: Currency; best?: boolean; src: string }) {
  const pr = plan.provider
  const pg = perGbUsd(plan)
  const tags: { t: string; c?: string }[] = []
  if (plan.scope !== 'single') tags.push({ t: plan.scope === 'global' ? 'Global' : 'Regional' })
  if (plan.fiveG) tags.push({ t: '5G', c: 'g' })
  if (plan.hotspot) tags.push({ t: 'Hotspot' })
  if (plan.phoneNumber) tags.push({ t: 'Phone number' })
  if (plan.originalPriceUsd && plan.originalPriceUsd > plan.priceUsd)
    tags.push({ t: `${Math.round((1 - plan.priceUsd / plan.originalPriceUsd) * 100)}% off`, c: 'd' })
  if (plan.newUsersOnly) tags.push({ t: 'New users only', c: 'w' })
  return (
    <article className={`plan${best ? ' best' : ''}`}>
      {best && <div className="ribbon">Best price per GB</div>}
      <div className="prov">
        <ProviderMark provider={pr} />
        <div className="t">
          <div className="pn">
            <a href={`/providers/${pr.slug}`}>{pr.name}</a>
            {pr.trustScore ? <span className="rate" title="Trustpilot TrustScore">★ {pr.trustScore.toFixed(1)}</span> : null}
          </div>
          <div className="nm" title={plan.name}>
            {plan.network || plan.name}
          </div>
          <div className="tags">
            {tags.map((x) => (
              <span key={x.t} className={`tag${x.c ? ' ' + x.c : ''}`}>
                {x.t}
              </span>
            ))}
          </div>
        </div>
      </div>
      <div className="spec">
        <div>
          <div className="k">Data</div>
          <div className="v">
            <Signal dataMb={plan.dataMb} />
            {dataLabel(plan.dataMb, plan.dailyMb)}
          </div>
        </div>
        <div>
          <div className="k">Validity</div>
          <div className="v">{plan.validityDays} days</div>
        </div>
        <div>
          <div className="k">Per GB</div>
          <div className="v">{pg ? money(pg, cur) : '∞'}</div>
        </div>
      </div>
      <div className="price">
        {plan.originalPriceUsd && plan.originalPriceUsd > plan.priceUsd ? <div className="old">{money(plan.originalPriceUsd, cur)}</div> : null}
        <div className="v">{money(plan.priceUsd, cur)}</div>
      </div>
      <div className="acts">
        <a className="btn acc" href={buyHref(pr.slug, plan.id, src)} target="_blank" rel="noopener sponsored nofollow">
          Buy
        </a>
        <CompareButton plan={toComparePlan(plan, cur, src)} />
      </div>
    </article>
  )
}
