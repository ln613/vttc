import { createStore } from 'solid-js/store'
import clubConfig from 'club-config'
import { apiGet, apiPost } from '../utils/api'
import {
  normalizeModules,
  isModuleOn,
  moduleLockReason,
  type ModuleKey,
  type Modules,
} from '../../shared/rules/modules'

// Which parts of the app this club uses — see specs/rules/modules.md. Read
// once when the app starts; a super admin changes them on the Modules page.
//
// The last switches seen are remembered on this device, so the header and
// pages don't show a module for a moment before the server says it is off.

const CACHE_KEY = 'vttc_modules'

const readCache = (): Modules | null => {
  try {
    const raw = localStorage.getItem(CACHE_KEY)
    return raw ? normalizeModules(JSON.parse(raw), clubConfig) : null
  } catch {
    return null
  }
}

const writeCache = (modules: Modules) => {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(modules))
  } catch {
    // Storage unavailable — the next start just waits for the server.
  }
}

interface ModulesState {
  modules: Modules
  // From the server (or this device's last copy of it), not the defaults.
  known: boolean
  // The Modules page.
  draft: Modules
  editing: boolean
  saving: boolean
  error: string | null
}

const getInitialState = (): ModulesState => {
  const cached = readCache()
  const modules = cached ?? normalizeModules(null, clubConfig)
  return {
    modules,
    known: !!cached,
    draft: { ...modules },
    editing: false,
    saving: false,
    error: null,
  }
}

const [modulesState, setModulesState] =
  createStore<ModulesState>(getInitialState())

export { modulesState }

const errorMessage = (err: unknown, fallback: string) =>
  err instanceof Error ? err.message : fallback

const applyModules = (modules: Modules) => {
  writeCache(modules)
  setModulesState({ modules, known: true, draft: { ...modules } })
}

// ==================== reading ====================

let loading: Promise<void> | null = null

const fetchModules = async () => {
  try {
    applyModules(await apiGet<Modules>('modules'))
  } catch (err) {
    // Keep what we have; the page still works on the cached or default set.
    setModulesState({
      error: errorMessage(err, 'Could not load modules'),
      known: true,
    })
  }
}

/** Once per app start; later calls wait on the same request. */
const load = () => (loading ??= fetchModules())

const on = (key: ModuleKey): boolean => isModuleOn(modulesState.modules, key)

// Where "/" goes: the event list, else the booking calendar, else Account.
const homePath = (): string => {
  if (on('events')) return '/events'
  if (on('calendar')) return '/booking'
  return '/account'
}

// ==================== the Modules page ====================

const startEditing = () =>
  setModulesState({
    editing: true,
    draft: { ...modulesState.modules },
    error: null,
  })

const cancelEditing = () =>
  setModulesState({
    editing: false,
    draft: { ...modulesState.modules },
    error: null,
  })

// Locks are applied as the draft changes, so turning Booking on ticks My
// Booking at once rather than on save.
const setDraft = (key: ModuleKey, value: boolean) =>
  setModulesState(
    'draft',
    normalizeModules({ ...modulesState.draft, [key]: value }, clubConfig),
  )

// What the page shows: the draft while editing, the saved switches otherwise.
const shown = (): Modules =>
  modulesState.editing ? modulesState.draft : modulesState.modules

const lockReason = (key: ModuleKey) => moduleLockReason(shown(), key)

const save = async () => {
  setModulesState({ saving: true, error: null })
  try {
    const result = await apiPost<{ modules: Modules }>(
      'saveModules',
      modulesState.draft,
    )
    applyModules(result.modules)
    setModulesState({ saving: false, editing: false })
  } catch (err) {
    setModulesState({
      saving: false,
      error: errorMessage(err, 'Could not save modules'),
    })
  }
}

export const modulesActions = {
  load,
  on,
  homePath,
  startEditing,
  cancelEditing,
  setDraft,
  lockReason,
  shown,
  save,
}
