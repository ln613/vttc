# Header Component

## Layout

- banner https://res.cloudinary.com/vttc/image/upload/v1767957616/banner.jpg
- Top bar (blue bg, white text)
  - Live score icon
  - Events: go to the Home/Events List page
  - Players: go to the Players page
  - Account Icon (align right)
    - if not signed in, show sign in dialog
    - if signed in, go to account page

## Sign in dialog

- header "Sign in", (h1)
- email/phone input box
- password input box
- "Sign in" button (blue bg)
  - on click: call the Sign in API to sign the user in
- "Sign up" link: go to the sign up dialog

## Sign up dialog

- header "Sign up", (h1)
- checkbox "Existing Player"
- if checked, show players dropdown
  - name and rating
  - sorted by name
- first name input
- last name input
- sex: dropdown ("Male", "Female")
- email input
- "Send verification code" link (60 seconds countdown before resend)
- verification code input (verify button, align right)
- phone input
- date of birth: date picker
  - optional, but show the notes "Date of birth is required if you want to register for age-restricted events"
- password input
- "Sign up" button (green bg)
  - on click: call the Sign in API to sign the user in
- "Sign in" link: go to the sign in dialog

### Interactions

- if selected player already signed up, show msg "You already signed up, please sign in."
- first name and last name disabled when "Existing Player" is checked, and auto fill when a player is selected
- if the selected player has email, then auto fill email input 
- password rules
  - at least 8 characters
  - contains at least 1 number
  - contains at least 1 uppercase
  - contains at least 1 lowercase
- disable "Send verification code" link and verification code input when email is empty or invalid
- after verification code verified successfully
  - hide "Send verification code" link and verification code input
  - mark the email as verified (show a green checkmark inside the email input, right aligned)
- phone should be valid canadian/us phone number
- Sign up button only enabled when
  - first name not empty
  - last name not empty
  - email valid and verified
  - phone empty or valid
  - password valid