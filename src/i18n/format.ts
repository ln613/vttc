import clubConfig from 'club-config'
import {
  formatClock,
  formatClockShort,
  formatLength,
} from '../../shared/rules/booking'

// Times, lengths and dates in the shown language. English keeps the app's
// own formats; Chinese follows the club's printed price list (上午 9:00,
// 中午 12:00, 下午 6:00, 晚上 12:00).

export type Language = 'en' | 'zh'

const EVENING = 18 * 60

export const formatClockZh = (minutes: number): string => {
  const h24 = Math.floor(minutes / 60)
  const mm = String(minutes % 60).padStart(2, '0')
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12
  if (h24 < 12) return `上午 ${h12}:${mm}`
  if (h24 === 12) return `中午 ${h12}:${mm}`
  if (minutes <= EVENING) return `下午 ${h12}:${mm}`
  return `晚上 ${h12}:${mm}`
}

export const localeFor = (lang: Language) => (lang === 'zh' ? 'zh-CN' : 'en-US')

export const clockFor = (lang: Language, minutes: number) =>
  lang === 'zh' ? formatClockZh(minutes) : formatClock(minutes)

export const shortClockFor = (lang: Language, minutes: number) =>
  lang === 'zh' ? formatClockZh(minutes) : formatClockShort(minutes)

export const lengthFor = (lang: Language, minutes: number) =>
  lang === 'zh' ? `${minutes / 60} 小时` : formatLength(minutes)

/** A moment on the club's clock: "7:15 PM" / "下午7:15". */
export const instantTimeFor = (lang: Language, iso: string) =>
  new Date(iso).toLocaleTimeString(localeFor(lang), {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
    timeZone: clubConfig.timezone,
  })

/** A moment's date and time on the club's clock. */
export const instantFor = (lang: Language, iso: string) =>
  new Date(iso).toLocaleString(localeFor(lang), {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
    timeZone: clubConfig.timezone,
  })
