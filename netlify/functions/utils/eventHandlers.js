import { getDB, toObjectId } from './db.js'

const EVENTS_COLLECTION = 'events'
const TOURNAMENTS_COLLECTION = 'tournaments'

/**
 * Throw error helper
 */
const throwError = (message) => {
  throw new Error(message)
}

/**
 * Throw multiple errors helper
 */
const throwErrors = (errors) => {
  if (errors.length > 0) {
    throwError(errors.join('\n'))
  }
}

/**
 * Generate unique ID
 */
const generateId = () => {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
}

/**
 * Save event (create or update)
 */
export const saveEvent = async (body) => {
  validateSaveEventInput(body)

  const {
    _id,
    tournamentId,
    date,
    time = '',
    maxParticipants = 0,
    name,
    groupGames = 'Best of 3',
    knockoutGames = 'Best of 3 before Semifinal',
    groupMatches = 'Best of 3',
    knockoutMatches = 'Best of 3 before Semifinal',
    qualifiers = 'Top 2',
    handicapEnabled = false,
    handicapDifference = 200,
    handicapMaxPoints = 5,
  } = body

  const db = getDB()
  const eventsCollection = db.collection(EVENTS_COLLECTION)
  const tournamentsCollection = db.collection(TOURNAMENTS_COLLECTION)

  const isEdit = _id != null

  // Get tournament
  const tournament = await tournamentsCollection.findOne({ _id: toObjectId(tournamentId) })
  if (!tournament) {
    throwError('Tournament not found')
  }

  // Generate default event name
  const eventName = name || tournament.name

  // Validation
  if (!isEdit) {
    const existing = await eventsCollection.findOne({ eventName, date })
    if (existing) {
      throwError('An event with the same name and date already exists')
    }
  } else {
    const existing = await eventsCollection.findOne({ _id: toObjectId(_id) })
    if (!existing) {
      throwError('Event not found')
    }
    // Check no schedules have been created
    const hasSchedules = existing.eventStages?.some(
      (s) =>
        (s.type === 'group' && s.groups?.length > 0) ||
        (s.type === 'knockout' && s.rounds?.length > 0),
    )
    if (hasSchedules) {
      throwError('Cannot edit event after schedules have been created')
    }
  }

  // Copy tournament fields (except _id and name) to event and add event-specific fields
  const { _id: _tournamentId, name: _tournamentName, ...tournamentFields } = tournament
  const event = {
    ...tournamentFields,
    ...(isEdit && { _id: toObjectId(_id) }),
    tournamentId,
    date,
    time,
    maxParticipants,
    eventName,
    groupGames,
    knockoutGames,
    groupMatches: tournament.type === 'Team' ? groupMatches : undefined,
    knockoutMatches: tournament.type === 'Team' ? knockoutMatches : undefined,
    qualifiers,
    handicapEnabled,
    handicapDifference,
    handicapMaxPoints,
    participants: isEdit ? undefined : [], // Don't overwrite participants on edit
    eventStages: isEdit
      ? undefined
      : tournament.stages.map((stageType) => {
          if (stageType === 'group') {
            return {
              type: 'group',
              config: { advancingCount: getQualifiersCount(qualifiers) },
              groups: [],
              advancedParticipants: [],
            }
          }
          return {
            type: 'knockout',
            config: { isKnockoutOnly: tournament.stages[0] !== 'group' },
            seedingList: [],
            rounds: [],
            numberOfRounds: 0,
          }
        }),
    updatedAt: new Date().toISOString(),
  }

  // Remove undefined fields
  Object.keys(event).forEach((key) => {
    if (event[key] === undefined) delete event[key]
  })

  if (isEdit) {
    await eventsCollection.updateOne({ _id: toObjectId(_id) }, { $set: event })
    return { ...event, _id }
  } else {
    event.createdAt = new Date().toISOString()
    const result = await eventsCollection.insertOne(event)
    return { ...event, _id: result.insertedId.toString() }
  }
}

const validateSaveEventInput = (body) => {
  if (!body) throwError('Request body is required')
  if (!body.tournamentId) throwError('Tournament ID is required')
  if (!body.date) throwError('Event date is required')
}

const getQualifiersCount = (qualifiers) => {
  switch (qualifiers) {
    case 'Top 1':
      return 1
    case 'Top 2':
      return 2
    case 'Top 3':
      return 3
    case 'All':
      return 999 // Large number to mean all
    default:
      return 2
  }
}

/**
 * Get all events
 */
export const getEvents = async (params = {}) => {
  const db = getDB()
  const query = {}
  if (params.tournamentId) {
    query.tournamentId = params.tournamentId
  }
  const events = await db.collection(EVENTS_COLLECTION).find(query).toArray()
  return events
}

/**
 * Get event by ID
 */
export const getEvent = async (params) => {
  if (!params._id) throwError('Event ID is required')

  const db = getDB()
  const event = await db.collection(EVENTS_COLLECTION).findOne({ _id: toObjectId(params._id) })
  if (!event) throwError('Event not found')

  // Recalculate group stats from match data to ensure ranking table is always accurate
  recalculateGroupStats(event)

  return event
}

const recalculateGroupStats = (event) => {
  if (!event.eventStages) return

  const groupStage = event.eventStages.find((s) => s.type === 'group')
  if (!groupStage || !groupStage.groups) return

  for (const group of groupStage.groups) {
    if (!group.matches || !group.participants) continue

    for (let i = 0; i < group.participants.length; i++) {
      group.participants[i] = {
        ...group.participants[i],
        stats: calculateGroupStats(group.participants[i].participant, group.matches),
      }
    }
  }
}

/**
 * Add participant to event
 */
export const addParticipant = async (body) => {
  validateAddParticipantInput(body)

  const { _id, playerIds, teamName } = body

  const db = getDB()
  const collection = db.collection(EVENTS_COLLECTION)
  const playersCollection = db.collection('players')

  // Get event
  const event = await collection.findOne({ _id: toObjectId(_id) })
  if (!event) throwError('Event not found')

  // Get players
  const players = await playersCollection.find({ _id: { $in: playerIds.map(toObjectId) } }).toArray()

  if (players.length !== playerIds.length) {
    throwError('One or more players not found')
  }

  // Validate
  const errors = validateAddParticipantRules(event, players)
  throwErrors(errors)

  // Calculate rating
  const rating = calculateParticipantRating(players, event.nop)

  const participant = {
    _id: generateId(),
    players,
    teamName,
    rating,
  }

  await collection.updateOne({ _id: toObjectId(_id) }, { $push: { participants: participant } })

  return participant
}

const validateAddParticipantInput = (body) => {
  if (!body) throwError('Request body is required')
  if (!body._id) throwError('Event ID is required')
  if (!body.playerIds || !Array.isArray(body.playerIds) || body.playerIds.length === 0) {
    throwError('Player IDs are required')
  }
}

const validateAddParticipantRules = (event, players) => {
  const errors = []

  // Check number of players matches nop
  if (players.length !== event.nop) {
    errors.push(`Expected ${event.nop} player(s), got ${players.length}`)
  }

  // Check for duplicate players in input
  const playerIds = new Set()
  for (const player of players) {
    const playerId = player._id.toString()
    if (playerIds.has(playerId)) {
      errors.push(`Duplicate player: ${playerId}`)
    }
    playerIds.add(playerId)
  }

  // Check max participants
  if (event.maxParticipants > 0 && event.participants.length >= event.maxParticipants) {
    errors.push('Event has reached maximum participants')
  }

  // Check rating requirement
  if (event.restriction === 'Rated' && event.ratingLimit) {
    const ratingErrors = validateRatingRequirement(event, players)
    errors.push(...ratingErrors)
  }

  // Check age requirement
  if (event.restriction === 'Age' && event.ageLimitType && event.ageLimit) {
    for (const player of players) {
      if (!meetsAgeRequirement(player, event.ageLimitType, event.ageLimit, event.date)) {
        const requirement =
          event.ageLimitType === 'U' ? `under ${event.ageLimit}` : `over ${event.ageLimit}`
        errors.push(
          `Player ${player.firstName} ${player.lastName} does not meet age requirement (${requirement})`,
        )
      }
    }
  }

  // Check if player is already in event
  for (const player of players) {
    const existing = event.participants.find((p) =>
      p.players.some((pl) => pl._id.toString() === player._id.toString()),
    )
    if (existing) {
      errors.push(`Player ${player.firstName} ${player.lastName} is already in the event`)
    }
  }

  return errors
}

