import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { getCountry, getPlansForCountry, type PlanWithProvider } from '@/lib/data'
import { getCurrency } from '@/components/currency'
import { money, perGbUsd, dataLabel } from '@/lib/format'
import { Filters, SortBar, type FilterState } from '@/components/Filters'
import { CompareProvider, CompareButton } from '@/components/Compare'
import { PlanRow, toComparePlan } from '@/components/PlanRow'
import { ProviderMark } from '@/components/ProviderMark'
import type { Region } from '@/payload-types'

type Props = { params: Promise<{ country: string }>; searchParams: Promise<Record<string, string | undefined>> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const c = await getCountry((await params).country)
  if (!c) return {}
  return {
    title: `${c.name} eSIM: compare plans and prices`,
    description: `Compare ${c.name} eSIM data plans from every major provider by price, data, validity and network. Updated daily.`,
    alternates: { canonical: `/esim/${c.slug}` },
  }
}

function readFilters(sp: Record<string, string | undefined>): FilterState {
  const n = (v: string | undefined, d: number) => (v && Number.isFinite(+v) ? +v : d)
  return {
    scope: sp.scope === 'all' ? 'all' : 'single',
    minGb: n(sp.minGb, 0),
    minDays: n(sp.minDays, 0),
    max: n(sp.max, 100),
    fiveG: sp.fiveG === '1',
    hotspot: sp.hotspot === '1',
    unlimited: sp.unlimited === '1',
    phone: sp.phone === '1',
    provider: sp.provider || '',
    sort: sp.sort || 'price',
  }
}

function applyFilters(plans: PlanWithProvider[], f: FilterState) {
  const out = plans.filter(
    (p) =>
      (f.scope === 'all' || p.scope === 'single') &&
      (p.dataMb == null || p.dataMb >= f.minGb * 1024) &&
      p.validityDays >= f.minDays &&
      (f.max >= 100 || p.priceUsd <= f.max) &&
      (!f.fiveG || p.fiveG) &&
      (!f.hotspot || p.hotspot) &&
      (!f.unlimited || p.dataMb == null) &&
      (!f.phone || p.phoneNumber) &&
      (!f.provider || p.provider.slug === f.provider),
  )
  const big = 1e12
  const sorters: Record<string, (a: PlanWithProvider, b: PlanWithProvider) => number> = {
    price: (a, b) => a.priceUsd - b.priceUsd,
    pergb: (a, b) => (perGbUsd(a) ?? big) - (perGbUsd(b) ?? big),
    data: (a, b) => (b.dataMb ?? big) - (a.dataMb ?? big) || a.priceUsd - b.priceUsd,
    days: (a, b) => b.validityDays - a.validityDays || a.priceUsd - b.priceUsd,
  }
  return out.sort(sorters[f.sort] ?? sorters.price)
}

export default async function CountryPage({ params, searchParams }: Props) {
  const { country } = await params
  const c = await getCountry(country)
  if (!c) notFound()
  const cur = await getCurrency()
  const f = readFilters(await searchParams)
  const all = await getPlansForCountry(c.id)
  const single = all.filter((p) => p.scope === 'single')
  const plans = applyFilters(all, f)
  const providers = [...new Map(all.map((p) => [p.provider.slug, { slug: p.provider.slug, name: p.provider.name }])).values()].sort((a, b) => a.name.localeCompare(b.name))
  const cands = plans.filter((p) => perGbUsd(p) != null && (p.dataMb ?? 0) >= 3 * 1024)
  const best = cands.length ? cands.reduce((a, b) => ((perGbUsd(a) as number) <= (perGbUsd(b) as number) ? a : b)).id : null
  const cheapest = [...single].sort((a, b) => a.priceUsd - b.priceUsd)[0]
  const bestGb = single.filter((p) => (p.dataMb ?? 0) >= 5 * 1024 && perGbUsd(p) != null).sort((a, b) => (perGbUsd(a) as number) - (perGbUsd(b) as number))[0]
  const unl = all.filter((p) => p.dataMb == null && !p.dailyMb).sort((a, b) => a.priceUsd / a.validityDays - b.priceUsd / b.validityDays)[0]
  const regions = (c.regions ?? []).filter((r): r is Region => typeof r === 'object' && r !== null)
  const src = `esim/${c.slug}`

  const hcard = (label: string, p: PlanWithProvider | undefined, sub: string, deal = false) =>
    p ? (
      <div className="hcard">
        <span className={`k${deal ? ' d' : ''}`}>{label}</span>
        <div className="m">
          <ProviderMark provider={p.provider} />
          <span className="t"><b>{p.provider.name}</b>{dataLabel(p.dataMb, p.dailyMb)} · {p.validityDays} days</span>
          <span className="pr">{money(p.priceUsd, cur)}<small>{sub}</small></span>
        </div>
        <CompareButton plan={toComparePlan(p, cur, src)} label="Add to compare" added="✓ In compare" />
      </div>
    ) : null

  return (
    <CompareProvider>
      <section className="chead" style={{ ['--tint' as string]: '#3EE0B3' }}>
        <div className="wrap">
          <div className="crumb"><a href="/">Destinations</a> / {c.name}</div>
          <h1><span className="fl">{c.flag}</span>{c.name} eSIM plans</h1>
          <p className="sub">{regions.length ? `Regional plans come from ${regions.map((r) => r.name).join(' and ')} bundles.` : 'Single-country plans only.'}</p>
          {c.networks?.length ? (
            <div className="net"><span className="lbl">Local networks</span>{c.networks.map((n) => <span className="n" key={n.id ?? n.name}>{n.name}</span>)}</div>
          ) : null}
          <div className="cstats">
            <div><b>{providers.length}</b>providers</div>
            <div><b>{all.length}</b>plans</div>
            <div><b>{money(cheapest?.priceUsd, cur)}</b>cheapest</div>
            <div><a href={`/best-esim/${c.slug}`} style={{ color: 'var(--mint)', fontWeight: 700 }}>Best eSIMs for {c.name} →</a></div>
          </div>
        </div>
      </section>
      <div className="wrap">
        <div className="hl">
          {hcard('Cheapest plan', cheapest, 'total')}
          {hcard('Best price per GB', bestGb, bestGb ? `${money(perGbUsd(bestGb), cur)} / GB` : '')}
          {hcard('Best unlimited', unl, unl ? `${money(unl.priceUsd / unl.validityDays, cur)} / day` : '', true)}
        </div>
      </div>
      <div className="layout wrap">
        <Filters state={f} providers={providers} cur={cur} />
        <div style={{ minWidth: 0 }}>
          <div className="listhead">
            <span className="count"><b>{plans.length}</b> plans</span>
            <SortBar sort={f.sort} />
          </div>
          <div className="plans">
            {plans.length ? plans.map((p) => <PlanRow key={p.id} plan={p} cur={cur} best={p.id === best} src={src} />) : <div className="empty">No plans match these filters. Try loosening them.</div>}
          </div>
        </div>
      </div>
    </CompareProvider>
  )
}
