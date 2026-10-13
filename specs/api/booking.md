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

{ credits, points, paymentsAvailable } — `points`: reward points (points model, rules/wallet.md), 0 otherwise

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

- dollars* — credits model: whole, at least the minimum; points model: one of the amounts on offer (rules/wallet.md)

### Output

{ paymentId, amountCents, credits, points, paymentsAvailable } — a pending payment; `points` the reward points it will give (0 on the credits model)

Book as guest and Top up also return `checkout`: how the browser takes the card — { provider: "moneris", ticket, environment: "qa" | "prod", scriptUrl } (Moneris's card form), { provider: "placeholder" } (PAYMENTS_MODE=placeholder), or { provider: "none" }. Both take an optional `language` for the card form.

## Confirm payment (POST confirmPayment, public)

Called when the card form reports it finished (or the placeholder's button).

### input

- paymentId*

### Action

- the payment must be pending; a top-up must belong to the signed-in player
- the placeholder: a guest hold must not have run out
- Moneris: the receipt is fetched from Moneris and must be approved, for the payment's order number and exact amount; otherwise the reason is returned ("The card was declined. Please try again.") and the payment stays pending
- mark it paid (with the receipt's approval code, reference, card type, last 4), then confirm the guest's booking, or add the credits (and a ledger entry). A guest booking paid after its hold ran out keeps its time if it is still free; if not, the payment is flagged `refundDue` and the reason returned (rules/booking.md)

### Output

guest booking (then the door code and the receipt email): { kind, ok, booking: { date, court, start, minutes }, doorCode | null, receiptSentTo | null }; top-up: { kind, ok, balance, points? } — `points`, the member's reward points after, when the top-up gave some

## Renew payment ticket (POST renewPaymentTicket, public)

A fresh Moneris card form for a pending payment, after a decline or a form that failed or expired.

- input: paymentId*, language
- the same checks as Confirm payment (pending; a top-up only its own player's; a guest hold not run out)
- output: { paymentId, checkout } with a new ticket and order number

# Reward APIs

Points model only (rules/wallet.md), with the Credit module; otherwise "Rewards are not available at this club".

## Gifts (GET gifts, public)

[{ _id, name, description, image, points }], fewest points first

## Save gift (POST saveGift, admin)

- input: _id (to update), name*, description, image (data URL or https URL), points*
- output: the gift

## Delete gift (POST deleteGift, admin)

- input: _id* — hides the gift; output { success }

## Members (GET rewardMembers, admin)

[{ _id, name, clubId, points }] — members with an account (or with points), by name

## Redeem (POST redeemGift, admin)

- input: giftId*, playerId*, quantity* (1–99)
- output: { redemption, points } — the member's points after

## My redemptions (GET myRedemptions, signed in)

{ points, redemptions: [{ _id, playerId, playerName, clubId, giftName, giftPoints, quantity, points, pointsAfter, redeemedBy, createdAt }] }, newest first

## Redemptions (GET redemptions, admin)

every member's redemptions (same fields), newest first, the latest 500
