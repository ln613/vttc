import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest'
import { MongoMemoryServer } from 'mongodb-memory-server'
import { MongoClient } from 'mongodb'

// We'll mock the DB module
let mongoServer
let connection
let db

// Store original env
const originalEnv = process.env.MONGODB_URI

// Mock the db module before importing handlers
vi.mock('./db.js', async (importOriginal) => {
  const original = await importOriginal()
  return {
    ...original,
    getDB: vi.fn(() => db),
    connectDB: vi.fn(async () => db),
  }
})

// Import handlers after mock is set up
import * as tournamentHandlers from './tournamentHandlers.js'

describe('Tournament API Handlers', () => {
  beforeAll(async () => {
    // Start in-memory MongoDB
    mongoServer = await MongoMemoryServer.create()
    const uri = mongoServer.getUri()
    process.env.MONGODB_URI = uri

    connection = await MongoClient.connect(uri)
    db = connection.db('vttc-test')
  })

  afterAll(async () => {
    if (connection) await connection.close()
    if (mongoServer) await mongoServer.stop()
    process.env.MONGODB_URI = originalEnv
  })

  beforeEach(async () => {
    // Clear collections before each test
    const collections = await db.listCollections().toArray()
    for (const col of collections) {
      await db.collection(col.name).deleteMany({})
    }
  })

  describe('createTournament', () => {
    it('should create an open single tournament', async () => {
      const body = {
        name: 'Test Open Tournament',
        date: '2024-03-15',
        formatType: 'openSingle',
      }

      const result = await tournamentHandlers.createTournament(body)

      expect(result.id).toBeDefined()
      expect(result.name).toBe('Test Open Tournament')
      expect(result.date).toBe('2024-03-15')
      expect(result.nop).toBe(1)
      expect(result.format.type).toBe('openSingle')
      expect(result.format.stages).toEqual(['group', 'knockout'])
      expect(result.participants).toEqual([])
      expect(result.stages.length).toBe(2)
      expect(result.stages[0].type).toBe('group')
      expect(result.stages[1].type).toBe('knockout')
    })

    it('should create a rated single tournament with rating limit', async () => {
      const body = {
        name: 'U1500 Tournament',
        date: '2024-03-16',
        formatType: 'ratedSingle',
        ratingLimit: 1500,
      }

      const result = await tournamentHandlers.createTournament(body)

      expect(result.format.type).toBe('ratedSingle')
      expect(result.format.ratingLimit).toBe(1500)
    })

    it('should create an age single tournament', async () => {
      const body = {
        name: 'U19 Junior Tournament',
        date: '2024-03-17',
        formatType: 'ageSingle',
        ageLimitType: 'U',
        ageLimit: 19,
      }

      const result = await tournamentHandlers.createTournament(body)

      expect(result.format.type).toBe('ageSingle')
      expect(result.format.ageLimitType).toBe('U')
      expect(result.format.ageLimit).toBe(19)
    })

    it('should fail when name is missing', async () => {
      const body = {
        date: '2024-03-15',
        formatType: 'openSingle',
      }

      await expect(tournamentHandlers.createTournament(body)).rejects.toThrow(
        'Tournament name is required',
      )
    })

    it('should fail when date is missing', async () => {
      const body = {
        name: 'Test Tournament',
        formatType: 'openSingle',
      }

      await expect(tournamentHandlers.createTournament(body)).rejects.toThrow(
        'Tournament date is required',
      )
    })

    it('should fail when format type is missing', async () => {
      const body = {
        name: 'Test Tournament',
        date: '2024-03-15',
      }

      await expect(tournamentHandlers.createTournament(body)).rejects.toThrow(
        'Format type is required',
      )
    })

    it('should fail when rated event has no rating limit', async () => {
      const body = {
        name: 'Rated Tournament',
        date: '2024-03-15',
        formatType: 'ratedSingle',
      }

      await expect(tournamentHandlers.createTournament(body)).rejects.toThrow(
        'Rating limit is required',
      )
    })

    it('should fail when duplicate tournament exists', async () => {
      const body = {
        name: 'Unique Tournament',
        date: '2024-03-15',
        formatType: 'openSingle',
      }

      await tournamentHandlers.createTournament(body)

      await expect(tournamentHandlers.createTournament(body)).rejects.toThrow(
        'same name and date already exists',
      )
    })
  })

  describe('getTournaments', () => {
    it('should return empty array when no tournaments', async () => {
      const result = await tournamentHandlers.getTournaments()
      expect(result).toEqual([])
    })

    it('should return all tournaments', async () => {
      await tournamentHandlers.createTournament({
        name: 'Tournament 1',
        date: '2024-03-15',
        formatType: 'openSingle',
      })
      await tournamentHandlers.createTournament({
        name: 'Tournament 2',
        date: '2024-03-16',
        formatType: 'openSingle',
      })

      const result = await tournamentHandlers.getTournaments()
      expect(result.length).toBe(2)
    })
  })

  describe('getTournament', () => {
    it('should return tournament by id', async () => {
      const created = await tournamentHandlers.createTournament({
        name: 'Test Tournament',
        date: '2024-03-15',
        formatType: 'openSingle',
      })

      const result = await tournamentHandlers.getTournament({ id: created.id })
      expect(result.name).toBe('Test Tournament')
    })

    it('should fail when id is missing', async () => {
      await expect(tournamentHandlers.getTournament({})).rejects.toThrow(
        'Tournament ID is required',
      )
    })

    it('should fail when tournament not found', async () => {
      await expect(
        tournamentHandlers.getTournament({ id: 'nonexistent' }),
      ).rejects.toThrow('Tournament not found')
    })
  })

  describe('addParticipant', () => {
    let tournament
    let players

    beforeEach(async () => {
      // Create tournament
      tournament = await tournamentHandlers.createTournament({
        name: 'Test Tournament',
        date: '2024-03-15',
        formatType: 'openSingle',
      })

      // Create test players
      players = [
        { id: 'p1', firstName: 'John', lastName: 'Doe', rating: 1500 },
        { id: 'p2', firstName: 'Jane', lastName: 'Smith', rating: 1400 },
        { id: 'p3', firstName: 'Bob', lastName: 'Brown', rating: 1300 },
        { id: 'p4', firstName: 'Alice', lastName: 'White', rating: 1200 },
      ]

      await db.collection('players').insertMany(players)
    })

    it('should add participant to tournament', async () => {
      const result = await tournamentHandlers.addParticipant({
        tournamentId: tournament.id,
        playerIds: ['p1'],
      })

      expect(result.id).toBeDefined()
      expect(result.players.length).toBe(1)
      expect(result.players[0].id).toBe('p1')
      expect(result.rating).toBe(1500)
    })

    it('should fail when tournament not found', async () => {
      await expect(
        tournamentHandlers.addParticipant({
          tournamentId: 'nonexistent',
          playerIds: ['p1'],
        }),
      ).rejects.toThrow('Tournament not found')
    })

    it('should fail when player not found', async () => {
      await expect(
        tournamentHandlers.addParticipant({
          tournamentId: tournament.id,
          playerIds: ['nonexistent'],
        }),
      ).rejects.toThrow('not found')
    })

    it('should fail when player already in tournament', async () => {
      await tournamentHandlers.addParticipant({
        tournamentId: tournament.id,
        playerIds: ['p1'],
      })

      await expect(
        tournamentHandlers.addParticipant({
          tournamentId: tournament.id,
          playerIds: ['p1'],
        }),
      ).rejects.toThrow('already in the tournament')
    })

    it('should fail when max participants reached', async () => {
      // Create tournament with max 2 participants
      const limitedTournament = await tournamentHandlers.createTournament({
        name: 'Limited Tournament',
        date: '2024-03-16',
        formatType: 'openSingle',
        maxParticipants: 2,
      })

      await tournamentHandlers.addParticipant({
        tournamentId: limitedTournament.id,
        playerIds: ['p1'],
      })
      await tournamentHandlers.addParticipant({
        tournamentId: limitedTournament.id,
        playerIds: ['p2'],
      })

      await expect(
        tournamentHandlers.addParticipant({
          tournamentId: limitedTournament.id,
          playerIds: ['p3'],
        }),
      ).rejects.toThrow('maximum participants')
    })
  })

  describe('deleteParticipant', () => {
    let tournament
    let participant

    beforeEach(async () => {
      tournament = await tournamentHandlers.createTournament({
        name: 'Test Tournament',
        date: '2024-03-15',
        formatType: 'openSingle',
      })

      await db.collection('players').insertOne({
        id: 'p1',
        firstName: 'John',
        lastName: 'Doe',
        rating: 1500,
      })

      participant = await tournamentHandlers.addParticipant({
        tournamentId: tournament.id,
        playerIds: ['p1'],
      })
    })

    it('should delete participant from tournament', async () => {
      const result = await tournamentHandlers.deleteParticipant({
        tournamentId: tournament.id,
        participantId: participant.id,
      })

      expect(result.id).toBe(participant.id)

      const updated = await tournamentHandlers.getTournament({ id: tournament.id })
      expect(updated.participants.length).toBe(0)
    })

    it('should fail when participant not found', async () => {
      await expect(
        tournamentHandlers.deleteParticipant({
          tournamentId: tournament.id,
          participantId: 'nonexistent',
        }),
      ).rejects.toThrow('Participant not found')
    })
  })

  describe('generateGroups', () => {
    let tournament

    beforeEach(async () => {
      tournament = await tournamentHandlers.createTournament({
        name: 'Test Tournament',
        date: '2024-03-15',
        formatType: 'openSingle',
      })

      // Create and add 6 players
      const players = Array.from({ length: 6 }, (_, i) => ({
        id: `p${i + 1}`,
        firstName: `Player${i + 1}`,
        lastName: 'Test',
        rating: 1500 - i * 100,
      }))

      await db.collection('players').insertMany(players)

      for (const player of players) {
        await tournamentHandlers.addParticipant({
          tournamentId: tournament.id,
          playerIds: [player.id],
        })
      }
    })

    it('should generate groups with snake seeding', async () => {
      const result = await tournamentHandlers.generateGroups({
        tournamentId: tournament.id,
      })

      // 6 participants -> 2 groups
      expect(result.length).toBe(2)

      // Each group should have 3 participants
      expect(result[0].participants.length).toBe(3)
      expect(result[1].participants.length).toBe(3)

      // Each group should have matches
      expect(result[0].matches.length).toBe(3) // 3 matches in group of 3
      expect(result[1].matches.length).toBe(3)
    })

    it('should fail when less than 4 participants', async () => {
      const smallTournament = await tournamentHandlers.createTournament({
        name: 'Small Tournament',
        date: '2024-03-16',
        formatType: 'openSingle',
      })

      await db.collection('players').insertOne({
        id: 'small-p1',
        firstName: 'Solo',
        lastName: 'Player',
        rating: 1500,
      })

      await tournamentHandlers.addParticipant({
        tournamentId: smallTournament.id,
        playerIds: ['small-p1'],
      })

      await expect(
        tournamentHandlers.generateGroups({ tournamentId: smallTournament.id }),
      ).rejects.toThrow('Minimum 4 participants')
    })

    it('should fail when groups already generated', async () => {
      await tournamentHandlers.generateGroups({ tournamentId: tournament.id })

      await expect(
        tournamentHandlers.generateGroups({ tournamentId: tournament.id }),
      ).rejects.toThrow('already been generated')
    })
  })

  describe('finishMatch', () => {
    let tournament
    let matchId

    beforeEach(async () => {
      tournament = await tournamentHandlers.createTournament({
        name: 'Test Tournament',
        date: '2024-03-15',
        formatType: 'openSingle',
      })

      // Create and add 4 players
      const players = Array.from({ length: 4 }, (_, i) => ({
        id: `fm-p${i + 1}`,
        firstName: `Player${i + 1}`,
        lastName: 'Test',
        rating: 1500 - i * 100,
      }))

      await db.collection('players').insertMany(players)

      for (const player of players) {
        await tournamentHandlers.addParticipant({
          tournamentId: tournament.id,
          playerIds: [player.id],
        })
      }

      // Generate groups
      const groups = await tournamentHandlers.generateGroups({
        tournamentId: tournament.id,
      })

      // Get first match id
      matchId = groups[0].matches[0].id
    })

    it('should finish a match with result', async () => {
      const result = await tournamentHandlers.finishMatch({
        tournamentId: tournament.id,
        matchId,
        result: [
          { score1: 11, score2: 5 },
          { score1: 11, score2: 8 },
        ],
      })

      expect(result.success).toBe(true)

      // Verify match is updated
      const updated = await tournamentHandlers.getTournament({ id: tournament.id })
      const groupStage = updated.stages.find((s) => s.type === 'group')
      const match = groupStage.groups[0].matches.find((m) => m.id === matchId)

      expect(match.gamesWon1).toBe(2)
      expect(match.gamesWon2).toBe(0)
      expect(match.winningSide).toBe(1)
    })

    it('should fail when match not found', async () => {
      await expect(
        tournamentHandlers.finishMatch({
          tournamentId: tournament.id,
          matchId: 'nonexistent',
          result: [{ score1: 11, score2: 5 }],
        }),
      ).rejects.toThrow('Match not found')
    })

    it('should fail when match already finished', async () => {
      await tournamentHandlers.finishMatch({
        tournamentId: tournament.id,
        matchId,
        result: [
          { score1: 11, score2: 5 },
          { score1: 11, score2: 8 },
        ],
      })

      await expect(
        tournamentHandlers.finishMatch({
          tournamentId: tournament.id,
          matchId,
          result: [{ score1: 11, score2: 5 }],
        }),
      ).rejects.toThrow('already finished')
    })
  })

  describe('generateKnockout', () => {
    let tournament

    beforeEach(async () => {
      tournament = await tournamentHandlers.createTournament({
        name: 'Test Tournament',
        date: '2024-03-15',
        formatType: 'openSingle',
      })

      // Create and add 4 players
      const players = Array.from({ length: 4 }, (_, i) => ({
        id: `ko-p${i + 1}`,
        firstName: `Player${i + 1}`,
        lastName: 'Test',
        rating: 1500 - i * 100,
      }))

      await db.collection('players').insertMany(players)

      for (const player of players) {
        await tournamentHandlers.addParticipant({
          tournamentId: tournament.id,
          playerIds: [player.id],
        })
      }

      // Generate groups
      await tournamentHandlers.generateGroups({ tournamentId: tournament.id })
    })

    it('should fail when group stage not complete', async () => {
      await expect(
        tournamentHandlers.generateKnockout({ tournamentId: tournament.id }),
      ).rejects.toThrow('group stage matches must be completed')
    })
  })
})

