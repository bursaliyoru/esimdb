'use client'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useState, useTransition } from 'react'
import { money, type Currency } from '@/lib/format'

export type FilterState = {
  scope: 'single' | 'all'
  minGb: number
  minDays: number
  max: number
  fiveG: boolean
  hotspot: boolean
  unlimited: boolean
  phone: boolean
  provider: string
  sort: string
}

export function Filters({ state, providers, cur }: { state: FilterState; providers: { slug: string; name: string }[]; cur: Currency }) {
  const router = useRouter()
  const path = usePathname()
  const sp = useSearchParams()
  const [open, setOpen] = useState(false)
  const [, start] = useTransition()
  const [max, setMax] = useState(state.max)

  const set = (k: string, v: string | number | boolean | null) => {
    const q = new URLSearchParams(sp.toString())
    if (v === null || v === '' || v === false || v === 0 || (k === 'max' && v === 100) || (k === 'scope' && v === 'single')) q.delete(k)
    else q.set(k, String(v === true ? 1 : v))
    start(() => router.replace(`${path}${q.size ? `?${q}` : ''}`, { scroll: false }))
  }
  const seg = (k: 'minGb' | 'minDays', opts: [number, string][]) => (
    <div className="seg">
      {opts.map(([v, l]) => (
        <button key={v} type="button" aria-pressed={state[k] === v} onClick={() => set(k, v)}>
          {l}
        </button>
      ))}
    </div>
  )
  return (
    <>
      <button className="btn ghost ftog" type="button" aria-expanded={open} aria-controls="rail" onClick={() => setOpen(!open)}>
        Filters
      </button>
      <aside className={`rail${open ? ' open' : ''}`} id="rail" aria-label="Filters">
        <div>
          <h3>Coverage</h3>
          <div className="seg">
            <button type="button" aria-pressed={state.scope === 'single'} onClick={() => set('scope', 'single')}>Single country</button>
            <button type="button" aria-pressed={state.scope === 'all'} onClick={() => set('scope', 'all')}>+ Regional</button>
          </div>
        </div>
        <div>
          <h3>Minimum data</h3>
          {seg('minGb', [[0, 'Any'], [3, '3 GB+'], [5, '5 GB+'], [10, '10 GB+'], [20, '20 GB+']])}
        </div>
        <div>
          <h3>Minimum validity</h3>
          {seg('minDays', [[0, 'Any'], [7, '7+ days'], [15, '15+ days'], [30, '30+ days']])}
        </div>
        <div className="range">
          <h3><label htmlFor="maxUsd">Maximum price</label></h3>
          <input id="maxUsd" type="range" min={5} max={100} step={5} value={max} onChange={(e) => setMax(+e.target.value)} onPointerUp={() => set('max', max)} onKeyUp={() => set('max', max)} />
          <output htmlFor="maxUsd">{max >= 100 ? 'No limit' : money(max, cur)}</output>
        </div>
        <div>
          <h3>Features</h3>
          {([['fiveG', '5G'], ['hotspot', 'Hotspot / tethering'], ['unlimited', 'Unlimited data'], ['phone', 'Phone number']] as const).map(([k, l]) => (
            <label className="chk" key={k}>
              <input type="checkbox" id={`f-${k}`} checked={state[k]} onChange={(e) => set(k, e.target.checked)} />
              {l}
            </label>
          ))}
        </div>
        <div>
          <h3><label htmlFor="fprov">Provider</label></h3>
          <select id="fprov" value={state.provider} onChange={(e) => set('provider', e.target.value)}>
            <option value="">All providers</option>
            {providers.map((p) => (
              <option key={p.slug} value={p.slug}>{p.name}</option>
            ))}
          </select>
        </div>
        <button className="reset" type="button" onClick={() => start(() => router.replace(path, { scroll: false }))}>
          Reset filters
        </button>
      </aside>
    </>
  )
}

export function SortBar({ sort }: { sort: string }) {
  const router = useRouter()
  const path = usePathname()
  const sp = useSearchParams()
  const opts = [['price', 'Cheapest'], ['pergb', 'Price per GB'], ['data', 'Most data'], ['days', 'Longest']] as const
  return (
    <div className="sort" role="group" aria-label="Sort">
      {opts.map(([k, l]) => (
        <button
          key={k}
          type="button"
          aria-pressed={sort === k}
          onClick={() => {
            const q = new URLSearchParams(sp.toString())
            if (k === 'price') q.delete('sort')
            else q.set('sort', k)
            router.replace(`${path}${q.size ? `?${q}` : ''}`, { scroll: false })
          }}
        >
          {l}
        </button>
      ))}
    </div>
  )
}
