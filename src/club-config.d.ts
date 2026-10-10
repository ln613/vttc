// The `club-config` specifier is aliased in vite.config.ts to the JSON of
// whichever club this build is for (see clubs/README.md).
declare module 'club-config' {
  export interface ClubTierRule {
    type?: 'Single' | 'Double' | 'Team'
    restriction?: 'Open' | 'Rated' | 'Age'
    ageLimitType?: 'U' | 'O'
    ratingLimitMin?: number
    ratingLimitMax?: number
    ageLimitMin?: number
    ageLimitMax?: number
  }

  export interface ClubConfig {
    slug: string
    name: string
    appName: string
    timezone: string
    /**
     * Default for the club-wide "Enable Tablet Mirror" setting: a table run
     * by two tablets, one facing the umpire and one facing the players.
     * See specs/rules/tablet mirror.md. Absent = off.
     */
    tabletMirrorEnabled?: boolean
    /**
     * Default for "Allow Public Umpire": whether anyone holding the match-day
     * password may score without an account. Absent = allowed, which is how
     * the app behaved before the setting existed.
     */
    allowPublicUmpire?: boolean
    /**
     * Whether this club uses the app's rating system, and so whether the
     * Setting page offers "Update Rating". Absent = hidden: `rating.js`
     * still carries VTTC's tables, so running it for another club would
     * rate their players against rules that are not theirs.
     */
    enableUpdateRating?: boolean
    /**
     * Defaults for the human-umpire feature — see specs/rules/umpires.md.
     * `saveUmpireInfo` absent = off, and with it off none of the rest
     * happens. `maxUmpiresPerTable` absent = 1.
     */
    saveUmpireInfo?: boolean
    maxUmpiresPerTable?: number
    /**
     * Court booking — see specs/rules/booking.md. Absent or not enabled =
     * no Booking page, no credits. Every number is optional and falls
     * back to DEFAULT_BOOKING in shared/rules/booking.js.
     */
    booking?: {
      enabled?: boolean
      /** What one bookable court is called, e.g. "Pickleball Court". */
      courtLabel?: string
      openTime?: string
      closeTime?: string
      slotMinutes?: number
      minMinutes?: number
      creditsPerSlot?: number
      creditsPerDollar?: number
      minTopUpDollars?: number
      guestHoldMinutes?: number
    doorCodeLeadMinutes?: number
    doorCodeTrailMinutes?: number
    }
    /**
     * A public website (Home, Coaches, Pricing, About & Contact) whose
     * content and images live in clubs/<slug>/site. `languages` lists the
     * ones it is written in; with more than one, the top bar offers a
     * language toggle. See specs/pages/Club Site.md.
     */
    site?: {
      enabled?: boolean
      languages?: Array<'en' | 'zh'>
    }
    branding: {
      /** The top bar's colour; VTTC blue without it. */
      topBarColor?: string
      bannerUrl: string
      /** Optional narrow-screen crop; the wide banner is used without it. */
      bannerUrlMobile?: string
      bannerAlt: string
      contactName: string
    }
    tables: {
      all: number[]
      /** Physical layout, top row first. */
      rows: number[][]
      order: number[]
      lowTierOrder: number[]
      highTierOrder: number[]
      knockoutExcluded: number[]
      generalExcluded: number[]
      highTierExcluded: number[]
      highTierSemifinalExcluded: number[]
      highTierFinalOnly: number[]
      lowTierBigMatchPreferred: number[]
    }
    tiers: { low: ClubTierRule[]; high: ClubTierRule[] }
  }

  const config: ClubConfig
  export default config
}
