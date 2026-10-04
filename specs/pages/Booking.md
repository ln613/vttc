# Booking Page

Route `/booking`. Calendar module (rules/modules.md). See rules/booking.md.

## Layout

Vertical

- shared header
- "Book a Court" (h1, align left)
- "Open {open} – {close}. Bookings start on the half hour, {min} minimum."
- signed-in player: "Your credits: {balance}" and "Top up" button
- week strip
  - previous week arrow (disabled on the current week; no past days)
  - 7 day buttons: weekday ("Today" for today), day number, month; the selected day is highlighted
  - next week arrow
- the day (card)
  - long date ("Sunday, October 4")
  - a row per half hour from opening to the last half hour before closing (8:00 AM to 11:30 PM by default), time on the left — the hours come from the admin setting, with the day
  - with more than one court, one column per court with its name on top
  - a booking is one block spanning its length: "Your booking" (blue) or "Booked" (gray; an admin sees the name), with its time range
  - a free half hour that can start a booking: "Available" (green), clickable
  - a past half hour, or one too close to closing to start a booking: gray, not clickable
  - legend: Available, Your booking, Booked

## Booking dialog

- "Book {court}" (h2), the date and time range (updates with the length)
- details step
  - "Length" dropdown, one option per allowed length with its time range: "3 hours (4:30pm to 7:30pm)"; 1 hour selected
  - signed-in player, Credit module on:
    - "Cost" {credits} credits, "Your balance: {balance} credits"
    - not enough: "Not enough credits. Top up to book this time." and "Top up" instead of "Book"
    - "Cancel", "Book"
  - otherwise:
    - "Price" ${dollars}
    - not signed in: "Have an account? Sign in to book with credits." (Sign in closes the dialog and opens the sign-in dialog)
    - "Cancel", "Book as guest" ("Pay by card" for a signed-in player — Credit off — whose name, email and phone are filled in)
- guest step: First Name, Last Name, Email, Phone (all required), "Back", "Continue to payment"
- payment step: "We're holding this time for you until {time}.", then the payment placeholder (rules/booking.md), "Back", "Simulate payment" (placeholder mode only)
- done: "You're booked!"
  - the door code, large, with "Works {from} – {to}" (15 minutes before to 15 minutes after the booking)
  - no code: player "Your door code isn't ready yet. It will appear in My Bookings."; guest "... Please contact the club before your booking."
  - a player: "{n} credits used. Your balance is {balance} credits."
  - "A receipt has been sent to {email}." (when it was)
  - a player: "Your code and receipt are always in My Bookings." (link: the Account page with My Bookings open)
  - "Done"

### Interaction

- the club's today decides the first day, not the browser's date
- choosing a length never offers more than fits before closing or the next booking
- top up from the dialog opens the Top up dialog on top; once paid, the dialog shows "Book"
- after a booking, a guest hold or a failed booking, the day is reloaded
- signing in or out while on the page reloads the balance
- validate the guest form: first name, last name, email, phone (Canadian/US)

## Top up dialog

Shared with the Account page.

- "Top up credits" (h2)
- "$1 = 100 credits. Minimum $10."
- "Amount ($)" input (whole dollars), "You get {credits} credits"
- "Cancel", "Continue": under $10 → "Top up at least $10, in whole dollars"
- payment placeholder
- done: "{credits} credits added. Your balance is {balance} credits." "Done"
