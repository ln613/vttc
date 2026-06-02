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
