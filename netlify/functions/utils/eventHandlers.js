import { getDB } from './db.js'

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
    eventId,
    tournamentId,
    date,
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

  const isEdit = eventId != null

  // Get tournament
  const tournament = await tournamentsCollection.findOne({ id: tournamentId })
  if (!tournament) {
    throwError('Tournament not found')
  }

  // Generate default event name
  const eventName = name || `${tournament.name} - ${date}`

  // Validation
  if (!isEdit) {
    const existing = await eventsCollection.findOne({ eventName, date })
    if (existing) {
      throwError('An event with the same name and date already exists')
    }
  } else {
    const existing = await eventsCollection.findOne({ eventId })
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

  // Copy tournament fields to event and add event-specific fields
  const event = {
    ...tournament,
    eventId: isEdit ? eventId : generateId(),
    tournamentId,
    date,
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
    await eventsCollection.updateOne({ eventId }, { $set: event })
  } else {
    event.createdAt = new Date().toISOString()
    await eventsCollection.insertOne(event)
  }

  return event
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
  if (!params.eventId) throwError('Event ID is required')

  const db = getDB()
  const event = await db.collection(EVENTS_COLLECTION).findOne({ eventId: params.eventId })
  if (!event) throwError('Event not found')
  return event
}

/**
 * Add participant to event
 */
export const addParticipant = async (body) => {
  validateAddParticipantInput(body)

  const { eventId, playerIds, teamName } = body

  const db = getDB()
  const collection = db.collection(EVENTS_COLLECTION)
  const playersCollection = db.collection('players')

  // Get event
  const event = await collection.findOne({ eventId })
  if (!event) throwError('Event not found')

  // Get players
  const players = await playersCollection.find({ id: { $in: playerIds } }).toArray()

  if (players.length !== playerIds.length) {
    throwError('One or more players not found')
  }

  // Validate
  const errors = validateAddParticipantRules(event, players)
  throwErrors(errors)

  // Calculate rating
  const rating = calculateParticipantRating(players, event.nop)

  const participant = {
    id: generateId(),
    players,
    teamName,
    rating,
  }

  await collection.updateOne({ eventId }, { $push: { participants: participant } })

  return participant
}

const validateAddParticipantInput = (body) => {
  if (!body) throwError('Request body is required')
  if (!body.eventId) throwError('Event ID is required')
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
    if (playerIds.has(player.id)) {
      errors.push(`Duplicate player: ${player.id}`)
    }
    playerIds.add(player.id)
  }

  // Check max participants
  if (event.maxParticipants > 0 && event.participants.length >= event.maxParticipants) {
    errors.push('Event has reached maximum participants')
  }

  // Check rating requirement
  if (event.restriction === 'Rated' && event.ratingLimit) {
    for (const player of players) {
      if (player.rating > event.ratingLimit) {
        errors.push(
          `Player ${player.firstName} ${player.lastName} rating (${player.rating}) exceeds limit (${event.ratingLimit})`,
        )
      }
    }
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
    const existing = event.participants.find((p) => p.players.some((pl) => pl.id === player.id))
    if (existing) {
      errors.push(`Player ${player.firstName} ${player.lastName} is already in the event`)
    }
  }

  return errors
}

const calculateParticipantRating = (players, nop) => {
  if (players.length === 0) return 0
  if (nop === 1) return players[0]?.rating || 0
  if (nop <= 3) return players.reduce((sum, p) => sum + p.rating, 0)
  const sorted = [...players].sort((a, b) => b.rating - a.rating)
  return sorted.slice(0, 3).reduce((sum, p) => sum + p.rating, 0)
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

  const { eventId, participantId } = body

  const db = getDB()
  const collection = db.collection(EVENTS_COLLECTION)

  const event = await collection.findOne({ eventId })
  if (!event) throwError('Event not found')

  const participant = event.participants.find((p) => p.id === participantId)
  if (!participant) throwError('Participant not found')

  // Check if event has started
  const groupStage = event.eventStages.find((s) => s.type === 'group')
  if (groupStage && groupStage.groups.length > 0) {
    throwError('Cannot delete participant after event has started')
  }

  await collection.updateOne({ eventId }, { $pull: { participants: { id: participantId } } })

  return participant
}

const validateDeleteParticipantInput = (body) => {
  if (!body) throwError('Request body is required')
  if (!body.eventId) throwError('Event ID is required')
  if (!body.participantId) throwError('Participant ID is required')
}

