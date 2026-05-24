import { getDB, save } from './db.js'
import crypto from 'crypto'
import argon2 from 'argon2'

const PLAYERS_COLLECTION = 'players'
const ADMIN_USERNAME = 'vttc'
const SUPER_ADMIN_USERNAME = 'nan'

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
 * Check if the input is the super admin username
 */
const isSuperAdmin = (emailOrPhone) => emailOrPhone === SUPER_ADMIN_USERNAME

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
 * Authenticate super admin user using Argon2
 */
const authenticateSuperAdmin = async (password) => {
  const storedHash = process.env.SUPER_ADMIN_HASH
  const salt = process.env.SUPER_ADMIN_SALT
  if (!storedHash || !salt) throwError('Super admin not configured')

  const isValid = await verifyArgon2Password(password, storedHash)
  if (!isValid) throwError('Invalid password')

  const token = generateAdminToken()
  return {
    token,
    isAdmin: true,
    isSuperAdmin: true,
    player: {
      _id: 'superadmin',
      firstName: 'Super Admin',
      lastName: '',
    },
  }
}

/**
 * Verify password against Argon2 hash
 */
const verifyArgon2Password = async (password, storedHash) => {
  try {
    return await argon2.verify(storedHash, password)
  } catch {
    return false
  }
}

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
    isSuperAdmin: false,
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
    isSuperAdmin: false,
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

  if (isSuperAdmin(emailOrPhone)) {
    return authenticateSuperAdmin(password)
  }

  if (isAdmin(emailOrPhone)) {
    return authenticateAdmin(password)
  }

  return authenticatePlayer(emailOrPhone, password)
}

/**
 * Validate update profile input
 */
const validateUpdateProfileInput = (body) => {
  if (!body) throwError('Request body is required')
  if (!body._id) throwError('User id is required')
}

/**
 * Validate email format (if provided)
 */
const validateEmailIfProvided = (email) => {
  if (email && !isValidEmail(email)) {
    throwError('Invalid email address')
  }
}

/**
 * Validate Canadian phone number (if provided)
 */
const validateCanadianPhoneIfProvided = (phone) => {
  if (phone && !isValidCanadianPhone(phone)) {
    throwError('Invalid Canadian phone number')
  }
}

/**
 * Check if a phone number is a valid Canadian phone number
 */
const isValidCanadianPhone = (phone) => {
  const digits = phone.replace(/\D/g, '')
  if (digits.length === 10) {
    return /^[2-9]\d{2}[2-9]\d{6}$/.test(digits)
  }
  if (digits.length === 11 && digits.startsWith('1')) {
    return /^1[2-9]\d{2}[2-9]\d{6}$/.test(digits)
  }
  return false
}

/**
 * Update player profile
 */
export const updateProfile = async (body) => {
  validateUpdateProfileInput(body)
  validateEmailIfProvided(body.email)
  validateCanadianPhoneIfProvided(body.phone)

  const updateData = {
    _id: body._id,
    firstName: body.firstName || '',
    lastName: body.lastName || '',
    email: body.email || '',
    phone: body.phone || '',
  }

  await save(PLAYERS_COLLECTION, updateData)

  return { success: true }
}

/**
 * Validate change password input
 */
const validateChangePasswordInput = (body) => {
  if (!body) throwError('Request body is required')
  if (!body._id) throwError('User id is required')
  if (!body.newPassword) throwError('New password is required')
  if (body.newPassword.length < 6)
    throwError('Password must be at least 6 characters')
  if (body.newPassword !== body.confirmPassword)
    throwError('Passwords do not match')
}

/**
 * Change password for a player
 */
export const changePassword = async (body) => {
  validateChangePasswordInput(body)

  const { _id, oldPassword, newPassword } = body

  const db = getDB()
  const collection = db.collection(PLAYERS_COLLECTION)
  const { toObjectId } = await import('./db.js')

  const player = await collection.findOne({ _id: toObjectId(_id) })
  if (!player) throwError('Player not found')

  // If player already has a password, old password is required
  if (player.password) {
    if (!oldPassword) throwError('Current password is required')
    if (!verifyPassword(oldPassword, player.password))
      throwError('Current password is incorrect')
  }

  await collection.updateOne(
    { _id: toObjectId(_id) },
    { $set: { password: newPassword } },
  )

  return { success: true }
}
