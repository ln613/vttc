export interface BookingConfig {
  enabled?: boolean
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

export interface BookingRules {
  openMinutes: number
  closeMinutes: number
  slotMinutes: number
  minMinutes: number
  creditsPerSlot: number
  creditsPerDollar: number
  minTopUpDollars: number
  guestHoldMinutes: number
  doorCodeLeadMinutes: number
  doorCodeTrailMinutes: number
}

export declare const DEFAULT_BOOKING: Required<Omit<BookingConfig, 'enabled' | 'courtLabel'>>
export declare const isTimeOfDay: (value: unknown) => boolean
export declare const toMinutes: (hhmm: string) => number
export declare const toTimeOfDay: (minutes: number) => string
export declare const bookingHoursError: (config: BookingConfig | null | undefined, openTime: string, closeTime: string) => string | null
export declare const bookingRules: (config?: BookingConfig | null) => BookingRules
export declare const startTimes: (rules: BookingRules) => number[]
export declare const daySlots: (rules: BookingRules) => number[]
export declare const lengthOptions: (rules: BookingRules, start: number, nextBusyStart?: number) => number[]
export declare const slotsCovered: (rules: BookingRules, start: number, minutes: number) => number[]
export declare const isValidBookingTime: (rules: BookingRules, start: number, minutes: number) => boolean
export declare const bookingCredits: (rules: BookingRules, minutes: number) => number
export declare const bookingPriceCents: (rules: BookingRules, minutes: number) => number
export declare const topUpCredits: (rules: BookingRules, dollars: number) => number
export declare const isValidTopUp: (rules: BookingRules, dollars: number) => boolean
export declare const formatClock: (minutes: number) => string
export declare const formatClockShort: (minutes: number) => string
export declare const formatLength: (minutes: number) => string
export declare const formatDollars: (cents: number) => string
export declare const formatCredits: (credits: number) => string
