import { getDB } from './db.js'
import crypto from 'crypto'

const PLAYERS_COLLECTION = 'players'
const ADMIN_USERNAME = 'vttc'

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
 * Check if the input is the admin username
 */
const isAdmin = (emailOrPhone) => emailOrPhone === ADMIN_USERNAME

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
const generateToken = (payload) => {
  const token = crypto
    .createHash('sha256')
    .update(JSON.stringify(payload) + crypto.randomBytes(16).toString('hex'))
    .digest('hex')
  return token
}

/**
 * Generate token for a player
 */
const generatePlayerToken = (player) =>
  generateToken({
    _id: player._id.toString(),
    firstName: player.firstName,
    lastName: player.lastName,
    timestamp: Date.now(),
  })

/**
 * Generate token for admin
 */
const generateAdminToken = () =>
  generateToken({
    admin: true,
    timestamp: Date.now(),
  })

/**
 * Authenticate admin user
 */
const authenticateAdmin = (password) => {
  const adminPassword = process.env.ADMIN_PASSWORD
  if (!adminPassword) throwError('Admin password not configured')
  if (password !== adminPassword) throwError('Invalid password')

  const token = generateAdminToken()
  return {
    token,
    isAdmin: true,
    player: {
      _id: 'admin',
      firstName: 'Admin',
      lastName: '',
    },
  }
}

/**
 * Authenticate player user
 */
const authenticatePlayer = async (emailOrPhone, password) => {
  if (emailOrPhone.includes('@') && !isValidEmail(emailOrPhone)) {
    throwError('Invalid email address')
  }

  const player = await findPlayerByEmailOrPhone(emailOrPhone)
  if (!player) throwError('Account not found')

  if (!player.password) throwError('No password set for this account')

  if (!verifyPassword(password, player.password)) throwError('Invalid password')

  const token = generatePlayerToken(player)
  return {
    token,
    isAdmin: false,
    player: {
      _id: player._id.toString(),
      firstName: player.firstName,
      lastName: player.lastName,
      email: player.email,
      phone: player.phone,
    },
  }
}

/**
 * Sign in - authenticate user with email/phone and password
 */
export const signIn = async (body) => {
  validateSignInInput(body)

  const { emailOrPhone, password } = body

  if (isAdmin(emailOrPhone)) {
    return authenticateAdmin(password)
  }

  return authenticatePlayer(emailOrPhone, password)
}