/**
 * Validate rating requirement based on event type
 * - Single: player rating must meet the limit
 * - Double: combined rating of the pair must meet the limit
 * - Team: combined rating must meet the limit, plus top N players check if enabled
 */
const validateRatingRequirement = (event, players) => {
  const errors = []
  const { type, ratingLimit, topPlayersRatingEnabled, topPlayersCount, topPlayersRatingLimit } = event

  if (type === 'Single') {
    // Single event: player rating must meet the limit
    const player = players[0]
    if (player.rating > ratingLimit) {
      errors.push(
        `Player ${player.firstName} ${player.lastName} rating (${player.rating}) exceeds limit (${ratingLimit})`,
      )
    }
  } else if (type === 'Double') {
    // Double event: combined rating of the pair must meet the limit
    const combinedRating = players.reduce((sum, p) => sum + (p.rating || 0), 0)
    if (combinedRating > ratingLimit) {
      errors.push(
        `Combined rating (${combinedRating}) exceeds limit (${ratingLimit})`,
      )
    }
  } else if (type === 'Team') {
    // Team event: combined rating must meet the limit
    const combinedRating = players.reduce((sum, p) => sum + (p.rating || 0), 0)
    if (combinedRating > ratingLimit) {
      errors.push(
        `Team combined rating (${combinedRating}) exceeds limit (${ratingLimit})`,
      )
    }

    // Check top N players combined rating if enabled
    if (topPlayersRatingEnabled && topPlayersCount && topPlayersRatingLimit) {
      const sortedPlayers = [...players].sort((a, b) => (b.rating || 0) - (a.rating || 0))
      const topPlayers = sortedPlayers.slice(0, topPlayersCount)
      const topPlayersRating = topPlayers.reduce((sum, p) => sum + (p.rating || 0), 0)
      if (topPlayersRating > topPlayersRatingLimit) {
        errors.push(
          `Top ${topPlayersCount} players combined rating (${topPlayersRating}) exceeds limit (${topPlayersRatingLimit})`,
        )
      }
    }
  }

  return errors
}

const calculateParticipantRating = (players, nop) => {
  if (players.length === 0) return 0
  if (nop === 1) return players[0]?.rating || 0
  if (nop <= 3) return players.reduce((sum, p) => sum + (p.rating || 0), 0)
  const sorted = [...players].sort((a, b) => (b.rating || 0) - (a.rating || 0))
  return sorted.slice(0, 3).reduce((sum, p) => sum + (p.rating || 0), 0)
}

const calculateAge = (dateOfBirth, referenceDate) => {
  const dob = new Date(dateOfBirth)
  const ref = new Date(referenceDate)
  let age = ref.getFullYear() - dob.getFullYear()
  const monthDiff = ref.getMonth() - dob.getMonth()
  if (monthDiff < 0 || (monthDiff === 0 && ref.getDate() < dob.getDate())) {
    age--
  }
  return age
}

const meetsAgeRequirement = (player, ageLimitType, ageLimit, referenceDate) => {
  if (!player.dateOfBirth) return false
  const age = calculateAge(player.dateOfBirth, referenceDate)
  if (ageLimitType === 'U') return age <= ageLimit
  return age >= ageLimit
}

/**
 * Delete participant from event
 */
export const deleteParticipant = async (body) => {
  validateDeleteParticipantInput(body)

  const { _id, participantId } = body

  const db = getDB()
  const collection = db.collection(EVENTS_COLLECTION)

  const event = await collection.findOne({ _id: toObjectId(_id) })
  if (!event) throwError('Event not found')

  const participant = event.participants.find((p) => p._id === participantId)
  if (!participant) throwError('Participant not found')

  // Check if event has started
  const groupStage = event.eventStages.find((s) => s.type === 'group')
  if (groupStage && groupStage.groups.length > 0) {
    throwError('Cannot delete participant after event has started')
  }

  await collection.updateOne({ _id: toObjectId(_id) }, { $pull: { participants: { _id: participantId } } })

  return participant
}

const validateDeleteParticipantInput = (body) => {
  if (!body) throwError('Request body is required')
  if (!body._id) throwError('Event ID is required')
  if (!body.participantId) throwError('Participant ID is required')
}

/**
 * Generate groups for an event
 */
export const generateGroups = async (body) => {
  if (!body) throwError('Request body is required')
  if (!body._id) throwError('Event ID is required')

  const { _id } = body

  const db = getDB()
  const collection = db.collection(EVENTS_COLLECTION)

  const event = await collection.findOne({ _id: toObjectId(_id) })
  if (!event) throwError('Event not found')

  // Validate
  const errors = validateGenerateGroupsRules(event)
  throwErrors(errors)

  // Form groups with snake seeding
  const groupArrays = formGroupsWithSnakeSeeding(event.participants, event.nop)

  // Get number of games for group stage
  const numberOfGames = getBestOfNumber(event.groupGames)

  // Create groups with match schedules
  const groups = groupArrays.map((participants, index) => {
    const matchSchedule = generateGroupMatchSchedule(participants)
    const matches = matchSchedule.map((schedule) => ({
      _id: generateId(),
      config: {
        numberOfGames,
        isSuddenDeath: true,
        gameConfig: { type: 'standard', targetPoints: 11, isGolden: false },
      },
      side1: [schedule.side1.players[0]],
      side2: [schedule.side2.players[0]],
      games: [],
      gamesWon1: 0,
      gamesWon2: 0,
      winningSide: undefined,
    }))

    return {
      index,
      participants: participants.map((p) => ({
        participant: p,
        stats: {
          matchesPlayed: 0,
          matchesWon: 0,
          matchesLost: 0,
          gamesWon: 0,
          gamesLost: 0,
          gameDifference: 0,
          pointsWon: 0,
          pointsLost: 0,
          pointDifference: 0,
        },
      })),
      matches,
      isComplete: false,
    }
  })

  // Update group stage
  const groupStageIndex = event.eventStages.findIndex((s) => s.type === 'group')
  const updatedStages = [...event.eventStages]
  updatedStages[groupStageIndex] = {
    ...updatedStages[groupStageIndex],
    groups,
  }

  await collection.updateOne({ _id: toObjectId(_id) }, { $set: { eventStages: updatedStages } })

  return groups
}

const getBestOfNumber = (bestOfOption) => {
  if (bestOfOption === 'Best of 3') return 3
  if (bestOfOption === 'Best of 5') return 5
  if (bestOfOption.includes('Best of 3')) return 3
  return 3
}

const validateGenerateGroupsRules = (event) => {
  const errors = []

  if (event.stages.length === 0 || event.stages[0] !== 'group') {
    errors.push('Event does not have a group stage as first stage')
  }

  if (event.participants.length < 4) {
    errors.push('Minimum 4 participants required')
  }

  const groupStage = event.eventStages.find((s) => s.type === 'group')
  if (groupStage && groupStage.groups.length > 0) {
    errors.push('Groups have already been generated')
  }

  return errors
}

const calculateNumberOfGroups = (totalParticipants) => {
  if (totalParticipants < 6) return 1
  if (totalParticipants === 16) return 4
  if (totalParticipants === 32) return 8
  return Math.floor(totalParticipants / 3)
}

