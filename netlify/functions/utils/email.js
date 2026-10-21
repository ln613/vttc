import nodemailer from 'nodemailer'

/**
 * Create Gmail transporter using app password
 */
const createTransporter = () => {
  const user = process.env.GMAIL_1
  const pass = process.env.GMAIL_1_APP_PASSWORD

  validateGmailConfig(user, pass)

  return nodemailer.createTransport({
    service: 'gmail',
    auth: { user, pass },
  })
}

/**
 * Validate Gmail configuration
 */
const validateGmailConfig = (user, pass) => {
  if (!user || !pass) {
    throw new Error('Gmail configuration is missing. Set GMAIL_1 and GMAIL_1_APP_PASSWORD in .env')
  }
}

/**
 * Send an email
 */
export const sendEmail = async ({ to, subject, html }) => {
  validateSendEmailInput(to, subject)

  const transporter = createTransporter()
  const from = process.env.GMAIL_1

  await transporter.sendMail({ from, to, subject, html })
}

/**
 * Validate send email input
 */
const validateSendEmailInput = (to, subject) => {
  if (!to) throw new Error('Recipient email is required')
  if (!subject) throw new Error('Email subject is required')
}

/**
 * Send a verification code email
 */
export const sendVerificationEmail = async (to, code) => {
  if (!to) throw new Error('Recipient email is required')
  if (!code) throw new Error('Verification code is required')

  const subject = 'VTTC - Email Verification Code'
  const html = buildVerificationEmailHtml(code)

  await sendEmail({ to, subject, html })
}

/**
 * Send a new-account password email when an admin registers a player.
 */
export const sendPendingPasswordEmail = async (to, password) => {
  if (!to) throw new Error('Recipient email is required')
  if (!password) throw new Error('Password is required')

  const subject = 'VTTC - Your account is ready'
  const html = buildPendingPasswordEmailHtml(password)

  await sendEmail({ to, subject, html })
}

const buildPendingPasswordEmailHtml = (password) => `
  <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 24px;">
    <h2 style="color: #2185d0; text-align: center;">Vancouver Table Tennis Club</h2>
    <p style="font-size: 16px; color: #333;">An account has been created for you at VTTC. Please sign in with the password below and change it on your first sign in.</p>
    <div style="text-align: center; margin: 24px 0;">
      <span style="font-size: 24px; font-weight: bold; letter-spacing: 2px; color: #2c3e50; background: #f0f4f8; padding: 12px 24px; border-radius: 8px;">
        ${password}
      </span>
    </div>
    <p style="font-size: 14px; color: #666;">If you did not expect this email, please ignore it.</p>
  </div>
`

/**
 * Build the HTML body for verification code email
 */
const buildVerificationEmailHtml = (code) => `
  <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 24px;">
    <h2 style="color: #2185d0; text-align: center;">Vancouver Table Tennis Club</h2>
    <p style="font-size: 16px; color: #333;">Your verification code is:</p>
    <div style="text-align: center; margin: 24px 0;">
      <span style="font-size: 32px; font-weight: bold; letter-spacing: 6px; color: #2c3e50; background: #f0f4f8; padding: 12px 24px; border-radius: 8px;">
        ${code}
      </span>
    </div>
    <p style="font-size: 14px; color: #666;">This code will expire in 10 minutes.</p>
    <p style="font-size: 14px; color: #666;">If you did not request this code, please ignore this email.</p>
  </div>
`

/**
 * A receipt — a court booking's or a top-up's; see bookingReceipt.js for
 * what each says.
 */
export const sendReceiptEmail = async (to, receipt) => {
  if (!to) throw new Error('Recipient email is required')
  if (!receipt) throw new Error('Receipt is required')

  const subject = `${receipt.title} — ${receipt.ref}`
  const html = buildReceiptHtml(receipt)

  await sendEmail({ to, subject, html })
}

export const sendBookingReceiptEmail = sendReceiptEmail

const escapeHtml = (value) =>
  String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')

const buildReceiptRowsHtml = (lines) =>
  lines
    .map(
      (line) => `
      <tr>
        <td style="padding: 6px 0; color: #666; font-size: 14px;">${escapeHtml(line.label)}</td>
        <td style="padding: 6px 0; color: #333; font-size: 14px; text-align: right; font-weight: bold;">${escapeHtml(line.value)}</td>
      </tr>`,
    )
    .join('')

const buildDoorCodeHtml = (doorCode) =>
  doorCode
    ? `
    <p style="font-size: 15px; color: #333; margin: 24px 0 8px; text-align: center;">Your door code</p>
    <div style="text-align: center; margin: 0 0 8px;">
      <span style="display: inline-block; font-size: 32px; font-weight: bold; letter-spacing: 6px; color: #2c3e50; background: #f0f4f8; padding: 12px 24px; border-radius: 8px;">
        ${escapeHtml(doorCode.code)}
      </span>
    </div>
    <p style="font-size: 14px; color: #666; text-align: center; margin: 12px 0 0;">Works ${escapeHtml(doorCode.window)}</p>`
    : `
    <p style="font-size: 14px; color: #666; text-align: center; margin: 24px 0 0;">Your door code is not ready yet. Please contact the club before your booking.</p>`

// A booking's receipt always has a door-code part (the code, or that it is
// not ready); a top-up's has none.
const buildNotesHtml = (notes) =>
  (notes || [])
    .map((note) => `
    <p style="font-size: 14px; color: #333; text-align: center; margin: 16px 0 0;">${escapeHtml(note)}</p>`)
    .join('')

export const buildReceiptHtml = (receipt) => `
  <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 24px;">
    <h2 style="color: #2185d0; text-align: center; margin: 0 0 4px;">${escapeHtml(receipt.title)}</h2>
    <p style="font-size: 14px; color: #666; text-align: center; margin: 0 0 20px;">Receipt</p>
    <table style="width: 100%; border-collapse: collapse; border-top: 1px solid #eee; border-bottom: 1px solid #eee;">
      ${buildReceiptRowsHtml(receipt.lines)}
    </table>
    ${'doorCode' in receipt ? buildDoorCodeHtml(receipt.doorCode) : ''}
    ${buildNotesHtml(receipt.notes)}
    <p style="font-size: 13px; color: #999; text-align: center; margin-top: 24px;">Keep this email for your records.</p>
  </div>
`
