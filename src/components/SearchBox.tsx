'use client'
import { useRouter } from 'next/navigation'
import { useMemo, useState } from 'react'

type Item = { slug: string; name: string; flag: string; from: string }

const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')

export function SearchBox({ countries }: { countries: Item[] }) {
  const router = useRouter()
  const [q, setQ] = useState('')
  const [idx, setIdx] = useState(0)
  const items = useMemo(() => {
    const v = norm(q.trim())
    return v ? countries.filter((c) => norm(c.name).includes(v)).slice(0, 8) : []
  }, [q, countries])
  const go = (slug?: string) => slug && router.push(`/esim/${slug}`)
  return (
    <div className="search" role="combobox" aria-expanded={items.length > 0} aria-haspopup="listbox">
      <form
        className="box"
        onSubmit={(e) => {
          e.preventDefault()
          go(items[idx]?.slug)
        }}
      >
        <svg viewBox="0 0 24 24" fill="none" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
          <circle cx="11" cy="11" r="7" />
          <path d="m20 20-3.5-3.5" />
        </svg>
        <input
          id="q"
          type="search"
          value={q}
          placeholder="Where are you going? e.g. Japan"
          autoComplete="off"
          aria-label="Search a destination"
          aria-controls="sugg"
          onChange={(e) => {
            setQ(e.target.value)
            setIdx(0)
          }}
          onKeyDown={(e) => {
            if (e.key === 'ArrowDown') { setIdx((i) => Math.min(i + 1, items.length - 1)); e.preventDefault() }
            if (e.key === 'ArrowUp') { setIdx((i) => Math.max(i - 1, 0)); e.preventDefault() }
          }}
        />
        <button className="go" type="submit">Find plans</button>
      </form>
      {items.length > 0 && (
        <ul className="sugg" id="sugg" role="listbox">
          {items.map((c, i) => (
            <li key={c.slug} role="option" aria-selected={i === idx}>
              <button type="button" className={i === idx ? 'on' : ''} onClick={() => go(c.slug)}>
                <span className="flag">{c.flag}</span>
                {c.name}
                <span className="meta">from {c.from}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