const formGroupsWithSnakeSeeding = (participants, nop) => {
  const sorted = [...participants].sort((a, b) => b.rating - a.rating)
  const numberOfGroups = calculateNumberOfGroups(sorted.length)

  const groups = Array.from({ length: numberOfGroups }, () => [])

  sorted.forEach((participant, index) => {
    const row = Math.floor(index / numberOfGroups)
    const positionInRow = index % numberOfGroups
    const groupIndex = row % 2 === 0 ? positionInRow : numberOfGroups - 1 - positionInRow
    groups[groupIndex].push(participant)
  })

  return groups
}

const GROUP_OF_3_SCHEDULE = [
  [2, 3],
  [1, 3],
  [1, 2],
]

const GROUP_OF_4_SCHEDULE = [
  [1, 4],
  [2, 3],
  [1, 3],
  [2, 4],
  [3, 4],
  [1, 2],
]

const generateGroupMatchSchedule = (participants) => {
  const size = participants.length

  if (size === 3) {
    return GROUP_OF_3_SCHEDULE.map(([s1, s2]) => ({
      side1: participants[s1 - 1],
      side2: participants[s2 - 1],
    }))
  }

  if (size === 4) {
    return GROUP_OF_4_SCHEDULE.map(([s1, s2]) => ({
      side1: participants[s1 - 1],
      side2: participants[s2 - 1],
    }))
  }

  // For groups larger than 4, generate round robin
  const schedule = []
  for (let i = 0; i < size; i++) {
    for (let j = i + 1; j < size; j++) {
      schedule.push({
        side1: participants[i],
        side2: participants[j],
      })
    }
  }
  return schedule
}

/**
 * Generate knockout round
 */
export const generateKnockout = async (body) => {
  if (!body) throwError('Request body is required')
  if (!body._id) throwError('Event ID is required')

  const { _id } = body

  const db = getDB()
  const collection = db.collection(EVENTS_COLLECTION)

  const event = await collection.findOne({ _id: toObjectId(_id) })
  if (!event) throwError('Event not found')

  // Validate
  const errors = validateGenerateKnockoutRules(event)
  throwErrors(errors)

  const knockoutStageIndex = event.eventStages.findIndex((s) => s.type === 'knockout')
  const knockoutStage = event.eventStages[knockoutStageIndex]
  const groupStage = event.eventStages.find((s) => s.type === 'group')

  let updatedKnockoutStage

  if (knockoutStage.rounds.length === 0) {
    // First round - create initial knockout bracket
    let participants

    if (groupStage) {
      // Get advanced participants from group stage
      participants = groupStage.advancedParticipants.map((ap) => ({
        participant: ap.participant,
        groupIndex: ap.groupIndex,
        ranking: ap.ranking,
      }))
    } else {
      // Knockout-only event - use all participants
      participants = event.participants.map((p, i) => ({
        participant: p,
        groupIndex: 0,
        ranking: i + 1,
      }))
    }

    updatedKnockoutStage = createKnockoutStage(participants, event.nop, knockoutStage.config, event)
  } else {
    // Advance to next round
    updatedKnockoutStage = advanceKnockoutRound(knockoutStage, event)
  }

  const updatedStages = [...event.eventStages]
  updatedStages[knockoutStageIndex] = updatedKnockoutStage

  await collection.updateOne({ _id: toObjectId(_id) }, { $set: { eventStages: updatedStages } })

  return updatedKnockoutStage
}

const validateGenerateKnockoutRules = (event) => {
  const errors = []

  const hasKnockout = event.stages.includes('knockout')
  if (!hasKnockout) {
    errors.push('Event does not have a knockout stage')
    return errors
  }

  const knockoutStage = event.eventStages.find((s) => s.type === 'knockout')
  const groupStage = event.eventStages.find((s) => s.type === 'group')

  if (event.stages[0] === 'knockout') {
    if (event.participants.length < 4) {
      errors.push('Minimum 4 participants required')
    }
  }

  if (groupStage) {
    const allGroupsComplete = groupStage.groups.every((g) => g.isComplete)
    if (!allGroupsComplete && knockoutStage.rounds.length === 0) {
      errors.push('All group stage matches must be completed first')
    }
  }

  if (knockoutStage.rounds.length > 0) {
    const lastRound = knockoutStage.rounds[knockoutStage.rounds.length - 1]
    if (lastRound.isComplete && lastRound.participantCount === 2) {
      errors.push('Event is already complete')
    }

    const currentRound = knockoutStage.rounds.find((r) => !r.isComplete)
    if (currentRound && currentRound.matches.some((m) => !m.winner)) {
      errors.push('Current knockout round must be completed first')
    }
  }

  return errors
}

const isPowerOf2 = (n) => n > 0 && (n & (n - 1)) === 0

const calculateNumberOfRounds = (participantCount) => Math.ceil(Math.log2(participantCount))

const calculateRound2Participants = (n) => {
  if (isPowerOf2(n)) return n / 2
  return Math.pow(2, Math.floor(Math.log2(n)))
}

const calculateByeCount = (participantCount) => {
  if (isPowerOf2(participantCount)) return 0
  const n2 = calculateRound2Participants(participantCount)
  return 2 * n2 - participantCount
}

const getKnockoutRoundName = (participantCount, totalParticipants) => {
  let n
  if (isPowerOf2(participantCount)) {
    n = participantCount
  } else {
    n = Math.pow(2, Math.floor(Math.log2(totalParticipants)) + 1)
  }

  if (n > 8) return { name: `Round of ${n}`, shortName: `R${n}` }
  if (n === 8) return { name: 'Quarterfinal', shortName: 'QF' }
  if (n === 4) return { name: 'Semifinal', shortName: 'SF' }
  return { name: 'Final', shortName: 'F' }
}

const calculateSnakeRankingSeeding = (advancedParticipants) => {
  const byRanking = new Map()
  for (const p of advancedParticipants) {
    if (!byRanking.has(p.ranking)) byRanking.set(p.ranking, [])
    byRanking.get(p.ranking).push(p)
  }

  const rankings = Array.from(byRanking.keys()).sort((a, b) => a - b)
  const seeded = []

  for (const ranking of rankings) {
    const participants = byRanking.get(ranking)
    const sorted = [...participants].sort((a, b) =>
      ranking % 2 === 1 ? a.groupIndex - b.groupIndex : b.groupIndex - a.groupIndex,
    )
    seeded.push(...sorted)
  }

  return seeded
}

const createInitialSeedingList = (participants, isKnockoutOnly, nop) => {
  let seeded

  if (isKnockoutOnly) {
    seeded = [...participants].sort((a, b) => {
      const ratingA = a.participant.rating || 0
      const ratingB = b.participant.rating || 0
      return ratingB - ratingA
    })
  } else {
    seeded = calculateSnakeRankingSeeding(participants)
  }

  const byeCount = calculateByeCount(seeded.length)

  return seeded.map((participant, index) => ({
    seed: index + 1,
    participant,
    hasBye: index < byeCount,
  }))
}

const wereInSameGroup = (p1, p2) => p1.groupIndex === p2.groupIndex

const getKnockoutGamesCount = (event, roundName) => {
  const knockoutGames = event.knockoutGames
  if (knockoutGames === 'Best of 5') return 5
  if (knockoutGames === 'Best of 3') return 3
  if (knockoutGames === 'Best of 3 before Quarterfinal') {
    if (roundName === 'Quarterfinal' || roundName === 'Semifinal' || roundName === 'Final') return 5
    return 3
  }
  if (knockoutGames === 'Best of 3 before Semifinal') {
    if (roundName === 'Semifinal' || roundName === 'Final') return 5
    return 3
  }
  return 3
}

