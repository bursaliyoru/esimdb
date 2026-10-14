export function Stars({ value }: { value: number }) {
  const r = Math.round(value)
  return (
    <span className="stars" aria-label={`${value} out of 5`}>
      {'★'.repeat(r)}
      <span style={{ opacity: 0.3 }}>{'★'.repeat(5 - r)}</span>
    </span>
  )
}

export function TrustpilotBadge() {
  return (
    <span className="tp">
      <span className="star" aria-hidden="true">★</span>Trustpilot
    </span>
  )
}
