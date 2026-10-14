import 'server-only'
import { cookies } from 'next/headers'
import type { Currency } from '@/lib/format'

export async function getCurrency(): Promise<Currency> {
  const v = (await cookies()).get('cur')?.value
  return v === 'EUR' || v === 'GBP' ? v : 'USD'
}
