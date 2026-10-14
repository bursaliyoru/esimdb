import { getAllActivePlans, getCountries, getPlansForCountry, getProviders, cheapestByCountry } from '@/lib/data'
import { getCurrency } from '@/components/currency'
import { money, dataLabel } from '@/lib/format'
import { SearchBox } from '@/components/SearchBox'
import { PhoneShowcase, type ShowcaseSet } from '@/components/PhoneShowcase'
import { ProviderMark } from '@/components/ProviderMark'

const TINT: Record<string, string> = { TR: '#E30A17', US: '#3C3B6E', JP: '#BC002D', DE: '#FFCE00', FR: '#0055A4', IT: '#009246', ES: '#C60B1E', GB: '#012169', GR: '#0D5EAF', TH: '#2D2A4A', KR: '#0047A0', AE: '#00732F', MX: '#006847', CN: '#DE2910' }

export default async function Home() {
  const cur = await getCurrency()
  const [countries, providers, mins] = await Promise.all([getCountries(), getProviders(), cheapestByCountry()])
  const withPlans = countries.filter((c) => (mins.get(String(c.id))?.count ?? 0) > 0)
  const showcase: ShowcaseSet[] = []
  for (const c of withPlans.filter((x) => x.popular).slice(0, 4)) {
    const plans = (await getPlansForCountry(c.id))
      .filter((p) => p.scope === 'single' && p.dataMb != null && p.dataMb >= 10 * 1024)
      .sort((a, b) => a.priceUsd - b.priceUsd)
      .slice(0, 4)
    if (plans.length) showcase.push({ name: c.name, flag: c.flag || '', rows: plans.map((p) => ({ provider: p.provider.name, color: p.provider.brandColor || '#0B2027', data: dataLabel(p.dataMb), days: p.validityDays, price: money(p.priceUsd, cur) })) })
  }
  const uniquePlans = (await getAllActivePlans()).length
  const popular = withPlans.filter((c) => c.popular)

  return (
    <>
      <section className="hero">
        <div className="wrap">
          <div>
            <span className="pill"><b>DAILY</b>{providers.length} providers, {uniquePlans} plans, prices refreshed every 24 hours</span>
            <h1>Travel data abroad, <em>for less</em>.</h1>
            <p className="lead">Type your destination. We line up every eSIM provider&apos;s plans by price, cost per GB, validity and network quality.</p>
            <SearchBox countries={withPlans.map((c) => ({ slug: c.slug, name: c.name, flag: c.flag || '', from: money(mins.get(String(c.id))?.min, cur) }))} />
            <div className="chips">
              <span className="lbl">Popular:</span>
              {popular.slice(0, 6).map((c) => (
                <a className="chip" key={c.id} href={`/esim/${c.slug}`}>{c.flag} {c.name}</a>
              ))}
            </div>
            <div className="hstats">
              <div><b className="num">{providers.length}</b>providers</div>
              <div><b className="num">{uniquePlans}</b>data plans</div>
              <div><b className="num">{withPlans.length}</b>destinations</div>
            </div>
          </div>
          <PhoneShowcase sets={showcase} />
        </div>
      </section>
      <section className="logos">
        <div className="wrap">
          <span className="lbl">Providers we compare</span>
          <div className="row">
            {providers.map((p) => (
              <a className="lg" key={p.id} href={`/providers/${p.slug}`}><ProviderMark provider={p} size={24} />{p.name}</a>
            ))}
          </div>
        </div>
      </section>
      <section className="sec wrap" id="destinations">
        <div className="sec-h"><div><span className="eyebrow">Destinations</span><h2>Where are you going?</h2><p className="sub">Prices start at the cheapest single-country plan for each destination.</p></div></div>
        <div className="dest-grid">
          {withPlans.map((c) => (
            <a className="dest" key={c.id} href={`/esim/${c.slug}`} style={{ ['--tint' as string]: TINT[c.iso2] || '#3EE0B3' }}>
              <span className="fl">{c.flag}</span>
              <span className="cnt">{mins.get(String(c.id))?.count} plans</span>
              <span className="n">{c.name}</span>
              <span className="row">
                <span className="p">from<b>{money(mins.get(String(c.id))?.min, cur)}</b></span>
                <span className="go"><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M13 6l6 6-6 6" /></svg></span>
              </span>
            </a>
          ))}
        </div>
      </section>
      <section className="sec wrap" style={{ paddingTop: 8 }}>
        <div className="sec-h"><div><span className="eyebrow">How it works</span><h2>Connected in three steps</h2></div></div>
        <div className="steps">
          {[
            ['01', 'Pick your destination', 'See single-country and regional plans in one list.'],
            ['02', 'Compare', 'Filter by price, cost per GB, validity, 5G and hotspot support.'],
            ['03', 'Scan the QR code', 'Buy from the provider, scan the QR code, and you are online when you land.'],
          ].map(([n, h, p]) => (
            <div className="step" key={n}><span className="no">{n}</span><h3>{h}</h3><p>{p}</p></div>
          ))}
        </div>
      </section>
      <section className="sec wrap" style={{ paddingTop: 8 }}>
        <div className="split">
          <div><span className="eyebrow">FAQ</span><h2>eSIM questions, answered</h2></div>
          <div className="faq">
            <details open><summary>What is an eSIM?</summary><p>A digital SIM built into your phone. You install a travel data plan by scanning a QR code, with no physical card.</p></details>
            <details><summary>Does my phone support eSIM?</summary><p>Most phones from the last few years do, including iPhone XS and later, Google Pixel 3 and later, and Samsung Galaxy S20 and later. Carrier-locked phones may not accept another eSIM.</p></details>
            <details><summary>Do I keep my normal number?</summary><p>Yes. Your home SIM stays active for calls and texts while the travel eSIM handles data.</p></details>
            <details><summary>Why do prices differ so much?</summary><p>Providers buy data from different local networks at different rates, so the same 10 GB can cost several times more from one brand than another. That gap is what this site shows.</p></details>
          </div>
        </div>
      </section>
    </>
  )
}
