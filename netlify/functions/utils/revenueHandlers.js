import { getDB } from './db.js'
import { getClubDate } from './liveScoreHandlers.js'

const EVENTS_COLLECTION = 'events'
const PLAYERS_COLLECTION = 'players'

const round2 = (n) => Math.round(n * 100) / 100

// Registration fee is per-player; team events split the team fee across the
// roster (mirrors the client getPerPlayerFee).
const getPerPlayerFee = (event) => {
  const fee = event.registrationFee || 0
  if (event.type === 'Team' && event.nop > 1) {
    return round2(fee / event.nop)
  }
  return fee
}

// Every distinct player who was assigned a group or knockout match. Defaulted
// players remain in the group/knockout structures, so they're counted too.
const collectScheduledPlayerIds = (event) => {
  const ids = new Set()
  const addPlayers = (players) => {
    for (const p of players || []) if (p?._id) ids.add(p._id.toString())
  }
  for (const stage of event.eventStages || []) {
    if (stage.type === 'group') {
      for (const group of stage.groups || []) {
        for (const gp of group.participants || []) {
          addPlayers(gp.participant?.players)
        }
      }
    } else if (stage.type === 'knockout') {
      for (const seed of stage.seedingList || []) {
        addPlayers(seed.participant?.participant?.players)
      }
      for (const round of stage.rounds || []) {
        for (const km of round.matches || []) {
          addPlayers(km.participant1?.participant?.players)
          addPlayers(km.participant2?.participant?.players)
        }
      }
    }
  }
  return ids
}

// Player ids of hosts (excluded from collected fees — hosts don't pay).
const getHostPlayerIds = async (db) => {
  const hosts = await db
    .collection(PLAYERS_COLLECTION)
    .find({ host: true }, { projection: { _id: 1 } })
    .toArray()
  return new Set(hosts.map((h) => h._id.toString()))
}

// Total prize payout = sum of the place prizes (1st–4th).
const getTotalPrize = (event) => {
  const p = event.prizes || {}
  return (p.first || 0) + (p.second || 0) + (p.third || 0) + (p.fourth || 0)
}

const computeEventRevenue = (event, hostIds) => {
  const scheduled = collectScheduledPlayerIds(event)
  let payingPlayers = 0
  for (const id of scheduled) if (!hostIds.has(id)) payingPlayers++

  const registrationFee = round2(payingPlayers * getPerPlayerFee(event))
  const prize = getTotalPrize(event)
  return {
    _id: event._id.toString(),
    eventName: event.eventName,
    date: event.date,
    eventSeries: event.eventSeries || null,
    participantCount: (event.participants || []).length,
    registrationFee,
    prize,
    revenue: round2(registrationFee - prize),
  }
}

// Revenue for all PAST events (date before today, club timezone). Fee is
// based on players scheduled into a group/knockout (incl. defaulted),
// excluding hosts, regardless of payment status.
export const getRevenue = async () => {
  const db = getDB()
  const today = getClubDate()
  const events = await db
    .collection(EVENTS_COLLECTION)
    .find({ date: { $exists: true, $lt: today } })
    .toArray()
  const hostIds = await getHostPlayerIds(db)
  return events.map((event) => computeEventRevenue(event, hostIds))
}
