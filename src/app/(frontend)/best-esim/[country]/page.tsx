import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { buildRanking, getCountry, getRanking } from '@/lib/data'
import { getCurrency } from '@/components/currency'
import { RankingView } from '../RankingView'

type Props = { params: Promise<{ country: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const c = await getCountry((await params).country)
  if (!c) return {}
  return { title: `Best eSIM for ${c.name} (${new Date().getFullYear()})`, description: `The best ${c.name} eSIMs ranked by price per GB, Trustpilot rating, coverage and features. Updated daily.`, alternates: { canonical: `/best-esim/${c.slug}` } }
}

export default async function BestEsimCountry({ params }: Props) {
  const c = await getCountry((await params).country)
  if (!c) notFound()
  const cur = await getCurrency()
  const ranking = await getRanking(c.slug)
  const rows = await buildRanking({ ranking, country: c })
  return (
    <>
      <section className="chead"><div className="wrap"><div className="crumb"><a href="/best-esim">Best eSIMs</a> / {c.name}</div><h1><span className="fl">{c.flag}</span>{ranking?.title || `Best eSIM for ${c.name}`}</h1>
        <p className="sub">{ranking?.intro || `The best ${c.name} eSIMs ranked by price per GB, Trustpilot rating, coverage and features.`}</p>
        <div className="cstats"><div><a href={`/esim/${c.slug}`} style={{ color: 'var(--mint)', fontWeight: 700 }}>Compare all {c.name} plans →</a></div></div>
      </div></section>
      <section className="wrap" style={{ paddingBlock: '28px 80px' }}>{rows.length ? <RankingView rows={rows} cur={cur} src={`best-esim/${c.slug}`} /> : <div className="empty">No plans for {c.name} yet.</div>}</section>
    </>
  )
}
