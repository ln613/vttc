# Account Page

## Layout

Vertical

- shared header
- "{name} ({rating})" (h1, align left)
- collapsible sections, each a header row (arrow, title) that opens / closes it:
  - Profile Section (open by default)
  - Credits Section (closed)
  - My Bookings Section (closed)
- "Sign Out" button (hide in edit mode)

## Profile Section

- header row
  - "Profile"
  - action icons (align right, only while open), for anyone with a player record — including a player who is an admin or super admin. Hidden for the shared admin / super admin logins, which have no profile of their own (they edit other players' profiles)
    - read only mode: Edit Icon (enter edit mode)
    - edit mode: "Cancel" and "Save" icons (exit edit mode)
    - saving indicator (spinning circle, while saving)
- First Name input
- Last Name input
- Sex: dropdown ("Male", "Female")
- Birth Date: date picker
- Email input
- Phone input
- rating row (admin only)
  - Rating input
  - History button (align right)
- "Change Password" link (hide in edit mode; only for a player record, as the action icons)

### Interaction

- validate upon saving
  - email
  - phone (Canadian/US phone number)
  - rating (non-negative integer)
- confirm cancel
- click "Change Password": show "Change Password" dialog, where user enters and confirms the new password (password rules are defined in header.md)
- an account made with Google and no password shows "Set Password" instead: the same dialog, titled "Set Password", without the current password; once set, the user can also sign in with email and password, and the button becomes "Change Password"
- rating admin adjustment history (with date/time) should be kept in db
- before saving, if the new rating/birth date would render the player unqualified for any future events he has registered, ask the admin to confirm whether to remove the player from those events, if yes, remove the player from those events then save the rating, if no, do nothing
- rating admin adjustment will affect the player's rating in already registered future events. the rating change from match results (between player's registration time of the event and event start time) will not.
- rating history button will show a dialog of the rating admin adjustment history for this player
## Credits Section

Credit module (rules/modules.md), on the signed-in player's own account (not when an admin views someone else's, not for the admin or tablet logins, which have no player record).

- header: "Credits", and the balance "{credits} credits" at the right, so it shows while closed
- open: balance "{credits}" (large) "credits", "Top up" button (green): opens the Top up dialog (see rules/booking.md)
- under "Top up": "Top-up history" — the player's paid top-ups, newest first, each: when ("Oct 21, 2026, 3:27 PM"), "Paid $52.50 · Visa ending 6120" on the left; what was added ("+$50" / "+5,000 credits") and any reward points ("+200 points") on the right. Hidden until there is one; reloaded after a top-up
- points model (rules/wallet.md): titled "Balance", the balance in dollars ("$100"), and under "Top up":
  - "Reward points: {points}" and "Club ID: {club id}"
  - links "Rewards" (Rewards page) and "Redemption history" (Redemption History page)

## My Bookings Section

My Booking module, on the signed-in player's own account (as Credits).

- header: "My Bookings"
- loaded each time it is opened, not before
- open: the player's confirmed court bookings
  - "Upcoming": today and later, soonest first; "Past": most recent first
  - each booking (card): date ("Sun, Oct 4, 2026"), "{start} – {end} · {court}", "{credits} credits" (or "${amount}" when paid by card)
  - door code: "Door code" {code} "Works {from} – {to}"; once that has passed, "Expired" (dimmed)
  - an upcoming booking without a code: "Door code not ready yet. Please check back, or contact the club." (opening the section asks the server to try again — rules/booking.md, Door code)
  - "Receipt" link: shows / hides the receipt (the same lines as the email); one open at a time
  - no bookings: "You have no bookings yet."
  - "Book a Court" button: go to the Booking page

### Interaction

- `/account?open=myBookings` (the booking confirmation's "My Bookings" link) opens the page with only My Bookings open
