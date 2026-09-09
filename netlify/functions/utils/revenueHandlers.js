import { getDB } from './db.js'

const EVENTS_COLLECTION = 'events'
const PLAYERS_COLLECTION = 'players'
const REVENUE_TEMPLATES_COLLECTION = 'revenueTemplates'

const throwError = (message) => {
  throw new Error(message)
}

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

// Every player on the participant roster, paid or not.
const collectRegisteredPlayerIds = (event) => {
  const ids = new Set()
  for (const participant of event.participants || []) {
    for (const p of participant.players || []) {
      if (p?._id) ids.add(p._id.toString())
    }
  }
  return ids
}

// Who the registration fee is counted for.
//
// Once the draw exists the scheduled roster is authoritative: a player who
// was placed in a group owes the fee whether or not they turn up, which is
// why defaulted players stay counted.
//
// Before the draw there is nothing to read, so fall back to who has paid --
// restricted to players still on the roster, so a withdrawal after payment
// doesn't linger in the total. That figure is marked provisional: entries
// are still arriving and it will be superseded the moment groups generate.
const collectFeePayingPlayerIds = (event) => {
  const scheduled = collectScheduledPlayerIds(event)
  if (scheduled.size > 0) return { ids: scheduled, provisional: false }

  const registered = collectRegisteredPlayerIds(event)
  const paid = new Set(
    (event.paidPlayerIds || [])
      .map((id) => id.toString())
      .filter((id) => registered.has(id)),
  )
  return { ids: paid, provisional: true }
}

// Hosts play for free, so they never contribute a registration fee.
const countPayingPlayers = (ids, hostIds) => {
  let n = 0
  for (const id of ids) if (!hostIds.has(id)) n++
  return n
}

const computeEventRevenue = (event, hostIds) => {
  const { ids, provisional } = collectFeePayingPlayerIds(event)

  // The "include unpaid" view adds everyone on the roster who isn't already
  // counted. Before the draw that is the players who have yet to pay; after
  // it, the registrants who were left out of the draw *because* they hadn't
  // paid (getParticipantDisqualifyReason drops them). Union rather than
  // replace, so a scheduled player who has since left the roster is kept.
  const withUnpaid = new Set([...ids, ...collectRegisteredPlayerIds(event)])

  const perPlayerFee = getPerPlayerFee(event)
  const paying = countPayingPlayers(ids, hostIds)
  const payingWithUnpaid = countPayingPlayers(withUnpaid, hostIds)

  const registrationFee = round2(paying * perPlayerFee)
  const registrationFeeWithUnpaid = round2(payingWithUnpaid * perPlayerFee)
  const prize = getTotalPrize(event)
  return {
    _id: event._id.toString(),
    eventName: event.eventName,
    date: event.date,
    eventSeries: event.eventSeries || null,
    participantCount: (event.participants || []).length,
    registrationFee,
    registrationFeeWithUnpaid,
    prize,
    revenue: round2(registrationFee - prize),
    revenueWithUnpaid: round2(registrationFeeWithUnpaid - prize),
    unpaidCount: payingWithUnpaid - paying,
    provisional,
  }
}

// Revenue for all PAST events (date before today, club timezone). Fee is
// based on players scheduled into a group/knockout (incl. defaulted),
// excluding hosts, regardless of payment status.
export const getRevenue = async () => {
  const db = getDB()
  // Revenue only needs rosters and fees. Fetching whole documents pulled
  // the entire collection (2.1 MB, ~22 s on this cluster) to compute a
  // handful of sums; the projection below brings it to ~100 KB.
  const events = await db
    .collection(EVENTS_COLLECTION)
    .find(
      { date: { $exists: true } },
      {
        // Name every field the sums actually read. collectScheduledPlayerIds
        // wants player ids out of the group/knockout PARTICIPANTS, never the
        // matches — so the match bodies, games and embedded player details
        // never have to cross the wire.
        projection: {
          eventName: 1,
          date: 1,
          eventSeries: 1,
          type: 1,
          nop: 1,
          registrationFee: 1,
          prizes: 1,
          paidPlayerIds: 1,
          'participants.players._id': 1,
          'eventStages.type': 1,
          'eventStages.groups.participants.participant.players._id': 1,
          'eventStages.seedingList.participant.participant.players._id': 1,
          'eventStages.rounds.matches.participant1.participant.players._id': 1,
          'eventStages.rounds.matches.participant2.participant.players._id': 1,
        },
      },
    )
    .toArray()
  const hostIds = await getHostPlayerIds(db)
  return events.map((event) => computeEventRevenue(event, hostIds))
}

// ==================== REVENUE CALCULATOR TEMPLATES ====================

// All saved calculator templates (name + items).
export const getRevenueTemplates = async () => {
  const db = getDB()
  const templates = await db
    .collection(REVENUE_TEMPLATES_COLLECTION)
    .find({})
    .sort({ name: 1 })
    .toArray()
  return templates.map((t) => ({
    _id: t._id.toString(),
    name: t.name,
    items: t.items || [],
  }))
}

// Save (upsert by name) a calculator template. Saving with an existing name
// overrides it — the client confirms the override before calling this.
export const saveRevenueTemplate = async (body) => {
  if (!body) throwError('Request body is required')
  if (!body.name) throwError('Template name is required')
  if (!Array.isArray(body.items)) throwError('items must be an array')

  const db = getDB()
  await db.collection(REVENUE_TEMPLATES_COLLECTION).updateOne(
    { name: body.name },
    {
      $set: {
        name: body.name,
        items: body.items,
        updatedAt: new Date().toISOString(),
      },
    },
    { upsert: true },
  )
  return { success: true }
}
