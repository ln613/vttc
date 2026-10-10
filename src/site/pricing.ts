import clubConfig from 'club-config'
import { clockFor } from '../i18n/format'
import {
  bookingRules,
  WEEK_DAYS,
  type BookingRate,
  type WeekDay,
} from '../../shared/rules/booking'
import { langActions } from '../stores/langStore'
import type { SiteLanguage } from './siteContent'

// The Pricing page's table, built from the same rates the booking system
// charges (`booking.rates` in the club config), so the two always agree.

export interface PriceRow {
  period: 'day' | 'night'
  time: string
  price: number
}

export interface PriceGroup {
  days: string
  rows: PriceRow[]
}

const EVENING = 18 * 60

const formatTime = (lang: SiteLanguage, minutes: number) =>
  clockFor(lang, minutes)

// ['mon','tue','wed','thu'] → "Mon – Thu"; a broken run lists each day.
const dayRange = (days: WeekDay[]): string => {
  const sorted = WEEK_DAYS.filter((d) => days.includes(d))
  const name = (d: WeekDay) => langActions.t(`days.${d}`)
  const contiguous = sorted.every(
    (d, i) =>
      i === 0 || WEEK_DAYS.indexOf(d) === WEEK_DAYS.indexOf(sorted[i - 1]) + 1,
  )
  if (sorted.length > 2 && contiguous)
    return `${name(sorted[0])} – ${name(sorted[sorted.length - 1])}`
  return sorted.map(name).join(', ')
}

const rowFor = (lang: SiteLanguage, r: BookingRate): PriceRow => ({
  period: r.fromMinutes >= EVENING ? 'night' : 'day',
  time: `${formatTime(lang, r.fromMinutes)} – ${formatTime(lang, r.toMinutes)}`,
  price: r.dollarsPerHour,
})

/** The rates grouped by the days they apply to, in the current language. */
export const priceGroups = (lang: SiteLanguage): PriceGroup[] => {
  const groups: Array<{ key: string; days: WeekDay[]; rates: BookingRate[] }> =
    []
  for (const rate of bookingRules(clubConfig.booking).rates) {
    const key = [...rate.days].sort().join(',')
    const group = groups.find((g) => g.key === key)
    if (group) group.rates.push(rate)
    else groups.push({ key, days: rate.days, rates: [rate] })
  }
  return groups.map((g) => ({
    days: dayRange(g.days),
    rows: [...g.rates]
      .sort((a, b) => a.fromMinutes - b.fromMinutes)
      .map((r) => rowFor(lang, r)),
  }))
}