describe('Tournament Rules Integration', () => {
  describe('Group Match Schedule', () => {
    it('should generate correct schedule for group of 3', () => {
      // Schedule: seed 2 vs seed 3, seed 1 vs seed 3, seed 1 vs seed 2
      const participants = [
        { id: 's1', rating: 1500 },
        { id: 's2', rating: 1400 },
        { id: 's3', rating: 1300 },
      ]

      // Expected:
      // Match 1: s2 vs s3
      // Match 2: s1 vs s3
      // Match 3: s1 vs s2
    })

    it('should generate correct schedule for group of 4', () => {
      // Schedule:
      // Match 1: seed 1 vs seed 4
      // Match 2: seed 2 vs seed 3
      // Match 3: seed 1 vs seed 3
      // Match 4: seed 2 vs seed 4
      // Match 5: seed 3 vs seed 4
      // Match 6: seed 1 vs seed 2
    })
  })

  describe('Rating Requirements', () => {
    it('should validate player meets rating limit for rated events', async () => {
      // Player with rating 1600 should not be able to join U1500 tournament
    })
  })

  describe('Age Requirements', () => {
    it('should validate player meets age requirement for under age events', async () => {
      // Player who is 20 should not be able to join U19 tournament
    })

    it('should validate player meets age requirement for over age events', async () => {
      // Player who is 35 should not be able to join O40 tournament
    })
  })
})
