import { getDB, save, toObjectId } from './db.js'
import crypto from 'crypto'
import argon2 from 'argon2'
import { sendVerificationEmail, sendPendingPasswordEmail } from './email.js'
import {
  validateRatingRequirement,
  meetsAgeRequirement,
  deleteParticipant,
  deletePlayerFromTeam,
  calculateParticipantRating,
} from './eventHandlers.js'

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
 * Validate Canadian/US (NANP) phone number (if provided)
 */
const validateNorthAmericanPhoneIfProvided = (phone) => {
  if (phone && !isValidNorthAmericanPhone(phone)) {
    throwError('Invalid Canadian/US phone number')
  }
}

/**
 * Check if a phone number is a valid Canadian/US (NANP) phone number
 */
const isValidNorthAmericanPhone = (phone) => {
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
 * Validate rating (if provided) — must be a non-negative integer.
 */
const validateRatingIfProvided = (rating) => {
  if (rating === undefined || rating === null || rating === '') return
  if (!Number.isInteger(rating) || rating < 0) {
    throwError('Rating must be a non-negative integer')
  }
}

/**
 * Update player profile
 */
export const updateProfile = async (body) => {
  validateUpdateProfileInput(body)
  validateEmailIfProvided(body.email)
  validateNorthAmericanPhoneIfProvided(body.phone)
  validateRatingIfProvided(body.rating)

  const db = getDB()
  const collection = db.collection(PLAYERS_COLLECTION)
  const existing = await collection.findOne({ _id: toObjectId(body._id) })

  // Resolve the effective rating and dob the player would have after
  // this save — used both for the unqualified-event check and for
  // propagation to future events.
  const newRating =
    body.rating !== undefined && body.rating !== null && body.rating !== ''
      ? Number(body.rating)
      : existing?.rating
  const newDateOfBirth = body.dateOfBirth || ''

  // Detect future events the player is registered for that the player
  // would no longer qualify for under the new rating/dateOfBirth.
  const affectedEvents = await findAffectedFutureEvents({
    playerId: body._id,
    newRating,
    newDateOfBirth,
  })

  // Spec: ask BEFORE saving. If there are affected events and the
  // caller hasn't confirmed removal, return the list and persist
  // nothing.
  if (affectedEvents.length > 0 && !body.confirmRemove) {
    return { success: false, needsConfirm: true, affectedEvents }
  }

  // If confirmed, remove the player from those events first so that the
  // subsequent propagation doesn't touch them.
  if (body.confirmRemove && affectedEvents.length > 0) {
    for (const ev of affectedEvents) {
      try {
        await removePlayerFromEvent({ _id: ev._id, playerId: body._id })
      } catch {
        // continue on per-event failure
      }
    }
  }

  // Build the player update document.
  const updateData = {
    _id: body._id,
    firstName: body.firstName || '',
    lastName: body.lastName || '',
    sex: body.sex || '',
    dateOfBirth: newDateOfBirth,
    email: body.email || '',
    phone: body.phone || '',
  }

  // Rating is only persisted when explicitly provided. When it changes,
  // append an entry to the player's ratingHistory[] so the previous
  // rating + the time of the change are kept in the db.
  let ratingChanged = false
  if (body.rating !== undefined && body.rating !== null && body.rating !== '') {
    const previousRating = existing?.rating
    updateData.rating = newRating
    const existingHistory = Array.isArray(existing?.ratingHistory)
      ? existing.ratingHistory
      : []
    if (previousRating !== newRating) {
      ratingChanged = true
      updateData.ratingHistory = [
        ...existingHistory,
        {
          rating: newRating,
          previousRating: previousRating ?? null,
          changedAt: new Date().toISOString(),
        },
      ]
    } else {
      updateData.ratingHistory = existingHistory
    }
  }

  await save(PLAYERS_COLLECTION, updateData)

  // Propagate to every remaining future event the player is still
  // registered in. Rating updates when admin-adjusted; host is always
  // synced from the player record so the host-counts-as-paid logic
  // stays correct even if host was flipped outside updateProfile.
  await propagatePlayerSnapshotToFutureEvents(body._id, {
    rating: newRating,
    host: !!existing?.host,
    ratingChanged,
  })

  return { success: true, affectedEvents: [] }
}

// Refresh the embedded player snapshot inside participants of every
// future event the player is in. When the rating changed, also
// recompute participant.rating (combined).
const propagatePlayerSnapshotToFutureEvents = async (
  playerId,
  { rating, host, ratingChanged },
) => {
  const db = getDB()
  const today = new Date().toISOString().slice(0, 10)
  const events = await db
    .collection('events')
    .find({ date: { $gte: today } })
    .toArray()
  for (const event of events) {
    let modified = false
    const updatedParticipants = (event.participants || []).map((p) => {
      const player = (p.players || []).find(
        (pl) => pl._id?.toString() === playerId?.toString(),
      )
      if (!player) return p
      const ratingDiffers = ratingChanged && player.rating !== rating
      const hostDiffers = !!player.host !== host
      if (!ratingDiffers && !hostDiffers) return p
      modified = true
      const updatedPlayers = (p.players || []).map((pl) =>
        pl._id?.toString() === playerId?.toString()
          ? { ...pl, ...(ratingChanged ? { rating } : {}), host }
          : pl,
      )
      return {
        ...p,
        players: updatedPlayers,
        ...(ratingChanged
          ? { rating: calculateParticipantRating(updatedPlayers, event.nop) }
          : {}),
      }
    })
    if (modified) {
      await db
        .collection('events')
        .updateOne(
          { _id: event._id },
          { $set: { participants: updatedParticipants } },
        )
    }
  }
}

// For every future event the player is registered in, simulate the
// participant with the new rating/dob and report the events they would
// no longer qualify for.
const findAffectedFutureEvents = async ({ playerId, newRating, newDateOfBirth }) => {
  const db = getDB()
  const today = new Date().toISOString().slice(0, 10)
  const events = await db
    .collection('events')
    .find({ date: { $gte: today } })
    .toArray()
  const affected = []
  for (const event of events) {
    const participant = (event.participants || []).find((p) =>
      (p.players || []).some(
        (pl) => pl._id?.toString() === playerId?.toString(),
      ),
    )
    if (!participant) continue
    const updatedPlayers = (participant.players || []).map((p) =>
      p._id?.toString() === playerId?.toString()
        ? { ...p, rating: newRating, dateOfBirth: newDateOfBirth || p.dateOfBirth }
        : p,
    )
    const reason = computeUnqualifiedReason(event, updatedPlayers)
    if (reason) {
      affected.push({
        _id: event._id.toString(),
        eventName: event.eventName,
        date: event.date,
        reason,
      })
    }
  }
  return affected
}

const computeUnqualifiedReason = (event, players) => {
  if (event.restriction === 'Rated' && event.ratingLimit) {
    const errs = validateRatingRequirement(event, players)
    if (errs.length > 0) return `exceeds rating limit (${event.ratingLimit})`
  }
  if (event.restriction === 'Age' && event.ageLimitType && event.ageLimit) {
    for (const p of players) {
      if (!p.dateOfBirth) continue
      if (!meetsAgeRequirement(p, event.ageLimitType, event.ageLimit, event.date)) {
        const req =
          event.ageLimitType === 'U'
            ? `under ${event.ageLimit}`
            : `over ${event.ageLimit}`
        return `does not meet age requirement (${req})`
      }
    }
  }
  return null
}

// Remove a player from an event regardless of singles/team — looks up
// the participant by playerId then routes to the appropriate delete
// endpoint. Used after admin confirms removal in the Account page flow.
export const removePlayerFromEvent = async (body) => {
  if (!body) throwError('Request body is required')
  if (!body._id) throwError('Event ID is required')
  if (!body.playerId) throwError('Player ID is required')

  const db = getDB()
  const event = await db
    .collection('events')
    .findOne({ _id: toObjectId(body._id) })
  if (!event) throwError('Event not found')

  const participant = (event.participants || []).find((p) =>
    (p.players || []).some(
      (pl) => pl._id?.toString() === body.playerId.toString(),
    ),
  )
  if (!participant) return { success: true }

  if ((event.nop ?? 1) > 1) {
    return deletePlayerFromTeam({
      _id: body._id,
      participantId: participant._id,
      playerId: body.playerId,
    })
  }
  return deleteParticipant({
    _id: body._id,
    participantId: participant._id,
  })
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
