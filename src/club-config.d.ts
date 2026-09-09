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
    branding: {
      bannerUrl: string
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
