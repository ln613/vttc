/**
 * Parse a "YYYY-MM-DD" date string as local time.
 * Using `new Date("2026-05-24")` parses as UTC midnight,
 * which shifts to the previous day in negative-UTC timezones.
 */
export const parseLocalDate = (dateStr: string): Date => {
  const [year, month, day] = dateStr.split('-').map(Number)
  return new Date(year, month - 1, day)
}

/**
 * Format a Date to "YYYY-MM-DD" using local time fields.
 * Avoids `toISOString().split('T')[0]` which uses UTC.
 */
export const formatLocalDate = (date: Date): string => {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

/** Which of a date's three parts a dropdown sets. */
export type DatePart = 'year' | 'month' | 'day'

/**
 * Days in a month (1-12). With no year, February allows the 29th, so a
 * birthday can be picked before the year is.
 */
export const daysInMonth = (month: number, year?: number): number =>
  new Date(year || 2000, month, 0).getDate()

/**
 * "YYYY-MM-DD" from three parts, or '' unless all three make a real date.
 */
export const toIsoDate = (year: string, month: string, day: string): string => {
  const y = Number(year)
  const m = Number(month)
  const d = Number(day)
  if (!y || !m || !d || d > daysInMonth(m, y)) return ''
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`
}
