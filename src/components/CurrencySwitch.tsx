'use client'
import { useRouter } from 'next/navigation'

const OPTS = [
  ['USD', '$ USD'],
  ['EUR', '€'],
  ['GBP', '£'],
] as const

export function CurrencySwitch({ current }: { current: string }) {
  const router = useRouter()
  return (
    <div className="cur" role="group" aria-label="Currency">
      {OPTS.map(([v, label]) => (
        <button
          key={v}
          type="button"
          aria-pressed={current === v}
          onClick={() => {
            document.cookie = `cur=${v};path=/;max-age=31536000;samesite=lax`
            router.refresh()
          }}
        >
          {label}
        </button>
      ))}
    </div>
  )
}