const createKnockoutMatches = (seedingList, event, roundName) => {
  const matches = []
  const numberOfGames = getKnockoutGamesCount(event, roundName)

  const byeEntries = seedingList.filter((e) => e.hasBye)
  for (const entry of byeEntries) {
    matches.push({
      participant1: entry.participant,
      participant2: undefined,
      isBye1: false,
      isBye2: true,
      winner: entry.participant,
    })
  }

  const remaining = seedingList.filter((e) => !e.hasBye).map((e) => e.participant)

  while (remaining.length >= 2) {
    const top = remaining.shift()
    let bottomIndex = remaining.length - 1
    let bottom = remaining[bottomIndex]

    while (bottomIndex > 0 && wereInSameGroup(top, bottom)) {
      bottomIndex--
      bottom = remaining[bottomIndex]
    }

    remaining.splice(bottomIndex, 1)

    matches.push({
      match: {
        _id: generateId(),
        config: {
          numberOfGames,
          isSuddenDeath: true,
          gameConfig: { type: 'standard', targetPoints: 11, isGolden: false },
        },
        side1: top.participant.players || [top.participant],
        side2: bottom.participant.players || [bottom.participant],
        games: [],
        gamesWon1: 0,
        gamesWon2: 0,
        winningSide: undefined,
      },
      participant1: top,
      participant2: bottom,
      isBye1: false,
      isBye2: false,
    })
  }

  return matches
}

const calculateRemainingParticipants = (totalParticipants) => {
  const rounds = calculateNumberOfRounds(totalParticipants)
  const remaining = [totalParticipants]

  if (rounds < 2) return remaining

  const n2 = calculateRound2Participants(totalParticipants)
  remaining.push(n2)

  for (let i = 2; i < rounds; i++) {
    remaining.push(remaining[i - 1] / 2)
  }

  return remaining
}

const createKnockoutStage = (participants, nop, config, event) => {
  const seedingList = createInitialSeedingList(participants, config.isKnockoutOnly, nop)
  const numberOfRounds = calculateNumberOfRounds(participants.length)
  const remainingParticipants = calculateRemainingParticipants(participants.length)

  const rounds = []

  const firstRoundNames = getKnockoutRoundName(remainingParticipants[0], participants.length)
  const firstRoundMatches = createKnockoutMatches(seedingList, event, firstRoundNames.name)

  rounds.push({
    index: 0,
    name: firstRoundNames.name,
    shortName: firstRoundNames.shortName,
    participantCount: remainingParticipants[0],
    matches: firstRoundMatches,
    isComplete: false,
  })

  for (let i = 1; i < numberOfRounds; i++) {
    const roundNames = getKnockoutRoundName(remainingParticipants[i], participants.length)
    rounds.push({
      index: i,
      name: roundNames.name,
      shortName: roundNames.shortName,
      participantCount: remainingParticipants[i],
      matches: [],
      isComplete: false,
    })
  }

  return {
    type: 'knockout',
    config,
    seedingList,
    rounds,
    numberOfRounds,
  }
}

const isSameParticipant = (p1, p2) => {
  const id1 = (p1._id || p1.participant?._id)?.toString()
  const id2 = (p2._id || p2.participant?._id)?.toString()
  return id1 === id2
}

const createSubsequentRoundSeedingList = (previousSeedingList, previousMatches) => {
  const newList = []
  const usedSeeds = new Set()

  for (const match of previousMatches) {
    if (!match.winner) continue

    if (match.isBye2) {
      const entry = previousSeedingList.find(
        (e) => e.participant && isSameParticipant(e.participant, match.winner),
      )
      if (entry && !usedSeeds.has(entry.seed)) {
        newList.push({ seed: entry.seed, participant: match.winner, hasBye: false })
        usedSeeds.add(entry.seed)
      }
    } else {
      const entry1 = previousSeedingList.find(
        (e) =>
          e.participant && match.participant1 && isSameParticipant(e.participant, match.participant1),
      )
      const entry2 = previousSeedingList.find(
        (e) =>
          e.participant && match.participant2 && isSameParticipant(e.participant, match.participant2),
      )

      const higherSeed = Math.min(entry1?.seed || 999, entry2?.seed || 999)
      if (!usedSeeds.has(higherSeed)) {
        newList.push({ seed: higherSeed, participant: match.winner, hasBye: false })
        usedSeeds.add(higherSeed)
      }
    }
  }

  return newList.sort((a, b) => a.seed - b.seed)
}

const advanceKnockoutRound = (stage, event) => {
  const currentRoundIndex = stage.rounds.findIndex((r) => !r.isComplete)
  if (currentRoundIndex === -1 || currentRoundIndex >= stage.rounds.length - 1) {
    return stage
  }

  const currentRound = stage.rounds[currentRoundIndex]
  const allMatchesComplete = currentRound.matches.every((m) => m.winner)
  if (!allMatchesComplete) return stage

  const updatedCurrentRound = { ...currentRound, isComplete: true }

  const nextSeedingList = createSubsequentRoundSeedingList(stage.seedingList, currentRound.matches)
  const nextRoundNames = getKnockoutRoundName(
    stage.rounds[currentRoundIndex + 1].participantCount,
    stage.rounds[0].participantCount,
  )
  const nextRoundMatches = createKnockoutMatches(nextSeedingList, event, nextRoundNames.name)

  const nextRound = {
    ...stage.rounds[currentRoundIndex + 1],
    matches: nextRoundMatches,
  }

  const updatedRounds = [...stage.rounds]
  updatedRounds[currentRoundIndex] = updatedCurrentRound
  updatedRounds[currentRoundIndex + 1] = nextRound

  return {
    ...stage,
    seedingList: nextSeedingList,
    rounds: updatedRounds,
  }
}

/**
 * Finish a match in an event
 */
export const finishMatch = async (body) => {
  validateFinishMatchInput(body)

  const { _id, matchId, result, confirmed } = body

  const db = getDB()
  const collection = db.collection(EVENTS_COLLECTION)

  const event = await collection.findOne({ _id: toObjectId(_id) })
  if (!event) throwError('Event not found')

  let matchFound = false
  let updatedStages = [...event.eventStages]

  // Find and update match in group stage
  const groupStageIndex = event.eventStages.findIndex((s) => s.type === 'group')
  if (groupStageIndex !== -1) {
    const groupStage = event.eventStages[groupStageIndex]
    for (let gi = 0; gi < groupStage.groups.length; gi++) {
      const group = groupStage.groups[gi]
      const matchIndex = group.matches.findIndex((m) => m._id === matchId)
      if (matchIndex !== -1) {
        matchFound = true

        const match = group.matches[matchIndex]
        if (match.confirmed) {
          throwError('Match is already confirmed')
        }

        // Update match with result
        const updatedMatch = updateMatchWithResult(match, result)
        if (confirmed) updatedMatch.confirmed = true

        // Update group stats
        const updatedGroup = updateGroupAfterMatch(group, updatedMatch, matchIndex)

        // Check if group is complete (all matches finished AND confirmed)
        const groupComplete = updatedGroup.matches.every(
          (m) => m.winningSide !== undefined && m.confirmed,
        )

        const updatedGroupStage = {
          ...groupStage,
          groups: groupStage.groups.map((g, i) =>
            i === gi ? { ...updatedGroup, isComplete: groupComplete } : g,
          ),
        }

        // If all groups complete, calculate advanced participants
        if (updatedGroupStage.groups.every((g) => g.isComplete)) {
          const advancedParticipants = calculateAdvancedParticipants(updatedGroupStage)
          updatedGroupStage.advancedParticipants = advancedParticipants
        }

        updatedStages[groupStageIndex] = updatedGroupStage

        // If confirmed and round complete, generate next round schedule
        if (confirmed && updatedGroupStage.groups.every((g) => g.isComplete)) {
          generateNextRoundIfNeeded(updatedStages, event)
        }
        break
      }
    }
  }

  // Find and update match in knockout stage
  if (!matchFound) {
    const knockoutStageIndex = event.eventStages.findIndex((s) => s.type === 'knockout')
    if (knockoutStageIndex !== -1) {
      const knockoutStage = event.eventStages[knockoutStageIndex]
      for (let ri = 0; ri < knockoutStage.rounds.length; ri++) {
        const round = knockoutStage.rounds[ri]
        const matchIndex = round.matches.findIndex((m) => m.match?._id === matchId)
        if (matchIndex !== -1) {
          matchFound = true

          const knockoutMatch = round.matches[matchIndex]
          if (knockoutMatch.match?.confirmed) {
            throwError('Match is already confirmed')
          }

          const updatedMatch = updateMatchWithResult(knockoutMatch.match, result)
          if (confirmed) updatedMatch.confirmed = true
          const winner =
            updatedMatch.winningSide === 1 ? knockoutMatch.participant1 : knockoutMatch.participant2

          const updatedKnockoutMatch = {
            ...knockoutMatch,
            match: updatedMatch,
            winner,
          }

          // Round is complete only if all matches are finished AND confirmed
          const roundComplete = round.matches.every((m, i) => {
            const km = i === matchIndex ? updatedKnockoutMatch : m
            return km.winner && km.match?.confirmed
          })

          const updatedRounds = knockoutStage.rounds.map((r, i) =>
            i === ri
              ? {
                  ...r,
                  matches: r.matches.map((m, mi) => (mi === matchIndex ? updatedKnockoutMatch : m)),
                  isComplete: roundComplete,
                }
              : r,
          )

          updatedStages[knockoutStageIndex] = {
            ...knockoutStage,
            rounds: updatedRounds,
          }

          // If confirmed and round complete, generate next round schedule
          if (confirmed && roundComplete) {
            generateNextRoundIfNeeded(updatedStages, event)
          }
          break
        }
      }
    }
  }

  if (!matchFound) throwError('Match not found')

  await collection.updateOne({ _id: toObjectId(_id) }, { $set: { eventStages: updatedStages } })

  return { success: true }
}

