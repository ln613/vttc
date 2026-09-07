import { parseLocalDate } from './date'

// Whether an event has begun.
//
// Normally this is purely a clock comparison against the scheduled date and
// time. An explicit "Start Event" records `startedAt`, which wins — so the
// desk can start an event ahead of schedule without rewriting the time
// players were told. Mirrors isEventStarted / hasEventStarted on the server.
export interface EventTiming {
  date?: string
  time?: string
  startedAt?: string
}

const parseTime = (
  timeStr: string,
): { hours: number; minutes: number } | null => {
  const match = timeStr.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i)
  if (!match) return null
  let hours = parseInt(match[1], 10)
  const minutes = parseInt(match[2], 10)
  const period = match[3].toUpperCase()
  if (period === 'PM' && hours !== 12) hours += 12
  if (period === 'AM' && hours === 12) hours = 0
  return { hours, minutes }
}

export const isEventStarted = (event: EventTiming): boolean => {
  if (event.startedAt) return true
  if (!event.date) return false

  const eventDate = parseLocalDate(event.date)
  if (event.time) {
    const timeParts = parseTime(event.time)
    if (timeParts) {
      eventDate.setHours(timeParts.hours, timeParts.minutes, 0, 0)
    }
  }
  return new Date() >= eventDate
}
