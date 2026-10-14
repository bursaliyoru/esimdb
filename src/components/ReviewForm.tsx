'use client'
import { useState } from 'react'

export function ReviewForm({ providerSlug, providerName }: { providerSlug: string; providerName: string }) {
  const [rating, setRating] = useState(0)
  const [state, setState] = useState<{ kind: 'idle' | 'sending' | 'ok' | 'err'; msg?: string }>({ kind: 'idle' })

  if (state.kind === 'ok') {
    return <div className="notice ok">Thanks! Your review of {providerName} was received. It will appear here after a quick check by our team.</div>
  }
  return (
    <form
      className="rform"
      onSubmit={async (e) => {
        e.preventDefault()
        if (!rating) return setState({ kind: 'err', msg: 'Pick a star rating from 1 to 5.' })
        const fd = new FormData(e.currentTarget)
        setState({ kind: 'sending' })
        const res = await fetch('/review-submit', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ provider: providerSlug, rating, ...Object.fromEntries(fd.entries()) }),
        }).catch(() => null)
        const data = res ? await res.json().catch(() => ({})) : {}
        if (res?.ok) setState({ kind: 'ok' })
        else setState({ kind: 'err', msg: data.error || 'Could not send your review. Check your connection and try again.' })
      }}
    >
      <div>
        <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 6 }}>Your rating</div>
        <div className="stars-input" role="radiogroup" aria-label="Rating">
          {[1, 2, 3, 4, 5].map((n) => (
            <button key={n} type="button" role="radio" aria-checked={rating === n} aria-label={`${n} star${n > 1 ? 's' : ''}`} className={n <= rating ? 'on' : ''} onClick={() => setRating(n)}>
              ★
            </button>
          ))}
        </div>
      </div>
      <label>
        Title
        <input name="title" id="rv-title" maxLength={120} placeholder="Worked great in Tokyo" />
      </label>
      <label>
        Your review
        <textarea name="body" id="rv-body" required minLength={20} maxLength={3000} placeholder={`How was ${providerName}? Coverage, speed, setup, support…`} />
      </label>
      <div className="two">
        <label>
          Name
          <input name="authorName" id="rv-name" required maxLength={60} />
        </label>
        <label>
          Email (not shown)
          <input name="authorEmail" id="rv-email" type="email" required maxLength={120} />
        </label>
      </div>
      <label>
        Country you used it in (optional)
        <input name="authorCountry" id="rv-country" maxLength={60} />
      </label>
      <div className="hp" aria-hidden="true">
        <label>
          Website
          <input name="website" tabIndex={-1} autoComplete="off" />
        </label>
      </div>
      {state.kind === 'err' && <div className="notice err">{state.msg}</div>}
      <button className="btn acc" type="submit" disabled={state.kind === 'sending'}>
        {state.kind === 'sending' ? 'Sending…' : 'Submit review'}
      </button>
    </form>
  )
}