const validateFinishMatchInput = (body) => {
  if (!body) throwError('Request body is required')
  if (!body._id) throwError('Event ID is required')
  if (!body.matchId) throwError('Match ID is required')
  if (!body.result || !Array.isArray(body.result)) throwError('Match result is required')
}

const updateMatchWithResult = (match, result) => {
  const games = result.map((gameResult, index) => ({
    _id: `${match._id}-game-${index}`,
    config: match.config.gameConfig,
    score1: gameResult.score1,
    score2: gameResult.score2,
    winningSide: determineGameWinner(gameResult.score1, gameResult.score2, match.config.gameConfig),
  }))

  const gamesWon1 = games.filter((g) => g.winningSide === 1).length
  const gamesWon2 = games.filter((g) => g.winningSide === 2).length
  const needed = Math.ceil(match.config.numberOfGames / 2)

  return {
    ...match,
    games,
    gamesWon1,
    gamesWon2,
    winningSide: gamesWon1 >= needed ? 1 : gamesWon2 >= needed ? 2 : undefined,
  }
}

const determineGameWinner = (score1, score2, config) => {
  const { targetPoints, isGolden } = config
  const deucePoint = targetPoints - 1

  if (score1 < targetPoints && score2 < targetPoints) return undefined

  if (isGolden) {
    if (score1 >= targetPoints) return 1
    if (score2 >= targetPoints) return 2
    return undefined
  }

  if (score1 >= deucePoint && score2 >= deucePoint) {
    if (score1 - score2 >= 2) return 1
    if (score2 - score1 >= 2) return 2
    return undefined
  }

  if (score1 >= targetPoints) return 1
  if (score2 >= targetPoints) return 2
  return undefined
}

const updateGroupAfterMatch = (group, updatedMatch, matchIndex) => {
  const updatedMatches = group.matches.map((m, i) => (i === matchIndex ? updatedMatch : m))

  const updatedParticipants = group.participants.map((gp) => ({
    ...gp,
    stats: calculateGroupStats(gp.participant, updatedMatches),
  }))

  return {
    ...group,
    matches: updatedMatches,
    participants: updatedParticipants,
  }
}

const calculateGroupStats = (participant, matches) => {
  let matchesPlayed = 0
  let matchesWon = 0
  let matchesLost = 0
  let gamesWon = 0
  let gamesLost = 0
  let pointsWon = 0
  let pointsLost = 0

  for (const match of matches) {
    const side = getParticipantSideInMatch(match, participant)
    if (!side) continue

    matchesPlayed++
    if (match.winningSide === side) matchesWon++
    else if (match.winningSide) matchesLost++

    if (side === 1) {
      gamesWon += match.gamesWon1
      gamesLost += match.gamesWon2
    } else {
      gamesWon += match.gamesWon2
      gamesLost += match.gamesWon1
    }

    for (const game of match.games) {
      if (side === 1) {
        pointsWon += game.score1
        pointsLost += game.score2
      } else {
        pointsWon += game.score2
        pointsLost += game.score1
      }
    }
  }

  return {
    matchesPlayed,
    matchesWon,
    matchesLost,
    gamesWon,
    gamesLost,
    gameDifference: gamesWon - gamesLost,
    pointsWon,
    pointsLost,
    pointDifference: pointsWon - pointsLost,
  }
}

const getParticipantPlayerIds = (participant) => {
  const players = participant.players || []
  return new Set(players.map((p) => p._id?.toString()))
}

const getParticipantSideInMatch = (match, participant) => {
  const playerIds = getParticipantPlayerIds(participant)
  if (match.side1.some((p) => playerIds.has(p._id?.toString()))) return 1
  if (match.side2.some((p) => playerIds.has(p._id?.toString()))) return 2
  return undefined
}

const subGroupByMatchesLost = (participants) => {
  const byML = new Map()
  for (const p of participants) {
    const ml = p.stats.matchesLost
    if (!byML.has(ml)) byML.set(ml, [])
    byML.get(ml).push(p)
  }
  return byML
}

const resolveTiedGroup = (tied, matches, ranked, startRank) => {
  let currentRank = startRank

  if (tied.length === 1) {
    ranked.push({ ...tied[0], ranking: currentRank })
    currentRank++
  } else if (tied.length === 2) {
    const winner = getHeadToHeadWinner(tied[0].participant, tied[1].participant, matches)
    if (winner) {
      const first = isSameParticipantEntity(winner, tied[0].participant) ? tied[0] : tied[1]
      const second = first === tied[0] ? tied[1] : tied[0]
      ranked.push({ ...first, ranking: currentRank })
      ranked.push({ ...second, ranking: currentRank + 1 })
    } else {
      const sortedTie = [...tied].sort(compareByStatsOnly)
      for (let i = 0; i < sortedTie.length; i++) {
        ranked.push({ ...sortedTie[i], ranking: currentRank + i })
      }
    }
    currentRank += 2
  } else {
    const sortedTie = [...tied].sort(compareByStatsOnly)
    for (let i = 0; i < sortedTie.length; i++) {
      ranked.push({ ...sortedTie[i], ranking: currentRank + i })
    }
    currentRank += tied.length
  }

  return currentRank
}

const rankGroupParticipants = (participants, matches) => {
  const sorted = [...participants].sort((a, b) => b.stats.matchesWon - a.stats.matchesWon)

  const byMatchesWon = new Map()
  for (const p of sorted) {
    const mw = p.stats.matchesWon
    if (!byMatchesWon.has(mw)) byMatchesWon.set(mw, [])
    byMatchesWon.get(mw).push(p)
  }

  const ranked = []
  let currentRank = 1
  const matchesWonValues = Array.from(byMatchesWon.keys()).sort((a, b) => b - a)

  for (const mw of matchesWonValues) {
    const mwGroup = byMatchesWon.get(mw)

    if (mwGroup.length === 1) {
      ranked.push({ ...mwGroup[0], ranking: currentRank })
      currentRank++
    } else {
      // Sub-group by ML (lower ML is better)
      const byML = subGroupByMatchesLost(mwGroup)
      const mlValues = Array.from(byML.keys()).sort((a, b) => a - b)

      for (const ml of mlValues) {
        const mlGroup = byML.get(ml)
        currentRank = resolveTiedGroup(mlGroup, matches, ranked, currentRank)
      }
    }
  }

  return ranked
}

