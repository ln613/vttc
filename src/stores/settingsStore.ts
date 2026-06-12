import { createStore } from 'solid-js/store'
import { apiGet, apiPost } from '../utils/api'

export interface AppSettings {
  ignoreUnpaidInGeneration: boolean
}

const DEFAULT_SETTINGS: AppSettings = {
  ignoreUnpaidInGeneration: true,
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
}

const getInitialState = (): SettingsState => ({
  settings: { ...DEFAULT_SETTINGS },
  draft: { ...DEFAULT_SETTINGS },
  loading: false,
  saving: false,
  editing: false,
  error: null,
  loaded: false,
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
      const merged = { ...DEFAULT_SETTINGS, ...result.settings }
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
}
