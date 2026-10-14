import type { Metadata } from 'next'
import { buildRanking, getCountries, getRanking } from '@/lib/data'
import { getCurrency } from '@/components/currency'
import { RankingView } from './RankingView'

export const metadata: Metadata = { title: `Best eSIM for travel (${new Date().getFullYear()})`, description: 'The 10 best travel eSIM providers ranked by price per GB, Trustpilot rating, coverage and features. Updated daily.' }

export default async function BestEsimPage() {
  const cur = await getCurrency()
  const ranking = await getRanking('global')
  const rows = await buildRanking({ ranking })
  const countries = (await getCountries()).filter((c) => c.popular)
  return (
    <>
      <section className="chead"><div className="wrap"><div className="crumb"><a href="/">Home</a> / Best eSIMs</div><h1>{ranking?.title || 'Best eSIM for travel'}</h1><p className="sub">{ranking?.intro}</p>
        <div className="net"><span className="lbl">By country</span>{countries.map((c) => <a className="n" key={c.id} href={`/best-esim/${c.slug}`} style={{ textDecoration: 'none' }}>{c.flag} {c.name}</a>)}</div>
      </div></section>
      <section className="wrap" style={{ paddingBlock: '28px 80px' }}><RankingView rows={rows} cur={cur} src="best-esim" /></section>
    </>
  )
}
