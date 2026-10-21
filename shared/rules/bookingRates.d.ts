import type { WeekDay } from './booking'

export interface WeeklyRate {
  days: WeekDay[]
  from: string
  to: string
  dollarsPerHour: number
}

export interface OneTimeRate {
  date: string
  from: string
  to: string
  dollarsPerHour: number
}

export interface NewRate {
  repeat: 'weekly' | 'once'
  days?: WeekDay[]
  date?: string
  from: string
  to: string
  dollarsPerHour: number
}

export declare const applyWeeklyRate: (weekly: WeeklyRate[], rate: { days: WeekDay[]; from: string; to: string; dollarsPerHour: number }) => WeeklyRate[]
export declare const applyOneTimeRate: (oneTime: OneTimeRate[], rate: OneTimeRate, today?: string) => OneTimeRate[]
export declare const removeOneTimeRate: (oneTime: OneTimeRate[], rate: { date: string; from: string; to: string }) => OneTimeRate[]
export declare const upcomingOneTimeRates: (oneTime: OneTimeRate[], today: string) => OneTimeRate[]
export declare const rateError: (
  rate: Partial<NewRate> | null | undefined,
  context?: { openTime?: string; closeTime?: string; slotMinutes?: number; today?: string },
) => string | null
export declare const normalizeRate: (rate: NewRate) => NewRate
