// Human umpires: a roster the club keeps, and who is standing at which
// table today. See specs/rules/umpires.md.
//
// An assignment is only ever for the current day — a name pinned to table 3
// means nothing tomorrow — so it is stored with the club date it was made
// for and read back only when that date is still today.
import { getDB, toObjectId } from './db.js'
import { clubDate } from './club.js'
import { getSettings } from './settingsHandlers.js'

const COLLECTION = 'umpires'
const TABLE_STATE_COLLECTION = 'tableState'
const TABLE_STATE_DOC_ID = 'current'

/** What `umpiredBy` holds when nobody on the roster ran the match. */
export const UMPIRED_BY_ADMIN = 'Admin'
export const UMPIRED_BY_PUBLIC = 'Public'

const throwError = (message) => {
  throw new Error(message)
}

const throwErrors = (errors) => {
  if (errors.length > 0) throwError(errors.join('\n'))
}

// Names are stored as they should be read, not as they were typed.
const toTitleCase = (value) =>
  (value || '').trim().toLowerCase().replace(/\b[a-z]/g, (c) => c.toUpperCase())

export const umpireName = (umpire) =>
  [umpire?.firstName, umpire?.lastName].filter(Boolean).join(' ')

// An umpire is identified by their club ID when they have one, and by their
// name when they do not. Two people called the same thing need IDs.
//
// Matched on the stored name fields rather than a derived key, so there is
// no second copy of the name to keep in step — both sides of the comparison
// have already been put in title case.
const identityOf = (umpire) =>
  umpire.umpireId
    ? { umpireId: umpire.umpireId }
    : {
        umpireId: null,
        firstName: umpire.firstName,
        lastName: umpire.lastName,
      }

// ==================== roster ====================

export const getUmpires = async () => {
  const db = getDB()
  const umpires = await db.collection(COLLECTION).find({}).toArray()
  const today = clubDate()
  return umpires.map((u) => withTodaysTable(u, today)).sort(byTableThenName)
}

// An assignment made on another day is not shown at all, rather than shown
// and quietly ignored.
const withTodaysTable = (umpire, today) => ({
  ...umpire,
  assignedTable: umpire.assignedDate === today ? umpire.assignedTable : null,
  assignedDate: undefined,
})

// Assigned tables first, in table order; everyone else after, by name.
const byTableThenName = (a, b) => {
  const ta = a.assignedTable ?? Number.MAX_SAFE_INTEGER
  const tb = b.assignedTable ?? Number.MAX_SAFE_INTEGER
  if (ta !== tb) return ta - tb
  return umpireName(a).localeCompare(umpireName(b))
}

export const saveUmpire = async (body) => {
  const umpire = readUmpireInput(body)
  validateUmpireInput(umpire)

  const db = getDB()
  const collection = db.collection(COLLECTION)
  await validateUmpireIsUnique(collection, umpire, body._id)

  if (body._id) {
    await collection.updateOne({ _id: toObjectId(body._id) }, { $set: umpire })
    return { ...umpire, _id: body._id }
  }
  const result = await collection.insertOne(umpire)
  return { ...umpire, _id: result.insertedId.toString() }
}

const readUmpireInput = (body) => {
  if (!body) throwError('Request body is required')
  return {
    firstName: toTitleCase(body.firstName),
    lastName: toTitleCase(body.lastName),
    umpireId: body.umpireId?.trim() || null,
    phone: body.phone?.trim() || null,
    email: body.email?.trim() || null,
  }
}

const validateUmpireInput = (umpire) => {
  const errors = []
  if (!umpire.firstName) errors.push('First name is required')
  if (!umpire.lastName) errors.push('Last name is required')
  throwErrors(errors)
}

const validateUmpireIsUnique = async (collection, umpire, excludeId) => {
  const clash = await collection.findOne({
    ...identityOf(umpire),
    ...(excludeId ? { _id: { $ne: toObjectId(excludeId) } } : {}),
  })
  if (!clash) return
  throwError(
    umpire.umpireId
      ? `An umpire with ID ${umpire.umpireId} already exists`
      : `${umpireName(umpire)} is already on the list — give them an ID to tell them apart`,
  )
}

export const deleteUmpire = async (body) => {
  if (!body?._id) throwError('Umpire ID is required')
  await getDB().collection(COLLECTION).deleteOne({ _id: toObjectId(body._id) })
  return { success: true }
}

// ==================== today's assignments ====================

export const assignUmpireTable = async (body) => {
  if (!body?._id) throwError('Umpire ID is required')
  if (!Number.isInteger(body.tableNumber)) throwError('A table is required')

  const db = getDB()
  const collection = db.collection(COLLECTION)
  const today = clubDate()

  await validateTableHasRoom(db, collection, body.tableNumber, body._id, today)
  await collection.updateOne(
    { _id: toObjectId(body._id) },
    { $set: { assignedTable: body.tableNumber, assignedDate: today } },
  )
  return { success: true }
}

