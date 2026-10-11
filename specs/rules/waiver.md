# Liability Waiver Rules

A club can require every member to accept a liability waiver before they use their account. Shared rules: shared/rules/waiver.js.

## Configuration

In the club config:

```json
"liabilityWaiver": { "required": true, "version": "2026-10-11" }
```

- absent, or `required` false: no waiver; nothing below happens
- the text is in `clubs/<slug>/waiver.json`, per language (`en`, `zh`): `title`, `intro`, `sections` (each `heading` and `body`) and `agree` (the checkbox sentence). Shown in the current language, English when the club hasn't written it in that one
- changing `version` asks every member to accept again (the new text)
- Timing Sports requires one: assumption of risk, health and fitness, release of liability, indemnity, personal property (lost, stolen or damaged), facility rules and conduct, medical treatment, minors (under 19: a parent or guardian accepts) and governing law (British Columbia)

## When it is shown

Whenever a member with a player record is signed in and hasn't accepted the current version — so straight after signing up, signing in (password or Google), and on opening the app. Not for the admin or tablet logins, which have no player behind them.

## The waiver

Over everything, in the club's site look (as the other dialogs):

- the title, the intro, and the sections in a scrolling box
- a checkbox with the `agree` sentence
- "Accept and continue": disabled until the checkbox is ticked
- "I don't agree — sign out": signs the member out
- it cannot be closed any other way (clicking outside or Escape does nothing)

## Accepting

- POST acceptWaiver { version } (signed in): refused if `version` is not the current one ("The waiver has changed. Please read the new version.")
- saved on the player: `waiver: { version, acceptedAt }` (the date and time), and appended to `waiverHistory`
- GET myWaiver (signed in): { required, version, accepted, acceptedAt }

## Guests

A guest booking without an account accepts the waiver in the booking dialog, after their details and before the time is held for payment: the waiver, its checkbox, "Back" and "Accept and continue" (disabled until ticked). Each booking is accepted for on its own. A signed-in member booking by card has already accepted, so isn't asked again.

- bookCourtAsGuest takes `waiverVersion`: refused without it ("Please accept the liability waiver first", and nothing is held) or with an old one ("The waiver has changed…")

## On the booking and the receipt

Every booking at a club with a waiver keeps the acceptance it was made under (`waiver: { version, acceptedAt }`: the member's, or the guest's). The receipt — emailed, and in My Bookings — has a line "Liability waiver: Accepted {date, time} (version {version})".

## Enforced by the server

Booking with the balance (bookCourt) and topping up (topUpCredits) are refused until the member has accepted the current version: "Please accept the liability waiver first".
