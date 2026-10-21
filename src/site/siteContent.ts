import clubConfig from 'club-config'

// A club's public website — Home, Coaches, Pricing, About & Contact — written
// in clubs/<slug>/site: one JSON file per language, and the images. The
// `club-site` alias (vite.config.ts) points at this build's club only, so
// another club's site is never bundled. See specs/pages/Club Site.md.

export type SiteLanguage = 'en' | 'zh'

export interface SiteFeature {
  icon: string
  title: string
  text: string
}

export interface SiteCoach {
  id: string
  name: string
  photo: string
  rating: string
  headline: string
  credentials: string[]
  achievements: string[]
  teaching: Array<{ title: string; text: string }>
  quote?: string
}

export interface SiteContent {
  brand: {
    name: string
    club: string
    tagline: string
    services: string
    courtLabel?: string
  }
  home: {
    heroTitle: string[]
    bookCourt: string
    seePricing: string
    introKicker: string
    introTitle: string
    intro: string
    features: SiteFeature[]
    slogan: string
    coachKicker: string
    coachTitle: string
    coachText: string
    coachCta: string
    venueKicker: string
    venueTitle: string
  }
  coaches: {
    kicker: string
    title: string
    formats: string[]
    formatsNote: string
    audienceTitle: string
    audience: SiteFeature[]
    credentialsTitle: string
    achievementsTitle: string
    teachingTitle: string
    list: SiteCoach[]
    motto: string
    joinTitle: string
    joinText: string
    joinCta: string
  }
  pricing: {
    kicker: string
    title: string
    headers: { days: string; date: string; time: string; price: string }
    perHour: string
    promotionsTitle: string
    promotionsNote: string
    tagline: string
    bookCta: string
    coachingNote: string
    coachingCta: string
  }
  about: Record<
    | 'kicker'
    | 'title'
    | 'intro'
    | 'contactTitle'
    | 'address'
    | 'email'
    | 'phone'
    | 'instagram'
    | 'map'
    | 'copy'
    | 'copied'
    | 'scanTitle'
    | 'whatsapp'
    | 'whatsappNote'
    | 'wechat'
    | 'wechatNote',
    string
  >
  contact: { address: string; email: string; phone: string; instagram: string }
}

const contentFiles = import.meta.glob<SiteContent>('club-site/*.json', {
  eager: true,
  import: 'default',
})

// The images live on Cloudinary, listed in images.json ("hero-1" → its
// address) by scripts/upload-site-images.mjs. Any still in the images
// folder are bundled as before, and the list wins for a name in both.
const uploadedImages = import.meta.glob<Record<string, string>>(
  'club-site/images.json',
  { eager: true, import: 'default' },
)

const imageFiles = import.meta.glob<string>('club-site/images/*', {
  eager: true,
  query: '?url',
  import: 'default',
})

const fileName = (path: string) => path.slice(path.lastIndexOf('/') + 1)
const baseName = (path: string) => fileName(path).replace(/\.[^.]+$/, '')

const contentByLanguage = Object.fromEntries(
  Object.entries(contentFiles).map(([path, content]) => [
    baseName(path),
    content,
  ]),
) as Partial<Record<SiteLanguage, SiteContent>>

const imagesByName: Record<string, string> = {
  ...Object.fromEntries(
    Object.entries(imageFiles).map(([path, url]) => [baseName(path), url]),
  ),
  ...Object.values(uploadedImages)[0],
}

/** The club has a website, and it is switched on in the club config. */
export const hasSite = (): boolean =>
  !!clubConfig.site?.enabled && !!contentByLanguage.en

// A club can have a look of its own without a website: its colours, fonts
// and button shapes in clubs/<slug>/theme.css (CSS variables under
// .bk-site, which booking.css and the dialogs read). Imported here, so only
// that club's build carries it.
const themeFiles = import.meta.glob('club-dir/theme.css', { eager: true })

/**
 * The club's own look rather than the app's plain one: a website club
 * always (its site's look), or any club with a theme.css. Decides the
 * styling of dialogs, buttons, page headings and the account pages — not
 * which pages exist, which hasSite() decides.
 */
export const hasSiteLook = (): boolean =>
  hasSite() || Object.keys(themeFiles).length > 0

/** The languages this club's site (and top bar) can be shown in. */
export const siteLanguages = (): SiteLanguage[] => {
  const listed = clubConfig.site?.languages ?? ['en']
  return hasSite() ? listed.filter((l) => contentByLanguage[l]) : ['en']
}

export const siteContentFor = (lang: SiteLanguage): SiteContent =>
  (contentByLanguage[lang] ?? contentByLanguage.en) as SiteContent

/** "hero-1" → the image's address. */
export const siteImage = (name: string): string => imagesByName[name] ?? ''

/** The hero background photos, hero-1, hero-2… in order. */
export const heroImages = (): string[] =>
  Object.keys(imagesByName)
    .filter((n) => /^hero-\d+$/.test(n))
    .sort((a, b) => Number(a.slice(5)) - Number(b.slice(5)))
    .map((n) => imagesByName[n])

const FONTS_HREF =
  'https://fonts.googleapis.com/css2?family=Kanit:ital,wght@1,700;1,800;1,900&family=Barlow:wght@400;500;600;700&family=Kaushan+Script&family=Noto+Sans+SC:wght@400;500;700;900&display=swap'

/** The site's typefaces, loaded once, only by a club that has a site. */
export const loadSiteFonts = () => {
  if (!hasSite() || document.getElementById('club-site-fonts')) return
  const link = document.createElement('link')
  link.id = 'club-site-fonts'
  link.rel = 'stylesheet'
  link.href = FONTS_HREF
  document.head.appendChild(link)
}