const getHeadToHeadWinner = (p1, p2, matches) => {
  const match = matches.find((m) => {
    const side1 = getParticipantSideInMatch(m, p1)
    const side2 = getParticipantSideInMatch(m, p2)
    return side1 && side2 && side1 !== side2
  })
  if (!match) return undefined

  const side1 = getParticipantSideInMatch(match, p1)
  if (!match.winningSide) return undefined
  return match.winningSide === side1 ? p1 : p2
}

const isSameParticipantEntity = (p1, p2) => {
  const id1 = (p1._id || p1.participant?._id)?.toString()
  const id2 = (p2._id || p2.participant?._id)?.toString()
  return id1 === id2
}

const compareByStatsOnly = (p1, p2) => {
  if (p1.stats.gameDifference !== p2.stats.gameDifference) {
    return p2.stats.gameDifference - p1.stats.gameDifference
  }
  if (p1.stats.gamesWon !== p2.stats.gamesWon) {
    return p2.stats.gamesWon - p1.stats.gamesWon
  }
  if (p1.stats.pointDifference !== p2.stats.pointDifference) {
    return p2.stats.pointDifference - p1.stats.pointDifference
  }
  return p2.stats.pointsWon - p1.stats.pointsWon
}

/**
 * Confirm a finished match result
 */
export const confirmMatch = async (body) => {
  validateConfirmMatchInput(body)

  const { _id, matchId } = body

  const db = getDB()
  const collection = db.collection(EVENTS_COLLECTION)

  const event = await collection.findOne({ _id: toObjectId(_id) })
  if (!event) throwError('Event not found')

  // Set confirmed on the match
  const updatedStages = updateMatchInStages(
    event.eventStages,
    matchId,
    (match) => {
      if (match.winningSide == null) {
        throwError('Match is not finished yet')
      }
      if (match.confirmed) {
        throwError('Match is already confirmed')
      }
      return {
        ...match,
        confirmed: true,
      }
    },
  )

  // After confirming, update group/round completion and generate next round if needed
  updateStageCompletionAfterConfirm(updatedStages, event)

  await collection.updateOne(
    { _id: toObjectId(_id) },
    { $set: { eventStages: updatedStages } },
  )

  return { success: true }
}

const validateConfirmMatchInput = (body) => {
  if (!body) throwError('Request body is required')
  if (!body._id) throwError('Event ID is required')
  if (!body.matchId) throwError('Match ID is required')
}

/**
 * Reset a confirmed match in an event
 * - delete all games and info related to the match
 * - reset the complete flag on the group if needed
 * - delete the next round schedule if exists
 * - only allowed if no match in the next round has started/finished
 */
export const resetMatch = async (body) => {
  validateResetMatchInput(body)

  const { _id, matchId } = body

  const db = getDB()
  const collection = db.collection(EVENTS_COLLECTION)

  const event = await collection.findOne({ _id: toObjectId(_id) })
  if (!event) throwError('Event not found')

  const updatedStages = [...event.eventStages]
  let matchFound = false

  // Try group stage
  const groupStageIndex = updatedStages.findIndex((s) => s.type === 'group')
  if (groupStageIndex !== -1) {
    const result = tryResetGroupMatch(updatedStages, groupStageIndex, matchId)
    if (result) matchFound = true
  }

  // Try knockout stage
  if (!matchFound) {
    const knockoutStageIndex = updatedStages.findIndex((s) => s.type === 'knockout')
    if (knockoutStageIndex !== -1) {
      const result = tryResetKnockoutMatch(updatedStages, knockoutStageIndex, matchId)
      if (result) matchFound = true
    }
  }

  if (!matchFound) throwError('Match not found')

  await collection.updateOne(
    { _id: toObjectId(_id) },
    { $set: { eventStages: updatedStages } },
  )

  return { success: true }
}

const validateResetMatchInput = (body) => {
  if (!body) throwError('Request body is required')
  if (!body._id) throwError('Event ID is required')
  if (!body.matchId) throwError('Match ID is required')
}

const tryResetGroupMatch = (updatedStages, groupStageIndex, matchId) => {
  const groupStage = updatedStages[groupStageIndex]

  for (let gi = 0; gi < groupStage.groups.length; gi++) {
    const group = groupStage.groups[gi]
    const matchIndex = group.matches.findIndex((m) => m._id === matchId)
    if (matchIndex === -1) continue

    const match = group.matches[matchIndex]
    validateMatchCanBeReset(match)
    validateNoNextRoundStartedForGroup(updatedStages, groupStage)

    // Reset the match
    const resetMatchObj = createResetMatch(match)

    // Rebuild the group with updated match and recalculated stats
    const updatedGroup = updateGroupAfterMatch(group, resetMatchObj, matchIndex)
    updatedGroup.isComplete = false

    // Update group stage
    const updatedGroups = groupStage.groups.map((g, i) =>
      i === gi ? updatedGroup : g,
    )
    const updatedGroupStage = {
      ...groupStage,
      groups: updatedGroups,
      advancedParticipants: [],
    }
    updatedStages[groupStageIndex] = updatedGroupStage

    // Delete knockout round schedule if exists
    deleteKnockoutScheduleIfExists(updatedStages)

    return true
  }

  return false
}

const tryResetKnockoutMatch = (updatedStages, knockoutStageIndex, matchId) => {
  const knockoutStage = updatedStages[knockoutStageIndex]

  for (let ri = 0; ri < knockoutStage.rounds.length; ri++) {
    const round = knockoutStage.rounds[ri]
    const matchIndex = round.matches.findIndex((m) => m.match?._id === matchId)
    if (matchIndex === -1) continue

    const knockoutMatch = round.matches[matchIndex]
    validateMatchCanBeReset(knockoutMatch.match)
    validateNoNextKnockoutRoundStarted(knockoutStage, ri)

    // Reset the match
    const resetMatchObj = createResetMatch(knockoutMatch.match)
    const updatedKnockoutMatch = {
      ...knockoutMatch,
      match: resetMatchObj,
      winner: undefined,
    }

    // Update round
    const updatedRounds = knockoutStage.rounds.map((r, i) => {
      if (i === ri) {
        return {
          ...r,
          matches: r.matches.map((m, mi) =>
            mi === matchIndex ? updatedKnockoutMatch : m,
          ),
          isComplete: false,
        }
      }
      // Delete next round schedule (clear matches)
      if (i === ri + 1) {
        return { ...r, matches: [], isComplete: false }
      }
      return r
    })

    updatedStages[knockoutStageIndex] = {
      ...knockoutStage,
      rounds: updatedRounds,
    }

    return true
  }

  return false
}

const validateMatchCanBeReset = (match) => {
  if (!match) throwError('Match not found')
  if (match.winningSide == null) throwError('Match is not finished')
  if (!match.confirmed) throwError('Match is not confirmed')
}

const validateNoNextRoundStartedForGroup = (updatedStages, groupStage) => {
  const knockoutStage = updatedStages.find((s) => s.type === 'knockout')
  if (!knockoutStage || !knockoutStage.rounds || knockoutStage.rounds.length === 0) return

  const firstRound = knockoutStage.rounds[0]
  const anyStarted = firstRound.matches.some(
    (m) => m.match && (m.match.games?.length > 0 || m.match.winningSide != null),
  )
  if (anyStarted) {
    throwError('Cannot reset match: next round has already started')
  }
}

const validateNoNextKnockoutRoundStarted = (knockoutStage, currentRoundIndex) => {
  const nextRoundIndex = currentRoundIndex + 1
  if (nextRoundIndex >= knockoutStage.rounds.length) return

  const nextRound = knockoutStage.rounds[nextRoundIndex]
  if (!nextRound.matches || nextRound.matches.length === 0) return

  const anyStarted = nextRound.matches.some(
    (m) => m.match && (m.match.games?.length > 0 || m.match.winningSide != null),
  )
  if (anyStarted) {
    throwError('Cannot reset match: next round has already started')
  }
}

const createResetMatch = (match) => ({
  ...match,
  games: [],
  gamesWon1: 0,
  gamesWon2: 0,
  winningSide: undefined,
  confirmed: undefined,
  initialServingSide: undefined,
  leftSide: undefined,
})

