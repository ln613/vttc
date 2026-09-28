# Account APIs

## Sign in

### input

- email/phone
- password

### Prerequisite

- email/phone is either
  - admin username, or
  - email/phone exist in db (players table, matching email or phone)

### Action

- if admin, check admin password
- otherwise, find the account with that email/phone (a phone matches however it is typed: "604-555-1234", "(604) 555 1234" and "6045551234" are the same number)
- if the account has no password but is linked to Google, error "This account signs in with Google"
- if password matchs
  - generate token
- otherwise, error

### Output

return the token or error message. The player carries `hasPassword`, false for a Google account with no password (the Account page then offers "Set Password").

## Sign in with Google

### input

- code* (the one-time code Google's sign-in popup gives the browser)

### Prerequisite

- the site has a Google client id and secret, as a pair: GOOGLE_CLIENT_ID + GOOGLE_CLIENT_SECRET, or else the shared GMAIL_1_CLIENT_ID + GMAIL_1_CLIENT_SECRET. The client is an OAuth "Web application" whose Authorized JavaScript origins include the site
- the code is exchanged with Google (client secret, redirect_uri "postmessage") for an ID token, which must be signed by Google (checked against Google's published keys), issued to this client id, by accounts.google.com, and not expired
- the Google email is verified (email_verified), otherwise error "Your Google email address is not verified"

### Action

- a player already linked to this Google account (googleId): sign in
- otherwise an account with the same email: link it to this Google account (set googleId) and sign in. If it is already linked to a different Google account, error
- otherwise: nothing is saved yet; issue a verification token for the email, carrying the Google account id

### Output

- signed in: { signedIn: true, token, isAdmin, isSuperAdmin, player } (as Sign in)
- new: { needsSignUp: true, verificationToken, email, firstName, lastName } — the sign up wizard continues at step 4

## Sign up flow

Sign up is the wizard in the Sign up dialog (specs/shared/header.md). Proving the email or phone happens first, and produces a verification token; Sign up only accepts an email/phone that comes from such a token.

An account is a player someone can sign in as: one with a password, or one linked to a Google account (googleId), which may have no password. Wherever "already an account" is checked, both count.

Addresses:

- email: trimmed; compared without regard to case
- phone: Canadian/US only, stored as its 10 digits ("6045551234")

## Send verification code

### input

- channel* ("email" or "phone")
- to* (the email or phone)

### Prerequisite

- channel is "email", or "phone" when the site can send texts (TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN and TWILIO_VERIFY_SERVICE_SID are set)
- to is a valid email / Canadian or US phone number
- no code sent to this address in the last 60 seconds, and fewer than 10 in the last 24 hours

### Action

- if a player with a password already has this email/phone, send nothing
- otherwise send a 6-digit code, valid for 10 minutes
  - email: generated and stored (hashed) in the verifications table, and emailed
  - phone: generated, texted and checked by Twilio Verify

### Output

- { accountExists: true } when the address is already an account
- otherwise { sent: true, resendIn: 60 }

## Verify code

### input

- channel*
- to*
- code*

### Action

- check the code; an email code is single use, and is locked after 5 wrong tries
- if right, issue a verification token naming the channel and address, valid for 30 minutes. It is not a sign-in token and grants no access

### Output

{ verificationToken } or error message

## Find similar players

### input

- firstName*
- lastName*

### Action

- players without an account whose name is similar: same family name, and the same given name or the same first word of it — ignoring case, accents, punctuation and spacing, and also with first and last name swapped
- at most 20, sorted by name

### Output

[{ _id, firstName, lastName, sex, rating, hasDateOfBirth }] — nothing that the public players list does not already show, except whether a date of birth is on file

## Sign up

### input

- verificationToken*
- firstName*
- lastName*
- password* (optional when the verification token came from Google)
- playerId (sign up as this player already on file)
- sex ("M" or "F")
- dateOfBirth ("YYYY-MM-DD")

### Prerequisite

- the verification token is valid and not expired
- no player with a password already has that email/phone
- password meets the password rules
- dateOfBirth, if given, is a real date, not in the future

### Action

- the email/phone comes from the token, never from the input
- a token from Google also links the account to that Google account (googleId); that Google account must not already be signed up
- if playerId: that player must exist, have no account, and not be flagged admin. Set the email/phone and password; keep the name, sex and date of birth on file, filling in sex and date of birth only if missing
- otherwise, if a player without an account already has this email/phone: that player becomes the account, with the typed name (title case)
- otherwise create a new player (title case name, rating 0)

### Output

{ token, isAdmin: false, isSuperAdmin: false, needsRating, player } — needsRating is true when the player has no rating yet

## Update profile / Change password

- both take the player's _id in the input, and only for the caller: a player may change their own profile and password; an admin may change any player's profile (not their password). Otherwise error "You can only change your own account" / "You can only change your own password"
- update profile refuses an email or phone that another account already uses
- change password: the current password is required only when the account has one (and is not pending), so a Google account with no password can set its first one
