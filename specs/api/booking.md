# Booking APIs

All refuse with "Court booking is not available at this club" unless `booking.enabled`. Rules in rules/booking.md.

## Booking day (GET bookingDay, public)

### input

- date* (YYYY-MM-DD)

### Action

- free any guest holds that ran out

### Output

{ date, today (club date), nowMinutes (club time), courts, openTime, closeTime (the admin setting), paymentsAvailable, bookings: [{ _id, court, start, minutes, mine, name (owner or admin only) }] } — confirmed bookings and guest holds still being paid

## My bookings (GET myBookings, signed in)

the player's confirmed bookings, newest first: [{ _id, date, court, start, minutes, credits, createdAt, doorCode: { code, validFrom, validUntil, window } | null, receipt: { title, ref, lines: [{ label, value }] } }]

- first asks UniFi for a code for any booking still to come that has none (rules/booking.md, Door code)

## My credits (GET myCredits, signed in)

{ credits, paymentsAvailable }

## Book with credits (POST bookCourt, signed in)

### input

- date*, court*, start* (minutes from midnight), minutes*

### Action

- validate the time (rules/booking.md); claim each half hour; take the credits if the balance covers them, otherwise release the time
- write the ledger entry

- then the door code and the receipt email (rules/booking.md)

### Output

{ bookingId, date, court, start, minutes, credits, balance, doorCode | null, receiptSentTo | null }

## Book as a guest (POST bookCourtAsGuest, public)

### input

- date*, court*, start*, minutes*, firstName*, lastName*, email*, phone*

### Action

- hold the time for 15 minutes; create a pending card payment

### Output

{ bookingId, paymentId, amountCents, heldUntil, paymentsAvailable }

## Top up (POST topUpCredits, signed in)

### input

- dollars* (whole, at least the minimum)

### Output

{ paymentId, amountCents, credits, paymentsAvailable } — a pending payment

## Confirm payment (POST confirmPayment, public)

The Stripe placeholder: only with PAYMENTS_MODE=placeholder. Once Stripe is connected, a Stripe webhook takes its place.

### input

- paymentId*

### Action

- the payment must be pending; a top-up must belong to the signed-in player; a guest hold must not have run out
- mark it paid, then confirm the guest's booking, or add the credits (and a ledger entry)

### Output

guest booking (then the door code and the receipt email): { kind, ok, booking: { date, court, start, minutes }, doorCode | null, receiptSentTo | null }; top-up: { kind, ok, balance }
