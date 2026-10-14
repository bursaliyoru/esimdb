import type { Provider } from '@/payload-types'

export function ProviderMark({ provider, size = 42 }: { provider: Pick<Provider, 'name' | 'brandColor' | 'logoUrl' | 'logo'>; size?: number }) {
  const uploaded = typeof provider.logo === 'object' && provider.logo?.url ? provider.logo.url : null
  const src = uploaded || provider.logoUrl
  if (src) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img className="logo-img" src={src} alt="" width={size} height={size} style={{ width: size, height: size, padding: size > 30 ? 5 : 2 }} />
  }
  return (
    <span className="mark" aria-hidden="true" style={{ background: provider.brandColor || '#0B2027', width: size, height: size, fontSize: size * 0.42 }}>
      {provider.name[0]}
    </span>
  )
}
