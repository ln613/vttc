import { getDB, save, toObjectId } from './db.js'
import crypto from 'crypto'
import argon2 from 'argon2'
import { sendVerificationEmail, sendPendingPasswordEmail } from './email.js'

// In-memory store for verification codes (per email)
const verificationCodes = new Map()

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
 * Hash a plain-text password for storage
 */
const hashPassword = async (password) => argon2.hash(password)

/**
 * Verify a plain-text password against a stored argon2 hash.
 */
const verifyPassword = async (inputPassword, storedPassword) => {
  try {
    return await argon2.verify(storedPassword, inputPassword)
  } catch {
    return false
  }
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

  if (!(await verifyPassword(password, player.password))) throwError('Invalid password')

  const token = generatePlayerToken(player)
  // Players flagged as admin/super-admin in the players collection get
  // the corresponding role on sign-in (super-admin implies admin).
  const isSuperAdmin = !!player.isSuperAdmin
  const isAdmin = isSuperAdmin || !!player.isAdmin
  return {
    token,
    isAdmin,
    isSuperAdmin,
    player: {
      _id: player._id.toString(),
      firstName: player.firstName,
      lastName: player.lastName,
      email: player.email,
      phone: player.phone,
      sex: player.sex,
      dateOfBirth: player.dateOfBirth,
      rating: player.rating,
      pending: !!player.pending,
      host: !!player.host,
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
    sex: body.sex || '',
    dateOfBirth: body.dateOfBirth || '',
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
  if (!isValidPasswordFormat(body.newPassword))
    throwError('Password does not meet requirements')
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
  const player = await collection.findOne({ _id: toObjectId(_id) })
  if (!player) throwError('Player not found')

  // Pending accounts (admin-registered) don't require the auto-generated
  // password when the user first changes it.
  if (player.password && !player.pending) {
    if (!oldPassword) throwError('Current password is required')
    if (!(await verifyPassword(oldPassword, player.password)))
      throwError('Current password is incorrect')
  }

  const hashedPassword = await hashPassword(newPassword)
  await collection.updateOne(
    { _id: toObjectId(_id) },
    { $set: { password: hashedPassword, pending: false } },
  )

  return { success: true }
}

/**
 * Register a player on their behalf (admin action). Generates a random
 * password that meets the validation rules, marks the account as pending,
 * and emails the password to the player so they can sign in and change it.
 */
export const registerPlayerByAdmin = async (body) => {
  if (!body?.playerId) throwError('Player ID is required')

  const db = getDB()
  const collection = db.collection(PLAYERS_COLLECTION)
  const player = await collection.findOne({ _id: toObjectId(body.playerId) })
  if (!player) throwError('Player not found')
  if (player.password) {
    throwError('This player already has an account')
  }
  if (!player.email) {
    throwError('Player does not have an email on file')
  }

  const password = generateRandomPassword()
  const hashedPassword = await hashPassword(password)

  await collection.updateOne(
    { _id: toObjectId(body.playerId) },
    { $set: { password: hashedPassword, pending: true } },
  )

  await sendPendingPasswordEmail(player.email, password)
  return { success: true }
}

/**
 * Generate a random password that satisfies isValidPasswordFormat:
 * 8+ chars, at least one digit, one lowercase, one uppercase.
 */
const generateRandomPassword = () => {
  const upper = 'ABCDEFGHJKLMNPQRSTUVWXYZ'
  const lower = 'abcdefghijkmnpqrstuvwxyz'
  const digits = '23456789'
  const pick = (s) => s[crypto.randomInt(s.length)]
  const required = [pick(upper), pick(lower), pick(digits)]
  const all = upper + lower + digits
  for (let i = 0; i < 9; i++) required.push(pick(all))
  // Shuffle so the required chars are not in fixed positions
  for (let i = required.length - 1; i > 0; i--) {
    const j = crypto.randomInt(i + 1)
    ;[required[i], required[j]] = [required[j], required[i]]
  }
  return required.join('')
}

/**
 * Generate a 6-digit verification code
 */
const generateVerificationCode = () =>
  Math.floor(100000 + Math.random() * 900000).toString()

/**
 * Send verification code to email
 */
export const sendVerificationCode = async (body) => {
  validateSendVerificationCodeInput(body)

  const code = generateVerificationCode()
  verificationCodes.set(body.email, {
    code,
    expiresAt: Date.now() + 10 * 60 * 1000, // 10 minutes
  })

  await sendVerificationEmail(body.email, code)

  return { success: true }
}

/**
 * Validate send verification code input
 */
const validateSendVerificationCodeInput = (body) => {
  if (!body) throwError('Request body is required')
  if (!body.email) throwError('Email is required')
  if (!isValidEmail(body.email)) throwError('Invalid email address')
}

/**
 * Verify the code sent to email
 */
export const verifyCode = async (body) => {
  validateVerifyCodeInput(body)

  const stored = verificationCodes.get(body.email)
  if (!stored) throwError('No verification code found. Please request a new one.')
  if (Date.now() > stored.expiresAt) {
    verificationCodes.delete(body.email)
    throwError('Verification code expired. Please request a new one.')
  }
  if (stored.code !== body.code) throwError('Invalid verification code')

  verificationCodes.delete(body.email)
  return { success: true }
}

/**
 * Validate verify code input
 */
const validateVerifyCodeInput = (body) => {
  if (!body) throwError('Request body is required')
  if (!body.email) throwError('Email is required')
  if (!body.code) throwError('Verification code is required')
}

/**
 * Sign up - create a new account
 */
export const signUp = async (body) => {
  validateSignUpInput(body)

  const db = getDB()
  const collection = db.collection(PLAYERS_COLLECTION)

  // Check if email already has an account with a password
  const existingByEmail = await collection.findOne({ email: body.email })
  if (existingByEmail && existingByEmail.password) {
    throwError('An account with this email already exists. Please sign in.')
  }

  // Check if phone already has an account with a password
  if (body.phone) {
    const existingByPhone = await collection.findOne({ phone: body.phone })
    if (existingByPhone && existingByPhone.password) {
      throwError('An account with this phone already exists. Please sign in.')
    }
  }

  const playerDoc = body.playerId
    ? await handleExistingPlayerSignUp(collection, body)
    : await handleNewPlayerSignUp(collection, body, existingByEmail)

  const token = generatePlayerToken(playerDoc)

  return {
    token,
    isAdmin: false,
    isSuperAdmin: false,
    player: {
      _id: playerDoc._id.toString(),
      firstName: playerDoc.firstName,
      lastName: playerDoc.lastName,
      email: playerDoc.email,
      phone: playerDoc.phone,
      sex: playerDoc.sex,
      dateOfBirth: playerDoc.dateOfBirth,
      rating: playerDoc.rating,
      host: !!playerDoc.host,
    },
  }
}

/**
 * Validate sign up input
 */
const validateSignUpInput = (body) => {
  if (!body) throwError('Request body is required')

  const errors = []
  if (!body.firstName || !body.firstName.trim()) errors.push('First name is required')
  if (!body.lastName || !body.lastName.trim()) errors.push('Last name is required')
  if (!body.email || !body.email.trim()) errors.push('Email is required')
  if (body.email && !isValidEmail(body.email)) errors.push('Invalid email address')
  if (!body.password) errors.push('Password is required')
  if (body.password && !isValidPasswordFormat(body.password)) errors.push('Password does not meet requirements')
  if (body.phone && !isValidCanadianPhone(body.phone)) errors.push('Invalid phone number')

  if (errors.length > 0) throwError(errors.join('\n'))
}

/**
 * Validate password format (at least 8 chars, 1 number, 1 upper, 1 lower)
 */
const isValidPasswordFormat = (password) =>
  password.length >= 8 &&
  /[0-9]/.test(password) &&
  /[A-Z]/.test(password) &&
  /[a-z]/.test(password)

/**
 * Handle sign up for an existing player
 */
const handleExistingPlayerSignUp = async (collection, body) => {
  const player = await collection.findOne({ _id: toObjectId(body.playerId) })
  if (!player) throwError('Player not found')
  if (player.password) throwError('This player already has an account. Please sign in.')

  const hashedPassword = await hashPassword(body.password)

  await collection.updateOne(
    { _id: toObjectId(body.playerId) },
    {
      $set: {
        email: body.email,
        phone: body.phone || player.phone || '',
        password: hashedPassword,
        dateOfBirth: body.dateOfBirth || player.dateOfBirth || '',
        sex: body.sex || player.sex || '',
      },
    },
  )

  return {
    ...player,
    email: body.email,
    phone: body.phone || player.phone || '',
    password: hashedPassword,
    dateOfBirth: body.dateOfBirth || player.dateOfBirth || '',
    sex: body.sex || player.sex || '',
  }
}

/**
 * Handle sign up for a new player (no existing player record)
 */
const handleNewPlayerSignUp = async (collection, body, existingByEmail) => {
  const hashedPassword = await hashPassword(body.password)

  if (existingByEmail) {
    // Player record exists (without password) - update it
    await collection.updateOne(
      { _id: existingByEmail._id },
      {
        $set: {
          firstName: body.firstName.trim(),
          lastName: body.lastName.trim(),
          phone: body.phone || existingByEmail.phone || '',
          password: hashedPassword,
          dateOfBirth: body.dateOfBirth || existingByEmail.dateOfBirth || '',
          sex: body.sex || existingByEmail.sex || '',
        },
      },
    )
    return {
      ...existingByEmail,
      firstName: body.firstName.trim(),
      lastName: body.lastName.trim(),
      phone: body.phone || existingByEmail.phone || '',
      password: hashedPassword,
      dateOfBirth: body.dateOfBirth || existingByEmail.dateOfBirth || '',
      sex: body.sex || existingByEmail.sex || '',
    }
  }

  // Brand new player
  const newPlayer = {
    firstName: body.firstName.trim(),
    lastName: body.lastName.trim(),
    email: body.email.trim(),
    phone: body.phone || '',
    dateOfBirth: body.dateOfBirth || '',
    sex: body.sex || '',
    password: hashedPassword,
    rating: 0,
  }

  const result = await collection.insertOne(newPlayer)
  return { ...newPlayer, _id: result.insertedId }
}
