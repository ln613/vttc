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
    branding: {
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