/**
 * Generate groups for an event
 */
export const generateGroups = async (body) => {
  if (!body) throwError('Request body is required')
  if (!body.eventId) throwError('Event ID is required')

  const { eventId } = body

  const db = getDB()
  const collection = db.collection(EVENTS_COLLECTION)

  const event = await collection.findOne({ eventId })
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
      id: generateId(),
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

  await collection.updateOne({ eventId }, { $set: { eventStages: updatedStages } })

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
  if (!body.eventId) throwError('Event ID is required')

  const { eventId } = body

  const db = getDB()
  const collection = db.collection(EVENTS_COLLECTION)

  const event = await collection.findOne({ eventId })
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

  await collection.updateOne({ eventId }, { $set: { eventStages: updatedStages } })

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
        id: generateId(),
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
  const id1 = p1.id || p1.participant?.id
  const id2 = p2.id || p2.participant?.id
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

  const { eventId, matchId, result } = body

  const db = getDB()
  const collection = db.collection(EVENTS_COLLECTION)

  const event = await collection.findOne({ eventId })
  if (!event) throwError('Event not found')

  let matchFound = false
  let updatedStages = [...event.eventStages]

  // Find and update match in group stage
  const groupStageIndex = event.eventStages.findIndex((s) => s.type === 'group')
  if (groupStageIndex !== -1) {
    const groupStage = event.eventStages[groupStageIndex]
    for (let gi = 0; gi < groupStage.groups.length; gi++) {
      const group = groupStage.groups[gi]
      const matchIndex = group.matches.findIndex((m) => m.id === matchId)
      if (matchIndex !== -1) {
        matchFound = true

        const match = group.matches[matchIndex]
        if (match.winningSide != null) {
          throwError('Match is already finished')
        }

        // Update match with result
        const updatedMatch = updateMatchWithResult(match, result)

        // Update group stats
        const updatedGroup = updateGroupAfterMatch(group, updatedMatch, matchIndex)

        // Check if group is complete
        const groupComplete = updatedGroup.matches.every((m) => m.winningSide !== undefined)

        const updatedGroupStage = {
          ...groupStage,
          groups: groupStage.groups.map((g, i) =>
            i === gi ? { ...updatedGroup, isComplete: groupComplete } : g,
          ),
        }

        // If all groups complete, calculate advanced participants
        if (updatedGroupStage.groups.every((g) => g.isComplete)) {
          const advancedParticipants = []
          for (const g of updatedGroupStage.groups) {
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
          updatedGroupStage.advancedParticipants = advancedParticipants
        }

        updatedStages[groupStageIndex] = updatedGroupStage
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
        const matchIndex = round.matches.findIndex((m) => m.match?.id === matchId)
        if (matchIndex !== -1) {
          matchFound = true

          const knockoutMatch = round.matches[matchIndex]
          if (knockoutMatch.winner) {
            throwError('Match is already finished')
          }

          const updatedMatch = updateMatchWithResult(knockoutMatch.match, result)
          const winner =
            updatedMatch.winningSide === 1 ? knockoutMatch.participant1 : knockoutMatch.participant2

          const updatedKnockoutMatch = {
            ...knockoutMatch,
            match: updatedMatch,
            winner,
          }

          const roundComplete = round.matches.every((m, i) =>
            i === matchIndex ? updatedKnockoutMatch.winner : m.winner,
          )

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

  await collection.updateOne({ eventId }, { $set: { eventStages: updatedStages } })

  return { success: true }
}

const validateFinishMatchInput = (body) => {
  if (!body) throwError('Request body is required')
  if (!body.eventId) throwError('Event ID is required')
  if (!body.matchId) throwError('Match ID is required')
  if (!body.result || !Array.isArray(body.result)) throwError('Match result is required')
}

const updateMatchWithResult = (match, result) => {
  const games = result.map((gameResult, index) => ({
    id: `${match.id}-game-${index}`,
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

const getParticipantSideInMatch = (match, participant) => {
  const participantId = participant.id || participant.participant?.id
  if (match.side1.some((p) => p.id === participantId)) return 1
  if (match.side2.some((p) => p.id === participantId)) return 2
  return undefined
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
    const tied = byMatchesWon.get(mw)

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
  const id1 = p1.id || p1.participant?.id
  const id2 = p2.id || p2.participant?.id
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
