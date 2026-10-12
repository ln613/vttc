# Module Rules

A club turns on only the parts of the app it uses. A super admin sets them on the Modules page (specs/pages/Modules.md). Shared rules: shared/rules/modules.js.

## Modules

- Tournament
  - Events*
  - Players*
  - Game Play*
  - Live Score
  - Schedule
- Booking
  - Calendar
- Account*
  - Profile*
  - Credit
  - My Booking (* on Booking, only with Booking)

\* cannot be turned off. "* on X": cannot be turned off while X is on. "only with X": in effect only while X is on — Booking off turns My Booking off too (the Account page's My Bookings section goes), keeping its setting for when Booking comes back.

- a second-level module is in effect only while its first-level module is on: Tournament off turns off Events, Players, Game Play, Live Score and Schedule, keeping what each was set to for when Tournament comes back
- before a super admin saves anything: all on, except Booking, which follows the club config (`booking.enabled`)
- saved in the `settings` collection (`docId: "modules"`); read by everyone (`GET modules`), saved only by a super admin (`POST saveModules`). Whatever is sent, the locks are applied before saving

## What a module covers

- Events: the Events link and the event, tournament and revenue pages; "/" is the event list
- Players: the Players link, the Players page and player history
- Game Play: the tablet's "Tablet" button, the "Umpire" button, the Game Play and Umpires pages
- Live Score: the live score button and page
- Schedule: the Schedule link and page (leaving Game Play goes home instead)
- Calendar: the Booking link and page
- Credit: balances, top-ups and paying for a booking with credits — the Account page's Credits section and the Booking page's balance line. On the points model (rules/wallet.md) also the reward points and gifts: the Rewards, Redemption History and Gifts pages, and the Settings page's Rewards section. With Credit off, a signed-in player books like a guest (pays by card), with their own name, email and phone filled in; the booking is still theirs (on the calendar and in My Booking)
- My Booking: the Account page's My Bookings section, and the booking confirmation's link to it
- Settings page: Event Setting, Umpires, Revenue and Update follow Tournament (Umpires: Game Play); Court Booking follows Booking

A page whose module is off shows "Not available — This part of the site is turned off at this club." with a link home. Home ("/") is the event list; without Events, the booking calendar; without that, the Account page.

The server refuses booking endpoints whose module is off ("This feature is turned off at this club"): the day (Booking + Calendar), booking with credits (+ Credit), booking as a guest (Booking + Calendar), top-up and balance (Credit), My Booking (My Booking). Tournament modules are hidden in the app only; their endpoints are unchanged.

The browser remembers the last switches it saw, so links don't flash on before the server's answer arrives.
