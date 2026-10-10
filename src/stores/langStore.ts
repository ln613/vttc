import { createStore } from 'solid-js/store'
import en from '../i18n/en.json'
import zh from '../i18n/zh.json'
import clubConfig from 'club-config'
import {
  siteLanguages,
  siteContentFor,
  type SiteContent,
  type SiteLanguage,
} from '../site/siteContent'
import {
  localeFor,
  clockFor,
  shortClockFor,
  lengthFor,
  instantTimeFor,
  instantFor,
} from '../i18n/format'
import { parseLocalDate } from '../utils/date'

// The language the top bar and the club's website are shown in. Only a club
// whose site is written in more than one language offers the toggle; every
// other club stays in English. See specs/pages/Club Site.md.

const STORAGE_KEY = 'vttc_lang'
const STRINGS: Record<SiteLanguage, typeof en> = { en, zh }

const readStored = (): SiteLanguage | null => {
  try {
    const v = localStorage.getItem(STORAGE_KEY)
    return v === 'en' || v === 'zh' ? v : null
  } catch {
    return null
  }
}

const browserLanguage = (): SiteLanguage =>
  typeof navigator !== 'undefined' && /^zh/i.test(navigator.language)
    ? 'zh'
    : 'en'

// A saved choice wins, then the browser's language, then English.
const initialLanguage = (): SiteLanguage => {
  const available = siteLanguages()
  const wanted = readStored() ?? browserLanguage()
  return available.includes(wanted) ? wanted : available[0]
}

const [langState, setLangState] = createStore({ lang: initialLanguage() })

export { langState }

const applyToDocument = (lang: SiteLanguage) => {
  document.documentElement.lang = lang === 'zh' ? 'zh-Hans' : 'en'
}

applyToDocument(langState.lang)

const canToggle = (): boolean => siteLanguages().length > 1

const setLanguage = (lang: SiteLanguage) => {
  setLangState('lang', lang)
  applyToDocument(lang)
  try {
    localStorage.setItem(STORAGE_KEY, lang)
  } catch {
    // Storage unavailable: the choice lasts for this visit only.
  }
}

const toggle = () => {
  const langs = siteLanguages()
  setLanguage(langs[(langs.indexOf(langState.lang) + 1) % langs.length])
}

const lookup = (table: unknown, path: string) =>
  path
    .split('.')
    .reduce<unknown>(
      (node, key) => (node as Record<string, unknown>)?.[key],
      table,
    )

/**
 * A string from the resource files (src/i18n), with {placeholders} filled:
 * t('booking.balance', { credits: '1,000' }). English is the fallback.
 */
const t = (path: string, vars?: Record<string, string | number>): string => {
  const value =
    lookup(STRINGS[langState.lang], path) ?? lookup(STRINGS.en, path)
  if (typeof value !== 'string') return path
  return vars
    ? value.replace(/\{(\w+)\}/g, (_, k) => String(vars[k] ?? `{${k}}`))
    : value
}

/** A list from the resource files, e.g. the date picker's weekdays. */
const list = (path: string): string[] => {
  const value =
    lookup(STRINGS[langState.lang], path) ?? lookup(STRINGS.en, path)
  return Array.isArray(value) ? (value as string[]) : []
}

const locale = () => localeFor(langState.lang)
const clock = (minutes: number) => clockFor(langState.lang, minutes)
const shortClock = (minutes: number) => shortClockFor(langState.lang, minutes)
const length = (minutes: number) => lengthFor(langState.lang, minutes)
const instantTime = (iso: string) => instantTimeFor(langState.lang, iso)
const instant = (iso: string) => instantFor(langState.lang, iso)

/** A club date ("2026-10-12") in the shown language. */
const date = (value: string, options: Intl.DateTimeFormatOptions) =>
  parseLocalDate(value).toLocaleDateString(locale(), options)

/** A door code's window, "5:45 PM – 7:15 PM", on the club's clock. */
const doorWindow = (door: { validFrom: string; validUntil: string }) =>
  `${instantTime(door.validFrom)} – ${instantTime(door.validUntil)}`

/** What a bookable court is called, in the shown language. */
const courtName = (): string =>
  (site() as SiteContent | undefined)?.brand?.courtLabel ||
  clubConfig.booking?.courtLabel ||
  'Court'

/** The club website's text in the current language. */
const site = (): SiteContent => siteContentFor(langState.lang)

export const langActions = {
  canToggle,
  toggle,
  setLanguage,
  t,
  list,
  site,
  locale,
  clock,
  shortClock,
  length,
  instantTime,
  instant,
  date,
  courtName,
  doorWindow,
}
