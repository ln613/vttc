# Setting Page

Admin only, show empty page for non-admin.

## Layout

Vertical

- shared header
- title row
  - "Settings" (h3, align left)
  - action icons (align right)
    - read only mode: Edit Icon (enter edit mode)
    - edit mode: "Cancel" and "Save" icons (exit edit mode)
    - saving indicator (spinning circle, while saving)
- Event Setting Section (Tournament module)
- Court Booking Section (Booking module)
- Court Prices Section (Booking module)
- Rewards Section (points model and Credit module — rules/wallet.md)
- Revenue Section (Tournament module)
- Modules Section (super admin only): link to the Modules page

## Event Setting Section

- checkbox: "Ignore unpaid players when generating groups, RR or first round knockout if no group stage", default checked. If unchecked, include the unpaid players.
- checkbox: "Save Umpire Info", default from the club config's
  `saveUmpireInfo` (absent = off). Records who umpired each match and lets
  umpires be assigned to tables for the day. When on, a number field "Max
  umpires on a table" appears, defaulting to `maxUmpiresPerTable`. See
  `specs/rules/umpires.md`.
- checkbox: "Enable Tablet Mirror", defaulting to the club config's
  `tabletMirrorEnabled`. When checked, a table can be run by two tablets —
  one facing the umpire, one facing the players. The value is copied onto
  each event when that event starts, so changing it affects every event
  that has not started yet. See `specs/rules/tablet mirror.md`.

### Interaction

- on save click: save the settings to db

## Court Booking Section

- "Opens at" dropdown: every half hour, 12:00 AM to 11:00 PM
- "Closes at" dropdown: from an hour after opening to "12:00 AM (midnight)"
- defaults from the club config's `booking.openTime` / `booking.closeTime` (8:00 AM to midnight for Timing Sports)
- a later opening that leaves closing too soon moves closing with it
- validated on save: half-hour times, closing at least the minimum booking length after opening. See `specs/rules/booking.md`

## Court Prices Section

Saved on its own ("Save price"), not with the page's Edit/Save. See rules/booking.md, Price.

- "Weekly prices": the days (Mon – Thu, Fri – Sun…), each time range and "$30/hr" — as the Pricing page shows them
- "One-time prices (promotions)": those still to come, soonest first: date ("Sat, Oct 24"), time range, "$25/hr", and "×" to remove it (circle button)
- "Set a price":
  - a switch "Weekly [switch] One-time" (weekly by default)
  - weekly: a checkbox for each day, Mon to Sun
  - one-time: "Date" (date picker)
  - "From" dropdown: every half hour from opening to the last half hour before closing; "To": from half an hour after From to closing ("12:00 AM (midnight)"). A later From moves To with it. Both start at the opening hours
  - "Hourly rate ($)"
  - "Save price": checked first (at least one day, a date not past, To after From, within the opening hours, a price), then saved; "Price saved. Booking and the Pricing page now use it."

## Rewards Section

- "Top-up amounts — What members can top up, and the reward points each gives."
- a row per amount: "Amount ($)" and "Reward points" (edited with the page's Edit/Save; "×" removes a row, "+ Add amount" adds one)
- validated on save (rules/wallet.md, "Top up")
- links: "Gifts" (Gifts page), "Redemption History" (every member's)

## Umpire Section

- shown only when "Save Umpire Info" is on
- link to the Umpires page (admin only) — see `specs/rules/umpires.md`

## Revenue Section

- link to revenue page
- link to revenue calculator page
- admin only

## Update Section

- Update Rating button
- shown only when the club config sets `enableUpdateRating`. Absent =
  hidden, because `rating.js` carries VTTC's rating tables: running it for
  a club that has not opted in would rate their players against rules that
  are not theirs. The endpoint refuses on the same test, so hiding the
  button is a courtesy rather than the whole control