# Header Component

## Layout

- banner https://res.cloudinary.com/vttc/image/upload/v1767957616/banner.jpg
- Top bar (blue bg, white text)
  - Live score icon (for tablet, show Tablet)
  - "Umpire" button (green bg), next to the live score icon
    - publicly accessible — no sign in required
    - visible only when there is a match to umpire (a match on a table that
      has not finished)
    - not shown to an admin or super admin, who open Game Play from the match
      rows, nor to the tablet role, which has its own Tablet button
    - on click, show the Match Day Password dialog, then the table selection
      dialog; picking a table opens the Game Play page for it
  - Events: go to the Home/Events List page
  - Schedule: go to the schedule page
  - Players: go to the Players page
  - Setting Icon (align right, admin only)
  - Account Icon (align right)
    - if not signed in, show sign in dialog
    - if signed in, go to account page

## Match Day Password dialog

- header "Umpire a Match" (h2)
- note "Enter the match day password to score a match on any table."
- password input, "Match Day Password"
- "Cancel" (red) and "Continue" (green) buttons
- on continue: authenticate with the match day password. Anyone holding it can
  umpire
  - already signed in: keep the account. Scoring only needs a valid session,
    which they already have, so the password just unlocks umpiring
  - not signed in: no session is created and they are not logged in. They are
    simply let into the scoring page for that table. The site still treats
    them as a visitor, so on returning they see the Umpire button again and
    must enter the password again. Access ends when they leave the scoring
    page
- on failure, keep the dialog open and show the error

## Sign in dialog

- header "Sign in", (h1)
- email/phone input box
- password input box
- "Sign in" button (blue bg)
  - on click: call the Sign in API to sign the user in
- Google's "G" under it: the bare four-colour logo, no text, no circle or box around it — see "Sign in with Google" below
- "Sign up" link: go to the sign up dialog

## Sign in with Google

Offered in the sign in dialog and in step 1 of sign up, and only when the site has a Google client id (settings `googleClientId`); otherwise the icon is not shown.

- click the G: Google's popup opens; after the user picks a Google account it returns a one-time code, sent to Sign in with Google
- if it is already an account — linked to this Google account, or an account with the same email (which is then linked to it) — the user is signed in and the dialog closes
- otherwise the sign up wizard opens at step 4 with the email and the first/last name Google gave (still editable); steps 2 and 3 are skipped, since Google has proved the email
- a refusal (e.g. "Your Google email address is not verified") is shown under the icon

## Sign up dialog

A step-by-step wizard. Header "Sign up" (h1), then a progress row of 7 dots with "Step {n} of 7" under it. Each step has its own heading; Back (grey) returns to the previous screen the user actually saw, and the green button continues. Enter submits the step.

### Step 1: registration type

- heading "How would you like to sign up?"
- a row of bare icons, no text and no circle or box around them (like a "continue with" row): an envelope for email, then Google's "G" (see "Sign in with Google"). Each has its name as a tooltip ("Sign up with email", "Continue with Google")
- the envelope goes to step 2
- "Sign up with Phone" is not offered for now. The phone path (steps 2-3 by text message) is built and is switched on in one place, `OFFER_PHONE_SIGN_UP` in signUpStore; it also needs the site to be able to send texts (settings `smsEnabled`)

### Step 2: email or phone

- email: heading "What's your email?", email input
- phone: heading "What's your phone number?", phone input, note "Canadian or US number. We'll text you a code."
- "Send code" button
  - email must be valid; phone must be a valid Canadian/US number
  - calls Send verification code

### Step 3: verification code

- if the email/phone already belongs to an account, no code is sent. Show heading "You already have an account", the msg "{email/phone} is already signed up. Please sign in instead.", and a "Sign in" button that opens the sign in dialog with the email/phone filled in
- otherwise heading "Enter the code", msg "We sent a 6-digit code to {email/phone}.", code input, "Verify" button
  - "Resend code" link, with a 60 seconds countdown ("Resend code in {n}s") before it can be used again
  - going Back and continuing with the same email/phone returns to this step without sending another code
  - a correct code moves to step 4; after that there is no Back to steps 1-3 (closing the dialog starts over)

### Step 4: name

- heading "What's your name?", first name and last name inputs, "Continue"
- look up players on file with a similar name (see Find similar players). If there are any, show:
  - heading "Is one of these you?", msg "We found players with a similar name. If one is you, select it so your results and rating stay with you."
  - one row per player: name, sex and rating ("Unrated" when 0); pre-select it if there is only one
  - "This is me" (enabled when one is selected) signs up as that player
  - "None of these is me — I'm new" link creates a new player
- otherwise go straight on as a new player

### Step 5: sex

- heading "Male or female?", note "Used to enter men's and women's events."
- "Male" and "Female" choices; choosing one continues
- skipped when the player chosen in step 4 already has a sex on file

### Step 6: date of birth

- heading "Date of birth", note "Optional — only needed to enter age-restricted events."
- three dropdowns: Year (this year back 100 years), Month (Jan-Dec), Day (only the days that month has; a day that no longer exists after changing the month is cleared)
- "Continue": all three chosen, or none; a partly chosen date shows "Choose the year, month and day — or skip"; a future date is refused
- "Skip for now" link continues without a date
- skipped when the player chosen in step 4 already has a date of birth on file

### Step 7: password

- heading "Create a password", password input with the password rules under it
- after Google: heading "Create a password (optional)", note "You'll sign in with Google. A password also lets you sign in with your email and password." — left empty, the account signs in with Google only; typed, it must meet the rules
  - at least 8 characters
  - contains at least 1 number
  - contains at least 1 uppercase
  - contains at least 1 lowercase
- "Sign up" button: calls Sign up, which signs the user in
  - if the player has no rating yet, show the msg: "Contact {club} to get an initial rating before you can register for rating-restricted events."
  - otherwise close the dialog

### Interactions

- "Already have an account? Sign in" link under steps 1-3, going to the sign in dialog
- names are saved in title case
- a player chosen in step 4 keeps the name, sex and date of birth already on file; only what is missing is filled in
- after sign in, if the player account is pending, show a msg telling the player to change their password after initial sign in, and take them to the account page upon confirm
- on click Tablet (tablet only):
  - show the table selection dialog, upon selection, go to game play page for that table
  - show all tables, whether there is a match assigned or not