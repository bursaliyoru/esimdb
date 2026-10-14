import type { Metadata } from 'next'
import { getCoupons, getProviders, isCouponLive } from '@/lib/data'
import { formatDate } from '@/lib/format'
import { ProviderMark } from '@/components/ProviderMark'
import { CopyButton } from '@/components/CopyButton'

export const metadata: Metadata = { title: 'eSIM promo codes and discount codes', description: 'Working promo codes for Airalo, Holafly, Saily, Nomad and every other travel eSIM provider. Checked regularly.' }

export default async function PromoCodesPage() {
  const [coupons, providers] = await Promise.all([getCoupons(), getProviders()])
  const live = coupons.filter((c) => isCouponLive(c))
  return (
    <>
      <section className="chead"><div className="wrap"><div className="crumb"><a href="/">Home</a> / Promo codes</div><h1>eSIM promo codes</h1><p className="sub">{live.length} working codes across {new Set(live.map((c) => c.provider.id)).size} providers.</p></div></section>
      <section className="wrap" style={{ paddingBlock: '28px 60px', display: 'grid', gap: 12 }}>
        {live.map((c) => (
          <div className="coupon-row" key={c.id}>
            <div className="lab">{c.discountLabel || 'DEAL'}</div>
            <div style={{ minWidth: 0 }}>
              <h3><a href={`/promo-codes/${c.provider.slug}`} style={{ color: 'inherit' }}>{c.provider.name}</a>: {c.title}</h3>
              <div className="m">{c.exclusive && <span className="tag d" style={{ marginRight: 6 }}>Exclusive</span>}{c.newUsersOnly ? 'New customers · ' : ''}{c.verifiedAt ? `Verified ${formatDate(c.verifiedAt)}` : ''}{c.expiresAt ? ` · Expires ${formatDate(c.expiresAt)}` : ''}</div>
            </div>
            <div className="act"><div className="codebox"><code>{c.code}</code><CopyButton text={c.code} /></div></div>
          </div>
        ))}
        <h2 style={{ fontFamily: 'var(--f-display)', marginTop: 30 }}>Codes by provider</h2>
        <div className="prov-grid" style={{ paddingBlock: 0 }}>
          {providers.map((p) => {
            const n = live.filter((c) => c.provider.id === p.id).length
            return (
              <a className="pcard" key={p.id} href={`/promo-codes/${p.slug}`}>
                <div className="top-r"><ProviderMark provider={p} size={40} /><div><div className="nmn">{p.name} promo codes</div><div className="d">{n ? `${n} working code${n > 1 ? 's' : ''}` : 'No active code right now'}</div></div></div>
              </a>
            )
          })}
        </div>
      </section>
    </>
  )
}
