import { createStore } from 'solid-js/store'
import { apiGet, apiPost } from '../utils/api'

export interface AppSettings {
  ignoreUnpaidInGeneration: boolean
  // Two tablets on one table — see specs/rules/tablet mirror.md. The real
  // default comes from the club config and arrives with the fetch; this is
  // only what the page shows before it does.
  tabletMirrorEnabled: boolean
  allowPublicUmpire: boolean
  saveUmpireInfo: boolean
  maxUmpiresPerTable: number
  // Not settings but facts about the site, from the server's environment,
  // never saved: whether it can text a verification code, and the Google
  // client id "Sign in with Google" needs (null when not set up).
  smsEnabled: boolean
  googleClientId: string | null
}

const DEFAULT_SETTINGS: AppSettings = {
  ignoreUnpaidInGeneration: true,
  tabletMirrorEnabled: false,
  allowPublicUmpire: true,
  saveUmpireInfo: false,
  maxUmpiresPerTable: 1,
  smsEnabled: false,
  googleClientId: null,
}

interface SettingsState {
  // Persisted, server-side settings.
  settings: AppSettings
  // Local edit buffer — what the user sees / mutates while in edit mode.
  draft: AppSettings
  loading: boolean
  saving: boolean
  editing: boolean
  error: string | null
  loaded: boolean
  updatingRating: boolean
  ratingResult: string | null
}

const getInitialState = (): SettingsState => ({
  settings: { ...DEFAULT_SETTINGS },
  draft: { ...DEFAULT_SETTINGS },
  loading: false,
  saving: false,
  editing: false,
  error: null,
  loaded: false,
  updatingRating: false,
  ratingResult: null,
})

const [settingsState, setSettingsState] =
  createStore<SettingsState>(getInitialState())

export { settingsState }

export const settingsActions = {
  fetchSettings: async () => {
    setSettingsState({ loading: true, error: null })
    try {
      const data = await apiGet<AppSettings>('settings')
      const merged = { ...DEFAULT_SETTINGS, ...data }
      setSettingsState({
        settings: merged,
        draft: { ...merged },
        loading: false,
        loaded: true,
        editing: false,
      })
    } catch (err) {
      setSettingsState({
        loading: false,
        error: err instanceof Error ? err.message : 'Failed to load settings',
      })
    }
  },

  startEditing: () => {
    setSettingsState({
      editing: true,
      draft: { ...settingsState.settings },
    })
  },

  cancelEditing: () => {
    setSettingsState({
      editing: false,
      draft: { ...settingsState.settings },
      error: null,
    })
  },

  setDraft: <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => {
    setSettingsState('draft', key, value)
  },

  save: async () => {
    setSettingsState({ saving: true, error: null })
    try {
      const result = await apiPost<{ settings: AppSettings }>(
        'saveSettings',
        settingsState.draft,
      )
      // The save response carries only what is saved, so the environment
      // facts are carried over from what was fetched, not reset to defaults.
      const merged = {
        ...DEFAULT_SETTINGS,
        ...result.settings,
        smsEnabled: settingsState.settings.smsEnabled,
        googleClientId: settingsState.settings.googleClientId,
      }
      setSettingsState({
        settings: merged,
        draft: { ...merged },
        saving: false,
        editing: false,
      })
    } catch (err) {
      setSettingsState({
        saving: false,
        error: err instanceof Error ? err.message : 'Failed to save settings',
      })
    }
  },

  updateRatings: async () => {
    setSettingsState({ updatingRating: true, ratingResult: null, error: null })
    try {
      const r = await apiPost<{ matchesRated: number; playersUpdated: number }>(
        'updateRatings',
        {},
      )
      setSettingsState({
        updatingRating: false,
        ratingResult: `Rated ${r.matchesRated} new match(es); updated ${r.playersUpdated} player rating(s).`,
      })
    } catch (err) {
      setSettingsState({
        updatingRating: false,
        error: err instanceof Error ? err.message : 'Failed to update ratings',
      })
    }
  },
}
