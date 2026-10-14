import { signalLevel } from '@/lib/format'

export function Signal({ dataMb }: { dataMb: number | null | undefined }) {
  const lv = signalLevel(dataMb)
  return (
    <span className="sig" aria-hidden="true">
      {[5, 8, 11, 14].map((h, i) => (
        <i key={h} className={i < lv ? 'on' : ''} style={{ height: h }} />
      ))}
    </span>
  )
}
