import { getDB, save, toObjectId } from './db.js'
import { getSettings } from './settingsHandlers.js'
import { createToken } from './authToken.js'
import crypto from 'crypto'
import argon2 from 'argon2'
import { sendPendingPasswordEmail } from './email.js'
import {
  validateChannel,
  normalizeAddress,
  sendCode,
  checkCode,
  readVerifiedContact,
  createVerifiedContactToken,
} from './verification.js'
import { verifyGoogleSignInCode } from './googleAuth.js'
import { normalizePhone } from '../../../shared/rules/contact.js'
import {
  isSimilarName,
  candidateFamilyNames,
  toTitleCase,
} from '../../../shared/rules/nameMatch.js'
import {
  validateRatingRequirement,
  meetsAgeRequirement,
  deleteParticipant,
  deletePlayerFromTeam,
  calculateParticipantRating,
} from './eventHandlers.js'

const PLAYERS_COLLECTION = 'players'
const ADMIN_USERNAME = 'vttc'
const SUPER_ADMIN_USERNAME = 'nan'
const TABLET_USERNAME = 'tablet'

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
 * Check if the input is the tablet kiosk username
 */
const isTablet = (emailOrPhone) => emailOrPhone === TABLET_USERNAME

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

  // Phones are stored as their bare 10 digits, so "604-555-1234" is looked
  // up as "6045551234" too — otherwise the number someone signed up with
  // would only work typed exactly the way it is stored.
  const phone = normalizePhone(emailOrPhone)
  const player = await collection.findOne({
    $or: [
      { email: emailOrPhone },
      { phone: emailOrPhone },
      ...(phone && phone !== emailOrPhone ? [{ phone }] : []),
    ],
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
// Signed so the server can verify it later — see authToken.js. The old
// form was a random hash with no payload, which nothing could check.
const generateToken = (payload) => createToken(payload)

/**
 * Generate token for a player
 */
const generatePlayerToken = (player) =>
  generateToken({
    playerId: player._id.toString(),
    isAdmin: !!player.isAdmin || !!player.isSuperAdmin,
    isSuperAdmin: !!player.isSuperAdmin,
  })

/**
 * Generate token for admin
 */
const generateAdminToken = ({ isSuperAdmin = false } = {}) =>
  generateToken({ isAdmin: true, isSuperAdmin })

/**
 * Authenticate super admin user using Argon2
 */
const authenticateSuperAdmin = async (password) => {
  const storedHash = process.env.SUPER_ADMIN_HASH
  const salt = process.env.SUPER_ADMIN_SALT
  if (!storedHash || !salt) throwError('Super admin not configured')

  const isValid = await verifyArgon2Password(password, storedHash)
  if (!isValid) throwError('Invalid password')

  const token = generateAdminToken({ isSuperAdmin: true })
  return {
    token,
    isAdmin: true,
    isSuperAdmin: true,
    isTablet: false,
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
    isTablet: false,
    player: {
      _id: 'admin',
      firstName: 'Admin',
      lastName: '',
    },
  }
}

/**
 * Authenticate tablet kiosk. Tablet role is read-only across the site
 * but can umpire a game on the Game Play page.
 */
const authenticateTablet = (password) => {
  const tabletPassword = process.env.TABLET_PASSWORD
  if (!tabletPassword) throwError('Tablet password not configured')
  if (password !== tabletPassword) throwError('Invalid password')

  // Explicitly NOT an admin token: the tablet is read-only apart from
  // umpiring, and the response below has always said isAdmin: false. It
  // shared generateAdminToken() only because tokens used to carry nothing.
  const token = generateToken({ isAdmin: false, isTablet: true })
  return {
    token,
    isAdmin: false,
    isSuperAdmin: false,
    isTablet: true,
    player: {
      _id: 'tablet',
      firstName: 'Tablet',
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

  if (!player.password) {
    throwError(
      player.googleId
        ? 'This account signs in with Google'
        : 'No password set for this account',
    )
  }

  if (!(await verifyPassword(password, player.password))) throwError('Invalid password')

  return buildSignInResponse(player)
}

// What every successful sign-in returns, however it was done. Players flagged
// as admin/super-admin in the players collection get the corresponding role
// (super-admin implies admin). `hasPassword` tells the Account page whether to
// ask for the current password or offer to set one.
const buildSignInResponse = (player) => {
  const isSuperAdmin = !!player.isSuperAdmin
  return {
    token: generatePlayerToken(player),
    isAdmin: isSuperAdmin || !!player.isAdmin,
    isSuperAdmin,
    isTablet: false,
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
      hasPassword: !!player.password,
    },
  }
}

/**
 * Sign in to umpire with the match-day password.
 *
 * A plain token with no role flags: the scoring endpoints only require a
 * valid one, so this is all an umpire needs. Deliberately NOT the tablet
 * role — a person umpiring for the evening is not a kiosk, and shouldn't
 * get the tablet's read-only chrome or its auto-resume behaviour.
 *
 * Someone already signed in ignores the token and keeps their account; for
 * them this call just confirms the password.
 */
export const umpireSignIn = async (body) => {
  if (!body) throwError('Request body is required')

  // Checked here rather than only in the UI: hiding the button is a
  // courtesy, refusing the password is the rule.
  const { allowPublicUmpire } = await getSettings()
  if (!allowPublicUmpire) throwError('Umpiring without an account is turned off')

  const matchDayPassword = process.env.TABLET_PASSWORD
  if (!matchDayPassword) throwError('Match day password not configured')
  if (body.password !== matchDayPassword) throwError('Invalid password')

  return {
    token: generateToken({ isAdmin: false, isTablet: false }),
    isAdmin: false,
    isSuperAdmin: false,
    isTablet: false,
    player: { _id: 'umpire', firstName: 'Umpire', lastName: '' },
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

  if (isTablet(emailOrPhone)) {
    return authenticateTablet(password)
  }

  return authenticatePlayer(emailOrPhone, password)
}

// ==================== whose account ====================
//
// Both endpoints below take the player's id in the body. They used to trust
// it, so any signed-in player could change anyone's email or set a password
// on an account without one. With Google sign-in linking by email, that was
// a way into someone else's account: point their email at your own Google
// account and sign in.

const isCaller = (auth, playerId) =>
  !!auth?.playerId && auth.playerId === String(playerId)

// A player edits their own profile; an admin edits anyone's.
const validateSelfOrAdmin = (auth, playerId) => {
  if (!auth?.isAdmin && !isCaller(auth, playerId)) {
    throwError('You can only change your own account')
  }
}

// A password is only ever set by the person it belongs to.
const validateSelf = (auth, playerId) => {
  if (!isCaller(auth, playerId)) throwError('You can only change your own password')
}

// An email or phone belongs to one account. Taking one another account
// already uses would leave two accounts behind one sign-in.
const validateContactNotTaken = async (collection, playerId, email, phone) => {
  const others = { _id: { $ne: toObjectId(playerId) }, ...isAccountFilter }
  const clashes = []
  if (email?.trim()) clashes.push({ ...contactFilter('email', email.trim()), ...others })
  const tenDigits = normalizePhone(phone)
  if (tenDigits) clashes.push({ ...contactFilter('phone', tenDigits), ...others })

  for (const filter of clashes) {
    if (await collection.findOne(filter, { projection: { _id: 1 } })) {
      throwError(
        filter.email
          ? 'That email is already used by another account'
          : 'That phone number is already used by another account',
      )
    }
  }
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
export const updateProfile = async (body, auth) => {
  validateUpdateProfileInput(body)
  validateSelfOrAdmin(auth, body._id)
  validateEmailIfProvided(body.email)
  validateNorthAmericanPhoneIfProvided(body.phone)
  validateRatingIfProvided(body.rating)

  const db = getDB()
  const collection = db.collection(PLAYERS_COLLECTION)
  await validateContactNotTaken(collection, body._id, body.email, body.phone)
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
    email: (body.email || '').trim(),
    // Stored as its bare 10 digits, like every phone on file, so sign-in
    // finds it however it is typed.
    phone: normalizePhone(body.phone) || '',
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
export const changePassword = async (body, auth) => {
  validateChangePasswordInput(body)
  validateSelf(auth, body._id)

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
  if (hasAccount(player)) {
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

// ==================== SIGN-UP ====================
//
// Sign-up is a wizard (specs/shared/header.md): choose email or phone, prove
// you own it, then say who you are. The proving happens in verification.js;
// what is here decides whether an address is free, who a new person might
// already be, and writes the account.

const MAX_SIMILAR_PLAYERS = 20

const accountExistsMessage = (channel) =>
  channel === 'phone'
    ? 'An account with this phone number already exists. Please sign in.'
    : 'An account with this email already exists. Please sign in.'

// An account is a player someone can sign in as: one with a password, or one
// linked to a Google account — which may have no password at all. A record
// that merely has an address on file (imported, or entered by an admin) is
// not an account; signing up with that address adopts it (see
// createOrAdoptPlayer).
const NON_EMPTY = { $exists: true, $nin: ['', null] }
const isAccountFilter = { $or: [{ password: NON_EMPTY }, { googleId: NON_EMPTY }] }
const hasAccount = (player) => !!(player?.password || player?.googleId)

const contactFilter = (channel, address) =>
  channel === 'email'
    ? { email: { $regex: `^${escapeRegex(address)}$`, $options: 'i' } }
    : { phone: address }

const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

const findAccountByContact = (collection, channel, address, projection = { _id: 1 }) =>
  collection.findOne(
    { ...contactFilter(channel, address), ...isAccountFilter },
    { projection },
  )

// Older clients sent `{ email }`; the wizard sends `{ channel, to }`. Both are
// read so a page left open across a deploy still works.
const readContactInput = (body) => {
  if (!body) throwError('Request body is required')
  const channel = body.channel || (body.email ? 'email' : undefined)
  const raw = body.to ?? body.email
  validateChannel(channel)
  const address = normalizeAddress(channel, raw)
  if (!address) {
    throwError(channel === 'phone' ? 'Invalid Canadian/US phone number' : 'Invalid email address')
  }
  return { channel, address }
}

/**
 * Send a verification code — unless the address already belongs to an
 * account, in which case nothing is sent and the wizard sends the person to
 * sign in instead.
 */
export const sendVerificationCode = async (body) => {
  const { channel, address } = readContactInput(body)

  const collection = getDB().collection(PLAYERS_COLLECTION)
  if (await findAccountByContact(collection, channel, address)) {
    return { accountExists: true }
  }

  const { resendIn } = await sendCode(channel, address)
  return { sent: true, resendIn }
}

/**
 * Check a code. A right one returns the token signUp needs as proof.
 */
export const verifyCode = async (body) => {
  const { channel, address } = readContactInput(body)
  const verificationToken = await checkCode(channel, address, body.code)
  return { verificationToken }
}

const validateFindSimilarPlayersInput = (params) => {
  if (!params) throwError('First and last name are required')
  if (!params.firstName?.trim()) throwError('First name is required')
  if (!params.lastName?.trim()) throwError('Last name is required')
}

// Loose enough to find "O'Brien" from "obrien" and "Ding Hao" from
// "dinghao": the letters in order, anything that is not a letter allowed in
// between. The precise decision is isSimilarName's; this only narrows the
// fetch to one family name's worth of players.
const familyNamePattern = (normalized) => {
  const letters = normalized.replace(/[^a-z]/g, '')
  return new RegExp(`^[^a-z]*${letters.split('').join('[^a-z]*')}[^a-z]*$`, 'i')
}

// Only what the public player list already shows, plus whether a date of
// birth is on file — the wizard skips asking for one that is.
const toSimilarPlayer = (p) => ({
  _id: p._id.toString(),
  firstName: p.firstName,
  lastName: p.lastName,
  sex: p.sex || '',
  rating: p.rating ?? 0,
  hasDateOfBirth: !!p.dateOfBirth,
})

const byName = (a, b) =>
  `${a.lastName} ${a.firstName}`.localeCompare(`${b.lastName} ${b.firstName}`)

/**
 * Players on file who may be the person signing up. Players who already have
 * an account are left out: they are somebody else, or this person should be
 * signing in.
 */
export const findSimilarPlayers = async (params) => {
  validateFindSimilarPlayersInput(params)
  const typed = { firstName: params.firstName, lastName: params.lastName }

  const families = candidateFamilyNames(typed)
  const candidates = await getDB()
    .collection(PLAYERS_COLLECTION)
    .find(
      { lastName: { $in: families.map(familyNamePattern) } },
      {
        projection: {
          firstName: 1, lastName: 1, sex: 1, rating: 1, dateOfBirth: 1, password: 1, googleId: 1,
        },
      },
    )
    .toArray()

  return candidates
    .filter((p) => !hasAccount(p) && isSimilarName(typed, p))
    .sort(byName)
    .slice(0, MAX_SIMILAR_PLAYERS)
    .map(toSimilarPlayer)
}

/**
 * Sign up. The address comes from the verification token, never from the
 * request body, so an account can only be made for an address someone
 * proved they own.
 */
export const signUp = async (body) => {
  if (!body?.verificationToken) throwError('Please verify your email or phone first')
  const { channel, address, googleId } = readVerifiedContact(body.verificationToken)
  // Someone who came through Google can sign in with Google, so a password
  // is theirs to add or not. Everyone else signs in with one.
  validateSignUpInput(body, { passwordOptional: !!googleId })

  const collection = getDB().collection(PLAYERS_COLLECTION)
  // Asked again, not only when the code went out: someone may have finished
  // signing up with this address in the meantime.
  if (await findAccountByContact(collection, channel, address)) {
    throwError(accountExistsMessage(channel))
  }
  if (googleId && (await collection.findOne({ googleId }, { projection: { _id: 1 } }))) {
    throwError('This Google account is already signed up. Please sign in with Google.')
  }

  const credentials = await buildCredentials(body.password, googleId)
  const contact = { channel, address, credentials }
  const playerDoc = body.playerId
    ? await claimExistingPlayer(collection, body, contact)
    : await createOrAdoptPlayer(collection, body, contact)

  return buildSignUpResponse(playerDoc)
}

// How the new account will sign in: a password, a Google account, or both.
const buildCredentials = async (password, googleId) => ({
  ...(password ? { password: await hashPassword(password) } : {}),
  ...(googleId ? { googleId } : {}),
})

const SEX_VALUES = ['M', 'F']

const validateSignUpInput = (body, { passwordOptional }) => {
  const errors = []
  if (!body.firstName?.trim()) errors.push('First name is required')
  if (!body.lastName?.trim()) errors.push('Last name is required')
  if (!body.password && !passwordOptional) errors.push('Password is required')
  if (body.password && !isValidPasswordFormat(body.password)) {
    errors.push('Password does not meet requirements')
  }
  if (body.sex && !SEX_VALUES.includes(body.sex)) errors.push('Invalid sex')
  if (body.dateOfBirth && !isValidDateOfBirth(body.dateOfBirth)) {
    errors.push('Invalid date of birth')
  }

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

// A real calendar date, not in the future, and not implausibly long ago.
const isValidDateOfBirth = (value) => {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  if (!match) return false
  const [, y, m, d] = match.map(Number)
  const date = new Date(Date.UTC(y, m - 1, d))
  const isRealDate =
    date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d
  const thisYear = new Date().getUTCFullYear()
  return isRealDate && date.getTime() <= Date.now() && y >= thisYear - 120
}

// Signing up as a player already on file. What the record already says wins:
// the wizard only asks for a sex or date of birth that is missing, and the
// name stays as it was imported.
const claimExistingPlayer = async (collection, body, { channel, address, credentials }) => {
  const player = await collection.findOne({ _id: toObjectId(body.playerId) })
  if (!player) throwError('Player not found')
  if (hasAccount(player)) throwError('This player already has an account. Please sign in.')
  // Anyone can pick any unclaimed player by name here. A record an admin has
  // flagged as an admin is not one to hand over that way.
  if (player.isAdmin || player.isSuperAdmin) {
    throwError('Please contact the club to set up this account')
  }

  const updates = {
    [channel]: address,
    ...credentials,
    sex: player.sex || body.sex || '',
    dateOfBirth: player.dateOfBirth || body.dateOfBirth || '',
  }
  await collection.updateOne({ _id: player._id }, { $set: updates })
  return { ...player, ...updates }
}

// A new person — unless a record without an account already carries the
// address they just proved, in which case that record is theirs. That record
// takes the name they typed, and keeps any sex or date of birth it has.
const createOrAdoptPlayer = async (collection, body, { channel, address, credentials }) => {
  const names = {
    firstName: toTitleCase(body.firstName),
    lastName: toTitleCase(body.lastName),
  }

  const owner = await collection.findOne(contactFilter(channel, address))
  if (owner) {
    const updates = {
      ...names,
      ...credentials,
      sex: owner.sex || body.sex || '',
      dateOfBirth: owner.dateOfBirth || body.dateOfBirth || '',
    }
    await collection.updateOne({ _id: owner._id }, { $set: updates })
    return { ...owner, ...updates }
  }

  const newPlayer = {
    ...names,
    email: channel === 'email' ? address : '',
    phone: channel === 'phone' ? address : '',
    sex: body.sex || '',
    dateOfBirth: body.dateOfBirth || '',
    ...credentials,
    rating: 0,
  }
  const result = await collection.insertOne(newPlayer)
  return { ...newPlayer, _id: result.insertedId }
}

const buildSignUpResponse = (playerDoc) => ({
  ...buildSignInResponse(playerDoc),
  // No rating yet: the wizard tells them who to ask for one before they can
  // enter a rating-restricted event.
  needsRating: !playerDoc.rating,
})

// ==================== SIGN IN WITH GOOGLE ====================

/**
 * A code from Google's sign-in popup. Either it belongs to an account —
 * which is signed in — or it proves an email nobody has signed up with yet,
 * and the sign-up wizard carries on from "What's your name?" with what
 * Google told us.
 */
export const googleSignIn = async (body) => {
  if (!body?.code) throwError('Google sign-in failed. Please try again.')
  const claims = await verifyGoogleSignInCode(body.code)
  // Only an address Google has verified proves anything.
  if (claims.email_verified !== true && claims.email_verified !== 'true') {
    throwError('Your Google email address is not verified')
  }

  const collection = getDB().collection(PLAYERS_COLLECTION)
  const player = await findGoogleAccount(collection, claims)
  if (player) return { signedIn: true, ...buildSignInResponse(player) }

  const email = normalizeAddress('email', claims.email)
  return {
    needsSignUp: true,
    verificationToken: createVerifiedContactToken({
      channel: 'email',
      address: email,
      googleId: claims.sub,
    }),
    email,
    firstName: claims.given_name || '',
    lastName: claims.family_name || '',
  }
}

// The account this Google identity signs in to: the one already linked to it,
// or else the account with its Google-verified email — which is linked now,
// so the two ways of signing in lead to the same place.
const findGoogleAccount = async (collection, claims) => {
  const linked = await collection.findOne({ googleId: claims.sub })
  if (linked) return linked

  const byEmail = await findAccountByContact(collection, 'email', claims.email, {})
  if (!byEmail) return null
  if (byEmail.googleId) throwError('This email is linked to a different Google account')

  await collection.updateOne({ _id: byEmail._id }, { $set: { googleId: claims.sub } })
  return { ...byEmail, googleId: claims.sub }
}