const validateTableHasRoom = async (db, collection, tableNumber, umpireId, today) => {
  const { maxUmpiresPerTable } = await getSettings()
  const taken = await collection.countDocuments({
    assignedTable: tableNumber,
    assignedDate: today,
    _id: { $ne: toObjectId(umpireId) },
  })
  if (taken >= maxUmpiresPerTable) {
    throwError(`Table ${tableNumber} already has ${taken} umpire(s)`)
  }
}

export const unassignUmpire = async (body) => {
  if (!body?._id) throwError('Umpire ID is required')
  await getDB()
    .collection(COLLECTION)
    .updateOne(
      { _id: toObjectId(body._id) },
      { $unset: { assignedTable: '', assignedDate: '' } },
    )
  return { success: true }
}

/** How many umpires each table already has today — for the table dialog. */
export const getUmpireTableCounts = async () => {
  const db = getDB()
  const today = clubDate()
  const assigned = await db
    .collection(COLLECTION)
    .find({ assignedDate: today }, { projection: { assignedTable: 1 } })
    .toArray()

  const counts = {}
  for (const u of assigned) {
    if (u.assignedTable == null) continue
    counts[u.assignedTable] = (counts[u.assignedTable] || 0) + 1
  }
  return { counts, maxUmpiresPerTable: (await getSettings()).maxUmpiresPerTable }
}

// ==================== who is umpiring this match ====================

/**
 * The names a tablet may choose from when a match lands on its table.
 *
 * Asked only when there is a real choice: two umpires on the table, or a
 * group match where a player who is not on court can stand in. One name and
 * no question is not a choice, so it is applied without asking.
 */
export const getMatchUmpireChoices = async (params) => {
  const { saveUmpireInfo } = await getSettings()
  if (!saveUmpireInfo) return { ask: false, choices: [], auto: null }
  if (!params?._id || !params.matchId) throwError('Event and match are required')

  const db = getDB()
  const assigned = await umpiresOnTable(db, params.tableNumber)
  const standIns = await freeGroupPlayers(db, params._id, params.matchId)

  // Each choice says what kind of person it is, so the tablet can show
  // "Umpire: …" and "Player: …" — the two are not the same offer, and a
  // player standing in should be recognisable as one.
  const choices = [
    ...assigned.map((name) => ({ kind: 'umpire', name })),
    ...standIns.map((name) => ({ kind: 'player', name })),
  ]

  return {
    ask: choices.length > 1,
    choices,
    auto: choices.length === 1 ? choices[0].name : null,
  }
}

const umpiresOnTable = async (db, tableNumber) => {
  if (tableNumber == null) return []
  const assigned = await db
    .collection(COLLECTION)
    .find({ assignedDate: clubDate(), assignedTable: Number(tableNumber) })
    .toArray()
  return assigned.map(umpireName).sort((a, b) => a.localeCompare(b))
}

// In a group everyone is sitting at the same table waiting their turn, so
// whoever is not on court can umpire. Anyone already standing at another
// table cannot.
const freeGroupPlayers = async (db, eventId, matchId) => {
  const event = await db.collection('events').findOne({ _id: toObjectId(eventId) })
  const group = findGroupOfMatch(event, matchId)
  if (!group) return []

  const playing = await playersOnTables(db)
  for (const side of sidesOfMatch(group, matchId)) {
    for (const player of side) playing.add(player._id?.toString())
  }

  const names = []
  for (const gp of group.participants || []) {
    for (const player of gp.participant?.players || [gp.participant]) {
      if (!player?._id || playing.has(player._id.toString())) continue
      names.push([player.firstName, player.lastName].filter(Boolean).join(' '))
    }
  }
  return names.sort((a, b) => a.localeCompare(b))
}

const findGroupOfMatch = (event, matchId) => {
  for (const stage of event?.eventStages || []) {
    if (stage.type !== 'group') continue
    for (const group of stage.groups || []) {
      if ((group.matches || []).some((m) => m._id === matchId)) return group
    }
  }
  return undefined
}

const sidesOfMatch = (group, matchId) => {
  const match = (group.matches || []).find((m) => m._id === matchId)
  return match ? [match.side1 || [], match.side2 || []] : []
}

const playersOnTables = async (db) => {
  const state = await db
    .collection(TABLE_STATE_COLLECTION)
    .findOne({ docId: TABLE_STATE_DOC_ID })

  const ids = new Set()
  for (const table of state?.tables || []) {
    const match = table.match?.match
    for (const player of [...(match?.side1 || []), ...(match?.side2 || [])]) {
      if (player?._id) ids.add(player._id.toString())
    }
  }
  return ids
}
