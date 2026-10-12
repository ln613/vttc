import { langState } from '../stores/langStore'
import type { SiteLanguage, SiteFeature } from './siteContent'

// A club's landing page — a product-style home that shows off the system
// (NovaPing's), written in clubs/<slug>/landing.json: the media addresses
// once, then the words in each language. A club with a full website
// (hasSite) opens on that instead. See specs/pages/Landing.md.

interface LandingLink {
  label: string
  href: string
}

export interface LandingShowcaseItem {
  image: string
  tag: string
  title: string
  text: string
  points: string[]
}

export interface LandingPanel {
  icon: string
  title: string
  text: string
  points: string[]
}

export interface LandingText {
  hero: {
    kicker: string
    title: string[]
    text: string
    primary: LandingLink
    secondary: LandingLink
    videoLabel: string
  }
  steps: {
    kicker: string
    title: string
    items: Array<{ title: string; text: string }>
  }
  showcase: { kicker: string; title: string; items: LandingShowcaseItem[] }
  features: {
    kicker: string
    title: string
    items: SiteFeature[]
    panels: LandingPanel[]
  }
  brand: {
    kicker: string
    title: string
    text: string
    points: string[]
    samples: string[]
  }
  cta: { title: string; text: string; button: string; email: string }
}

type LandingFile = { media: Record<string, string> } & Partial<
  Record<SiteLanguage, LandingText>
>

const landingFiles = import.meta.glob<LandingFile>('club-dir/landing.json', {
  eager: true,
  import: 'default',
})
const landingFile = Object.values(landingFiles)[0]

/** The club has a landing page (clubs/<slug>/landing.json). */
export const hasLanding = (): boolean => !!landingFile?.en

/** The landing page's words in the current language (English when missing). */
export const landingText = (): LandingText =>
  (landingFile?.[langState.lang] ?? landingFile?.en) as LandingText

/** A video, poster or picture by its name in the file's "media". */
export const landingMedia = (name: string): string =>
  landingFile?.media[name] ?? ''
