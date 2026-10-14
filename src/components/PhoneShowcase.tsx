'use client'
import { useEffect, useState } from 'react'

export type ShowcaseSet = { name: string; flag: string; rows: { provider: string; color: string; data: string; days: number; price: string }[] }

export function PhoneShowcase({ sets }: { sets: ShowcaseSet[] }) {
  const [i, setI] = useState(0)
  const [swap, setSwap] = useState(false)
  useEffect(() => {
    if (sets.length < 2 || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const t = setInterval(() => {
      setSwap(true)
      setTimeout(() => {
        setI((x) => (x + 1) % sets.length)
        setSwap(false)
      }, 400)
    }, 3600)
    return () => clearInterval(t)
  }, [sets.length])
  const s = sets[i]
  if (!s) return null
  return (
    <div className="phone-stage" aria-hidden="true">
      <svg className="rings" viewBox="0 0 460 460">
        <circle cx="230" cy="230" r="110" />
        <circle cx="230" cy="230" r="160" />
        <circle cx="230" cy="230" r="210" />
      </svg>
      <div className="phone">
        <div className={`screen${swap ? ' swap' : ''}`}>
          <div className="notch" />
          <div className="scr-h">
            <span className="fl">{s.flag}</span>
            {s.name}
          </div>
          <div className="scr-sub">10 GB+ · cheapest first</div>
          {s.rows.map((r, k) => (
            <div key={r.provider + k} className={`mini${k === 0 ? ' top1' : ''}`}>
              <span className="mk" style={{ background: r.color }}>{r.provider[0]}</span>
              <span className="tx">
                <b>{r.provider}</b>
                {r.data} · {r.days} days
              </span>
              <span className="pr">
                {r.price}
                {k === 0 && <small>Cheapest</small>}
              </span>
            </div>
          ))}
        </div>
      </div>
      <div className="badge-best">Cheapest on top</div>
    </div>
  )
}
