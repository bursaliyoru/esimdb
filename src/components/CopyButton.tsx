'use client'
import { useState } from 'react'

export function CopyButton({ text, className = 'btn', label = 'Copy' }: { text: string; className?: string; label?: string }) {
  const [done, setDone] = useState(false)
  return (
    <button
      type="button"
      className={className}
      style={{ padding: '7px 12px' }}
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text)
          setDone(true)
          setTimeout(() => setDone(false), 1800)
        } catch {
          window.prompt('Copy this code', text)
        }
      }}
    >
      {done ? 'Copied' : label}
    </button>
  )
}
