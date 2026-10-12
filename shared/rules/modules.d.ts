export type ModuleKey =
  | 'tournament'
  | 'events'
  | 'players'
  | 'gamePlay'
  | 'liveScore'
  | 'schedule'
  | 'booking'
  | 'calendar'
  | 'account'
  | 'profile'
  | 'credit'
  | 'myBooking'
  | 'rating'

export interface ModuleDefinition {
  key: ModuleKey
  label: string
  required?: boolean
  requiredWhen?: ModuleKey
  // In effect only while this module is on (My Booking needs Booking).
  onlyWhen?: ModuleKey
  children?: ModuleDefinition[]
}

export type Modules = Record<ModuleKey, boolean>

export declare const MODULES: ModuleDefinition[]
export declare const moduleKeys: () => ModuleKey[]
export declare const defaultModules: (clubConfig?: { booking?: { enabled?: boolean } } | null) => Modules
export declare const moduleLockReason: (modules: Partial<Modules>, key: ModuleKey) => string | null
export declare const normalizeModules: (
  stored: Partial<Record<string, unknown>> | null | undefined,
  clubConfig?: { booking?: { enabled?: boolean } } | null,
) => Modules
export declare const offAncestor: (modules: Partial<Modules> | null | undefined, key: ModuleKey) => ModuleDefinition | null
export declare const isModuleOn: (modules: Partial<Modules> | null | undefined, key: ModuleKey) => boolean
