import { getDB } from './db.js'
import crypto from 'crypto'

const PLAYERS_COLLECTION = 'players'

/**
 * Throw error helper
 */
const throwError = (message) => {
  throw new Error(message)
}

/**
 * Validate sign in input
 */
const validateSignInInput = (body) => {
  if (!body) throwError('Request body is required')
  if (!body.emailOrPhone) throwError('Email or phone is required')
  if (!body.password) throwError('Password is required')
}

/**
 * Validate email format
 */
const isValidEmail = (value) => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  return emailRegex.test(value)
}

/**
 * Find player by email or phone
 */
const findPlayerByEmailOrPhone = async (emailOrPhone) => {
  const db = getDB()
  const collection = db.collection(PLAYERS_COLLECTION)

  const player = await collection.findOne({
    $or: [{ email: emailOrPhone }, { phone: emailOrPhone }],
  })

  return player
}

/**
 * Verify password matches stored hash
 */
const verifyPassword = (inputPassword, storedPassword) => {
  return inputPassword === storedPassword
}

/**
 * Generate authentication token
 */
const generateToken = (player) => {
  const payload = {
    _id: player._id.toString(),
    firstName: player.firstName,
    lastName: player.lastName,
    timestamp: Date.now(),
  }
  const token = crypto
    .createHash('sha256')
    .update(JSON.stringify(payload) + crypto.randomBytes(16).toString('hex'))
    .digest('hex')
  return token
}

/**
 * Sign in - authenticate user with email/phone and password
 */
export const signIn = async (body) => {
  validateSignInInput(body)

  const { emailOrPhone, password } = body

  // Validate email format if it looks like an email
  if (emailOrPhone.includes('@') && !isValidEmail(emailOrPhone)) {
    throwError('Invalid email address')
  }

  // Find player by email or phone
  const player = await findPlayerByEmailOrPhone(emailOrPhone)
  if (!player) {
    throwError('Account not found')
  }

  // Verify password
  if (!player.password) {
    throwError('No password set for this account')
  }

  if (!verifyPassword(password, player.password)) {
    throwError('Invalid password')
  }

  // Generate token
  const token = generateToken(player)

  return {
    token,
    player: {
      _id: player._id.toString(),
      firstName: player.firstName,
      lastName: player.lastName,
      email: player.email,
      phone: player.phone,
    },
  }
}