const deleteKnockoutScheduleIfExists = (updatedStages) => {
  const knockoutStageIndex = updatedStages.findIndex((s) => s.type === 'knockout')
  if (knockoutStageIndex === -1) return

  const knockoutStage = updatedStages[knockoutStageIndex]
  if (!knockoutStage.rounds || knockoutStage.rounds.length === 0) return

  // Clear all rounds (reset to empty placeholder rounds)
  const clearedRounds = knockoutStage.rounds.map((r) => ({
    ...r,
    matches: [],
    isComplete: false,
  }))

  updatedStages[knockoutStageIndex] = {
    ...knockoutStage,
    rounds: clearedRounds,
    seedingList: [],
  }
}

/**
 * Save match setup (initial serving side and left side)
 */
export const saveMatchSetup = async (body) => {
  validateSaveMatchSetupInput(body)

  const { _id, matchId, initialServingSide, leftSide } = body

  const db = getDB()
  const collection = db.collection(EVENTS_COLLECTION)

  const event = await collection.findOne({ _id: toObjectId(_id) })
  if (!event) throwError('Event not found')

  const updatedStages = updateMatchInStages(
    event.eventStages,
    matchId,
    (match) => ({
      ...match,
      initialServingSide,
      leftSide,
    }),
  )

  await collection.updateOne(
    { _id: toObjectId(_id) },
    { $set: { eventStages: updatedStages } },
  )

  return { success: true }
}

const validateSaveMatchSetupInput = (body) => {
  if (!body) throwError('Request body is required')
  if (!body._id) throwError('Event ID is required')
  if (!body.matchId) throwError('Match ID is required')
  if (!body.initialServingSide) throwError('Initial serving side is required')
  if (!body.leftSide) throwError('Left side is required')
}

const updateMatchInStages = (eventStages, matchId, updateFn) => {
  const updatedStages = [...eventStages]

  // Try group stage
  const groupStageIndex = updatedStages.findIndex((s) => s.type === 'group')
  if (groupStageIndex !== -1) {
    const groupStage = updatedStages[groupStageIndex]
    for (let gi = 0; gi < groupStage.groups.length; gi++) {
      const group = groupStage.groups[gi]
      const matchIndex = group.matches.findIndex((m) => m._id === matchId)
      if (matchIndex !== -1) {
        const updatedMatch = updateFn(group.matches[matchIndex])
        const updatedGroups = groupStage.groups.map((g, i) =>
          i === gi
            ? {
                ...g,
                matches: g.matches.map((m, mi) =>
                  mi === matchIndex ? updatedMatch : m,
                ),
              }
            : g,
        )
        updatedStages[groupStageIndex] = { ...groupStage, groups: updatedGroups }
        return updatedStages
      }
    }
  }

  // Try knockout stage
  const knockoutStageIndex = updatedStages.findIndex((s) => s.type === 'knockout')
  if (knockoutStageIndex !== -1) {
    const knockoutStage = updatedStages[knockoutStageIndex]
    for (let ri = 0; ri < knockoutStage.rounds.length; ri++) {
      const round = knockoutStage.rounds[ri]
      const matchIndex = round.matches.findIndex((m) => m.match?._id === matchId)
      if (matchIndex !== -1) {
        const knockoutMatch = round.matches[matchIndex]
        const updatedMatch = updateFn(knockoutMatch.match)
        const updatedRounds = knockoutStage.rounds.map((r, i) =>
          i === ri
            ? {
                ...r,
                matches: r.matches.map((m, mi) =>
                  mi === matchIndex ? { ...m, match: updatedMatch } : m,
                ),
              }
            : r,
        )
        updatedStages[knockoutStageIndex] = { ...knockoutStage, rounds: updatedRounds }
        return updatedStages
      }
    }
  }

  throwError('Match not found')
}

/**
 * Update a game in a match
 */
export const updateGame = async (body) => {
  validateUpdateGameInput(body)

  const { _id, matchId, gameNumber, score } = body

  const db = getDB()
  const collection = db.collection(EVENTS_COLLECTION)

  const event = await collection.findOne({ _id: toObjectId(_id) })
  if (!event) throwError('Event not found')

  let matchFound = false
  let updatedStages = [...event.eventStages]
  let match = null
  let numberOfGames = 0

  // Find match in group stage
  const groupStageIndex = event.eventStages.findIndex((s) => s.type === 'group')
  if (groupStageIndex !== -1) {
    const groupStage = event.eventStages[groupStageIndex]
    for (let gi = 0; gi < groupStage.groups.length; gi++) {
      const group = groupStage.groups[gi]
      const matchIndex = group.matches.findIndex((m) => m._id === matchId)
      if (matchIndex !== -1) {
        matchFound = true
        match = group.matches[matchIndex]
        numberOfGames = match.config.numberOfGames

        // Validate game number and score
        const errors = validateUpdateGameRules(match, gameNumber, score)
        throwErrors(errors)

        // Update match with new game score
        const updatedMatch = updateMatchWithGameScore(match, gameNumber, score)

        // Update group stats
        const updatedGroup = updateGroupAfterMatch(group, updatedMatch, matchIndex)

        // Check if group is complete (all matches finished AND confirmed)
        const groupComplete = updatedGroup.matches.every(
          (m) => m.winningSide !== undefined && m.confirmed,
        )

        const updatedGroupStage = {
          ...groupStage,
          groups: groupStage.groups.map((g, i) =>
            i === gi ? { ...updatedGroup, isComplete: groupComplete } : g,
          ),
        }

        // If all groups complete, calculate advanced participants
        if (updatedGroupStage.groups.every((g) => g.isComplete)) {
          updatedGroupStage.advancedParticipants = calculateAdvancedParticipants(updatedGroupStage)
        }

        updatedStages[groupStageIndex] = updatedGroupStage
        break
      }
    }
  }

  // Find match in knockout stage
  if (!matchFound) {
    const knockoutStageIndex = event.eventStages.findIndex((s) => s.type === 'knockout')
    if (knockoutStageIndex !== -1) {
      const knockoutStage = event.eventStages[knockoutStageIndex]
      for (let ri = 0; ri < knockoutStage.rounds.length; ri++) {
        const round = knockoutStage.rounds[ri]
        const matchIndex = round.matches.findIndex((m) => m.match?._id === matchId)
        if (matchIndex !== -1) {
          matchFound = true
          match = round.matches[matchIndex].match
          numberOfGames = match.config.numberOfGames

          // Validate game number and score
          const errors = validateUpdateGameRules(match, gameNumber, score)
          throwErrors(errors)

          // Update match with new game score
          const updatedMatch = updateMatchWithGameScore(match, gameNumber, score)
          const knockoutMatch = round.matches[matchIndex]
          const winner =
            updatedMatch.winningSide === 1
              ? knockoutMatch.participant1
              : updatedMatch.winningSide === 2
                ? knockoutMatch.participant2
                : undefined

          const updatedKnockoutMatch = {
            ...knockoutMatch,
            match: updatedMatch,
            winner,
          }

          // Round is complete only if all matches are finished AND confirmed
          const roundComplete = round.matches.every((m, i) => {
            const km = i === matchIndex ? updatedKnockoutMatch : m
            return km.winner && km.match?.confirmed
          })

          const updatedRounds = knockoutStage.rounds.map((r, i) =>
            i === ri
              ? {
                  ...r,
                  matches: r.matches.map((m, mi) => (mi === matchIndex ? updatedKnockoutMatch : m)),
                  isComplete: roundComplete,
                }
              : r,
          )

          updatedStages[knockoutStageIndex] = {
            ...knockoutStage,
            rounds: updatedRounds,
          }
          break
        }
      }
    }
  }

  if (!matchFound) throwError('Match not found')

  await collection.updateOne({ _id: toObjectId(_id) }, { $set: { eventStages: updatedStages } })

  return { success: true }
}

