import clubConfig from 'club-config'

// The club's own clock. Event dates and times ("2026-11-13", "4:52 PM") are
// the club's wall clock, and the server judges them by it (club.js:
// clubDate / clubMinutesOfDay). The browser's clock is the viewer's, which
// for a club in another time zone — or a viewer travelling — is not the
// same: anything compared with, or stamped onto, an event goes through here.

const timeZone = () => clubConfig.timezone || 'America/Vancouver'

const partsAt = (date: Date) => {
  if (!(date instanceof Date) || Number.isNaN(date.getTime()))
    throw new Error('A valid date is required')
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: timeZone(),
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date)
  const part = (type: string) => parts.find((p) => p.type === type)?.value ?? ''
  return {
    date: `${part('year')}-${part('month')}-${part('day')}`,
    hours: Number(part('hour')),
    minutes: Number(part('minute')),
  }
}

/** "YYYY-MM-DD" on the club's clock at that moment (default: now). */
export const clubDateOf = (date: Date = new Date()): string =>
  partsAt(date).date

/** Minutes since midnight on the club's clock at that moment (default: now). */
export const clubMinutesOfDay = (date: Date = new Date()): number => {
  const { hours, minutes } = partsAt(date)
  return hours * 60 + minutes
}

/** An event time, "4:52 PM", on the club's clock at that moment. */
export const clubEventTimeOf = (date: Date): string => {
  const { hours, minutes } = partsAt(date)
  const period = hours >= 12 ? 'PM' : 'AM'
  return `${hours % 12 || 12}:${String(minutes).padStart(2, '0')} ${period}`
}

/**
 * The club date and time a minute from now — what a simulated or cloned
 * event is stamped with so it starts straight away. Both come from the same
 * moment, so a minute before midnight rolls the date over with the time.
 */
export const clubDateTimeInAMinute = (): { date: string; time: string } => {
  const soon = new Date(Date.now() + 60_000)
  return { date: clubDateOf(soon), time: clubEventTimeOf(soon) }
}
