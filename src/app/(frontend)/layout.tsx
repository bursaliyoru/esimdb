import type { Metadata } from 'next'
import type { ReactNode } from 'react'
import './globals.css'
import { site } from '@/lib/site'
import { getCurrency } from '@/components/currency'
import { CurrencySwitch } from '@/components/CurrencySwitch'
import { Bars } from '@/components/Logo'
import { hasSampleData } from '@/lib/data'

export const metadata: Metadata = {
  metadataBase: new URL(site.url),
  title: { default: `${site.name}: compare travel eSIM plans`, template: `%s · ${site.name}` },
  description: 'Compare prices, data and validity of travel eSIM plans from every major provider. Daily price updates, promo codes and verified reviews.',
}

export default async function FrontLayout({ children }: { children: ReactNode }) {
  const cur = await getCurrency()
  const sample = await hasSampleData()
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,500;12..96,700;12..96,800&family=Figtree:wght@400;500;600;700;800&family=JetBrains+Mono:wght@500;700&display=swap"
        />
      </head>
      <body>
        <header className="top">
          <div className="wrap">
            <a className="logo" href="/" aria-label={`${site.name} home`}>
              <Bars />
              {site.name}
            </a>
            <nav className="nav" aria-label="Main">
              <a href="/#destinations">Destinations</a>
              <a href="/best-esim">Best eSIMs</a>
              <a href="/promo-codes">Promo codes</a>
              <a href="/providers">Providers</a>
            </nav>
            <CurrencySwitch current={cur} />
          </div>
        </header>
        {sample && (
          <div className="sample">
            <div className="wrap">
              <b>Sample prices.</b> These plans come from seed data. They are replaced automatically after the first scraper run.
            </div>
          </div>
        )}
        <main>{children}</main>
        <footer>
          <div className="wrap">
            <div>
              <a className="logo" href="/" style={{ display: 'flex', marginBottom: 12 }}>
                <Bars />
                {site.name}
              </a>
              <p style={{ margin: 0, maxWidth: '36ch' }}>Independent travel eSIM comparison. Prices update every 24 hours.</p>
            </div>
            <div>
              <h4>Popular</h4>
              <a href="/esim/united-states">USA eSIM</a>
              <a href="/esim/japan">Japan eSIM</a>
              <a href="/esim/turkey">Turkey eSIM</a>
              <a href="/esim/united-kingdom">UK eSIM</a>
            </div>
            <div>
              <h4>Guides</h4>
              <a href="/best-esim">Best eSIMs</a>
              <a href="/promo-codes">Promo codes</a>
              <a href="/providers">All providers</a>
            </div>
            <div>
              <h4>Company</h4>
              <a href="/how-we-rank">How we rank</a>
              <a href="/admin">Admin</a>
            </div>
            <div className="legal">
              We may earn a commission when you buy through our links. It never changes the price you pay or the order of the automatic rankings. Trustpilot reviews are shown with attribution to Trustpilot.
            </div>
          </div>
        </footer>
      </body>
    </html>
  )
}