const validateUpdateGameInput = (body) => {
  if (!body) throwError('Request body is required')
  if (!body._id) throwError('Event ID is required')
  if (!body.matchId) throwError('Match ID is required')
  if (body.gameNumber === undefined || body.gameNumber === null) throwError('Game number is required')
  if (!body.score) throwError('Score is required')
}

const validateUpdateGameRules = (match, gameNumber, score) => {
  const errors = []
  const { numberOfGames, gameConfig } = match.config
  const { targetPoints, isGolden } = gameConfig

  // Validate game number doesn't exceed total games
  if (gameNumber < 1 || gameNumber > numberOfGames) {
    errors.push(`Game number must be between 1 and ${numberOfGames}`)
    return errors
  }

  // Check if one side already won the match (no more games allowed)
  const needed = Math.ceil(numberOfGames / 2)
  const gamesWon1 = match.games.filter((g, i) => i + 1 < gameNumber && g.winningSide === 1).length
  const gamesWon2 = match.games.filter((g, i) => i + 1 < gameNumber && g.winningSide === 2).length

  if (gamesWon1 >= needed || gamesWon2 >= needed) {
    errors.push('Match is already finished, no more games allowed')
    return errors
  }

  // Validate score
  const { score1, score2 } = score

  if (score1 < 0 || score2 < 0) {
    errors.push('Score cannot be negative')
  }

  // Validate score doesn't exceed winning point
  const scoreErrors = validateScoreLimit(score1, score2, targetPoints, isGolden)
  errors.push(...scoreErrors)

  return errors
}

const validateScoreLimit = (score1, score2, targetPoints, isGolden) => {
  const errors = []
  const maxScore = Math.max(score1, score2)
  const minScore = Math.min(score1, score2)
  const deucePoint = targetPoints - 1

  // For golden games, winner is whoever reaches target first
  if (isGolden) {
    if (maxScore > targetPoints) {
      errors.push(`Score cannot exceed ${targetPoints} for golden games`)
    }
    return errors
  }

  // For regular games, check if score exceeds what's possible
  // Before deuce: first to target wins
  // At deuce: must lead by 2

  // If below deuce point, score cannot exceed target
  if (minScore < deucePoint) {
    if (maxScore > targetPoints) {
      errors.push(`Score cannot exceed ${targetPoints} when below deuce point`)
    }
    return errors
  }

  // At deuce (both at deucePoint or higher), check if the difference is valid
  // Score should stop when someone leads by 2
  if (maxScore - minScore > 2) {
    errors.push('At deuce, game ends when one side leads by 2')
  }

  // Check that both scores don't exceed what's reasonable for deuce
  // The winning score should be minScore + 2 at most
  if (maxScore > minScore + 2 && minScore >= deucePoint) {
    errors.push('Invalid score: game should have ended')
  }

  return errors
}

const updateMatchWithGameScore = (match, gameNumber, score) => {
  const gameIndex = gameNumber - 1
  const { score1, score2 } = score

  // Create or update the game
  const newGame = {
    _id: `${match._id}-game-${gameIndex}`,
    config: match.config.gameConfig,
    score1,
    score2,
    winningSide: determineGameWinner(score1, score2, match.config.gameConfig),
  }

  // Update games array
  const games = [...match.games]
  while (games.length < gameNumber) {
    games.push({
      _id: `${match._id}-game-${games.length}`,
      config: match.config.gameConfig,
      score1: 0,
      score2: 0,
      winningSide: undefined,
    })
  }
  games[gameIndex] = newGame

  // Recalculate games won
  const gamesWon1 = games.filter((g) => g.winningSide === 1).length
  const gamesWon2 = games.filter((g) => g.winningSide === 2).length
  const needed = Math.ceil(match.config.numberOfGames / 2)

  return {
    ...match,
    games,
    gamesWon1,
    gamesWon2,
    winningSide: gamesWon1 >= needed ? 1 : gamesWon2 >= needed ? 2 : undefined,
  }
}

/**
 * Calculate advanced participants from completed groups
 */
const calculateAdvancedParticipants = (groupStage) => {
  const advancedParticipants = []
  for (const g of groupStage.groups) {
    const ranked = rankGroupParticipants(g.participants, g.matches)
    const advancing = ranked.slice(0, groupStage.config.advancingCount)
    for (const gp of advancing) {
      advancedParticipants.push({
        participant: gp.participant,
        groupIndex: g.index,
        ranking: gp.ranking,
      })
    }
  }
  return advancedParticipants
}

/**
 * After confirming a match, re-evaluate group/round completion and
 * generate next round schedule if conditions are met
 */
const updateStageCompletionAfterConfirm = (updatedStages, event) => {
  // Check group stage completion
  const groupStageIndex = updatedStages.findIndex((s) => s.type === 'group')
  if (groupStageIndex !== -1) {
    const groupStage = updatedStages[groupStageIndex]
    const updatedGroups = groupStage.groups.map((g) => {
      const groupComplete = g.matches.every(
        (m) => m.winningSide !== undefined && m.confirmed,
      )
      return { ...g, isComplete: groupComplete }
    })
    const updatedGroupStage = { ...groupStage, groups: updatedGroups }

    if (updatedGroups.every((g) => g.isComplete)) {
      updatedGroupStage.advancedParticipants = calculateAdvancedParticipants(updatedGroupStage)
    }
    updatedStages[groupStageIndex] = updatedGroupStage
  }

  // Check knockout stage round completion
  const knockoutStageIndex = updatedStages.findIndex((s) => s.type === 'knockout')
  if (knockoutStageIndex !== -1) {
    const knockoutStage = updatedStages[knockoutStageIndex]
    const updatedRounds = knockoutStage.rounds.map((r) => {
      const roundComplete = r.matches.every(
        (m) => m.winner && m.match?.confirmed,
      )
      return { ...r, isComplete: roundComplete }
    })
    updatedStages[knockoutStageIndex] = { ...knockoutStage, rounds: updatedRounds }
  }

  // Generate next round if current round is complete
  generateNextRoundIfNeeded(updatedStages, event)
}

/**
 * If the current round is complete, auto-generate the match schedule for the next round
 */
const generateNextRoundIfNeeded = (updatedStages, event) => {
  const knockoutStageIndex = updatedStages.findIndex((s) => s.type === 'knockout')
  if (knockoutStageIndex === -1) return

  const knockoutStage = updatedStages[knockoutStageIndex]
  if (!knockoutStage.rounds || knockoutStage.rounds.length === 0) {
    // No knockout rounds yet. Check if group stage is complete and knockout should start
    const groupStage = updatedStages.find((s) => s.type === 'group')
    if (groupStage && groupStage.groups.every((g) => g.isComplete) && groupStage.advancedParticipants?.length > 0) {
      const participants = groupStage.advancedParticipants.map((ap) => ({
        participant: ap.participant,
        groupIndex: ap.groupIndex,
        ranking: ap.ranking,
      }))
      const newKnockoutStage = createKnockoutStage(participants, event.nop, knockoutStage.config, event)
      updatedStages[knockoutStageIndex] = newKnockoutStage
    }
    return
  }

  // Find the current incomplete round
  const currentRoundIndex = knockoutStage.rounds.findIndex((r) => !r.isComplete)
  if (currentRoundIndex === -1) return // All rounds complete
  if (currentRoundIndex >= knockoutStage.rounds.length - 1) return // Last round, nothing to generate

  const currentRound = knockoutStage.rounds[currentRoundIndex]
  const allComplete = currentRound.matches.every(
    (m) => m.winner && m.match?.confirmed,
  )
  if (!allComplete) return

  // Mark current round as complete and generate next round
  const updatedKnockoutStage = advanceKnockoutRound(
    { ...knockoutStage, rounds: knockoutStage.rounds.map((r, i) => i === currentRoundIndex ? { ...r, isComplete: true } : r) },
    event,
  )
  updatedStages[knockoutStageIndex] = updatedKnockoutStage
}
