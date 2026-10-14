'use client'
import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react'

export type ComparePlan = {
  id: string
  provider: string
  providerSlug: string
  providerColor: string
  rating: number | null
  name: string
  data: string
  days: number
  price: string
  priceUsd: number
  perGb: string
  perGbUsd: number | null
  dataMb: number | null
  scope: string
  network: string
  fiveG: boolean
  hotspot: boolean
  phone: boolean
  topUp: boolean
  buyHref: string
}

type Ctx = { items: ComparePlan[]; toggle: (p: ComparePlan) => void; has: (id: string) => boolean }
const CompareCtx = createContext<Ctx | null>(null)

export function CompareProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ComparePlan[]>([])
  const toggle = (p: ComparePlan) =>
    setItems((cur) => (cur.some((x) => x.id === p.id) ? cur.filter((x) => x.id !== p.id) : [...cur.slice(-2), p]))
  return (
    <CompareCtx.Provider value={{ items, toggle, has: (id) => items.some((x) => x.id === id) }}>
      {children}
      <CompareTray items={items} remove={(id) => setItems((c) => c.filter((x) => x.id !== id))} />
    </CompareCtx.Provider>
  )
}

export function CompareButton({ plan, label = 'Compare', added = '✓ Added' }: { plan: ComparePlan; label?: string; added?: string }) {
  const ctx = useContext(CompareCtx)
  if (!ctx) return null
  const on = ctx.has(plan.id)
  return (
    <button type="button" className="btn ghost" aria-pressed={on} onClick={() => ctx.toggle(plan)}>
      {on ? added : label}
    </button>
  )
}

function CompareTray({ items, remove }: { items: ComparePlan[]; remove: (id: string) => void }) {
  const dlg = useRef<HTMLDialogElement>(null)
  useEffect(() => {
    if (items.length < 2 && dlg.current?.open) dlg.current.close()
  }, [items.length])
  if (!items.length) return null
  const min = (f: (p: ComparePlan) => number | null) => Math.min(...items.map((p) => f(p) ?? Infinity))
  const max = (f: (p: ComparePlan) => number) => Math.max(...items.map(f))
  const cheapest = min((p) => p.priceUsd)
  const bestGb = min((p) => p.perGbUsd)
  const longest = max((p) => p.days)
  const most = max((p) => (p.dataMb == null ? Infinity : p.dataMb))
  const row = (label: string, cell: (p: ComparePlan) => ReactNode, win?: (p: ComparePlan) => boolean) => (
    <tr>
      <th>{label}</th>
      {items.map((p) => (
        <td key={p.id} className={win?.(p) ? 'win' : ''}>
          {cell(p)}
        </td>
      ))}
    </tr>
  )
  const yn = (b: boolean) => (b ? 'Yes' : 'No')
  return (
    <>
      <div className="tray">
        <div className="wrap">
          <div className="inner">
            <strong>Compare</strong>
            <div className="items">
              {items.map((p) => (
                <span className="it" key={p.id}>
                  {p.provider} · {p.data} / {p.days}d
                  <button type="button" aria-label={`Remove ${p.provider}`} onClick={() => remove(p.id)}>
                    ×
                  </button>
                </span>
              ))}
              {items.length < 3 && <span style={{ fontSize: 13, opacity: 0.7, alignSelf: 'center' }}>up to 3 plans</span>}
            </div>
            <button className="btn" type="button" disabled={items.length < 2} style={{ opacity: items.length < 2 ? 0.5 : 1 }} onClick={() => dlg.current?.showModal()}>
              Compare side by side
            </button>
          </div>
        </div>
      </div>
      <dialog ref={dlg} aria-labelledby="cmpTitle">
        <div className="dlg-h">
          <h2 id="cmpTitle">Plan comparison</h2>
          <button className="x" type="button" aria-label="Close" onClick={() => dlg.current?.close()}>
            ×
          </button>
        </div>
        <div className="tbl-wrap">
          <table className="cmp">
            <thead>
              <tr>
                <th />
                {items.map((p) => (
                  <td key={p.id}>
                    <b>{p.provider}</b>
                    <div style={{ fontSize: 13, color: 'var(--muted)' }}>{p.name}</div>
                  </td>
                ))}
              </tr>
            </thead>
            <tbody>
              {row('Price', (p) => <span className="num">{p.price}</span>, (p) => p.priceUsd === cheapest)}
              {row('Data', (p) => <span className="num">{p.data}</span>, (p) => (p.dataMb == null ? Infinity : p.dataMb) === most)}
              {row('Validity', (p) => <span className="num">{p.days} days</span>, (p) => p.days === longest)}
              {row('Price per GB', (p) => (p.perGbUsd ? <span className="num">{p.perGb}</span> : 'Unlimited'), (p) => p.perGbUsd != null && p.perGbUsd === bestGb)}
              {row('Coverage', (p) => p.scope)}
              {row('Network', (p) => p.network)}
              {row('5G', (p) => yn(p.fiveG), (p) => p.fiveG)}
              {row('Hotspot', (p) => yn(p.hotspot), (p) => p.hotspot)}
              {row('Phone number', (p) => yn(p.phone))}
              {row('Top-up', (p) => yn(p.topUp))}
              {row('Trustpilot', (p) => (p.rating ? `${p.rating.toFixed(1)} ★` : '—'))}
              <tr>
                <th />
                {items.map((p) => (
                  <td key={p.id}>
                    <a className="btn acc" href={p.buyHref} target="_blank" rel="noopener sponsored nofollow">
                      Buy
                    </a>
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
      </dialog>
    </>
  )
}
