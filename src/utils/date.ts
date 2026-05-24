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
