import { clubDateOf, clubMinutesOfDay } from './clubClock'

// Whether an event has begun.
//
// Normally this is purely a clock comparison against the scheduled date and
// time — on the club's clock, as the server judges it, not the viewer's. An explicit "Start Event" records `startedAt`, which wins — so the
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

// An event moved to a later day carries a start stamp from the day it used
// to be on. That stamp says nothing about the new date, so it is ignored —
// mirrors startedOnAnEarlierDate in liveScoreHandlers.
const startedOnAnEarlierDate = (event: EventTiming): boolean => {
  if (!event.startedAt || !event.date) return false
  const startedOn = new Date(event.startedAt)
  if (Number.isNaN(startedOn.getTime())) return false
  return clubDateOf(startedOn) < event.date
}

export const isEventStarted = (event: EventTiming): boolean => {
  if (event.startedAt && !startedOnAnEarlierDate(event)) return true
  if (!event.date) return false

  const today = clubDateOf()
  if (event.date !== today) return event.date < today
  const timeParts = event.time ? parseTime(event.time) : null
  if (!timeParts) return true
  return clubMinutesOfDay() >= timeParts.hours * 60 + timeParts.minutes
}

// An event scheduled for a later day cannot be started early: the live
// queue only ever picks up events dated today (getStartedEvents), so
// startEvent refuses one in the future. Mirrored here so the button is not
// offered when pressing it can only fail.
export const isStartableToday = (event: EventTiming): boolean => {
  if (!event.date) return true
  return event.date <= clubDateOf()
}
