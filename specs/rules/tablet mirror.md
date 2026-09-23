# Tablet Mirror

A table may be run by two tablets instead of one: a **Scorer** facing the
umpire, and a **Mirror** facing the players. Both show the same match; only
the Scorer is touched. The point of the Mirror is that the players see the
score the right way round without the umpire having to turn the tablet.

Off by default. When off, nothing about scoring changes.

## The settings

Both live on the Setting page and are club-wide.

### Allow Public Umpire

Whether the match-day password lets someone without an account score a
match at all. Its default comes from `allowPublicUmpire` in the club config
(absent = allowed, which is how the app behaved before the setting
existed). Turning it off hides the Umpire button and refuses the password
server-side — hiding the button is a courtesy, refusing the password is the
rule.

### Enable Tablet Mirror

- "Enable Tablet Mirror", on the Setting page, club-wide
- its default comes from the club config file, `tabletMirrorEnabled` in
  `clubs/<slug>/config.json` (absent = false)
- **the setting applies to every event that has not started yet**, however
  long ago it was created. It is settled per event the moment that event
  starts, and fixed from then on: an admin can change their mind right up
  to the first match, but once play is under way the event does not change
  shape beneath the tablets running it. Turning it on mid-tournament does
  not affect a table already scoring, and turning it off does not strand a
  pair already paired

Whether a given table runs a pair is answered from the event document
itself when a tablet takes its session, and remembered on that session.
Never from live-score data, which is a cache and can be a rebuild behind — a
stale "no" there would quietly close a table to its second tablet.

## Entries to a table

An "entry" is one device opening one table's match. With mirror off there
is one entry per table, exactly as before. With it on there are two, one
per role. The first tablet on an empty table is asked to choose: "Scorer
(Umpire-facing)" or "Mirror (Player-facing)".

**Only a tablet can be the Mirror**, and only a tablet can feed one. An
admin or a public umpire is a person who arrived with their own device;
they cannot send a Mirror anything, so they take the table whole and any
Mirror already there is displaced with the rest. Leaving it would leave a
screen in front of the players showing a match nobody is sending it.

| Already on the table | Tablet | Public umpire | Admin |
| --- | --- | --- | --- |
| nobody | asked which role | Scorer | Scorer |
| a Mirror | Scorer | Scorer, Mirror displaced | Scorer, Mirror displaced |
| a Scorer (tablet) | Mirror | refused | Scorer, taking over both |
| a Scorer (not a tablet) | refused | refused | Scorer, taking over |
| both | refused | refused | Scorer, taking over both |

Taking over a Scorer is an admin's privilege; a public umpire arriving at
an occupied table is turned away, exactly as before pairing existed.

The table picker greys out a table this device could not take, rather than
letting it be chosen and refused on arrival — so the answer above is given
before the table is picked, not after. "Could not" differs by who is
asking: a tablet is stopped only by a full table, while anyone who can only
be a Scorer is stopped by the Scorer seat being taken.

Once a role is held:

- a tablet coming back after a reload takes its own role back, with no
  dialog. Both tablets sign in as the same club account, so it is the
  device that tells them apart, not the account
- a role belongs to the tablet's place at the table, not to one match. When
  a match finishes and the next is assigned to the table, both tablets keep
  the roles they had — nobody is asked again
- leaving the scoring page forgets it, however the tablet leaves. Coming
  back to the table is a fresh entry and is asked again

## Which side is on the left

- Mirror: unchanged from a single tablet today — side 1 on the left when
  `leftSide` is 1
- Scorer **tablet**: mirrored, because it is mounted facing the other way
- an admin or public umpire in the Scorer seat: unchanged. They are holding
  their own device, not a screen mounted at one end of the table, so they
  keep the view they have always had

This is a property of the device, not of the match. `leftSide` stays one
value, shared and persisted as now; only the rendering of it differs. Both
devices therefore stay consistent through an end-of-game side switch with
nothing extra to keep in step.

## A Mirror that arrives first

The Mirror is never the device that sets a match up, so it is never shown
the serving side / left side / team order screen — not even when it is the
first tablet on the table. It goes straight to the score boxes.

It shows those boxes **empty until the umpire presses Start**: no names, no
ends, no serve. Nothing the Scorer sends before Start is applied at all —
while the umpire is still on the setup screen its idea of which side is
left swings about with every tap, and mirroring that would have the players
watching the board flip under them before the match had begun.

Everything appears at once the moment the Scorer starts the match — or
immediately, if it was already under way when the Mirror joined.

## Mirror is display-only

The Mirror never writes, and shows nothing that could be pressed to change
the match: no `+` / `−`, no timeout toggle, no Next Game / Finish button,
and a hamburger menu with only Exit on it. It never calls `updateGame`,
`finishMatch` or any other mutation. Everything it shows comes from the
Scorer, including the end of a game — the result appears, the button to act
on it does not.

## How the two stay in step

The Scorer publishes its whole scoring state to the Mirror as a **Pusher
client event** — device to device, through Pusher, without touching the
API. No Netlify invocation, no database read or write, and no broadcast to
anyone else on the site.

- channel: `presence-table-{tableNumber}`, so each device knows whether the
  other is there
- `client-state`, Scorer to Mirror, on every change: a whole snapshot, not a
  delta, so a Mirror that joins late or reloads is correct immediately and
  a dropped message costs nothing
- `client-hello`, Mirror to Scorer, on join: the Scorer answers with a
  snapshot
- the Scorer only publishes while a Mirror is present on the channel

Persistence is unchanged: the Scorer saves to the database on the same
debounce as a single tablet does today.

### Failure

- no Pusher configured, or the pair breaks: the Mirror says it has lost the
  Scorer and shows nothing more. It never falls back to writing
- the Scorer going away does not promote the Mirror. A Mirror that should
  take over is closed and re-opened, taking the free Scorer role
- the match session already expires after 5 minutes of silence, which
  releases an abandoned role

## Load

The design adds nothing per point to any metered service:

| | added per point |
| --- | --- |
| Netlify invocations | 0 |
| MongoDB reads/writes | 0 |
| Pusher messages | 1 client event, only while a Mirror is listening |
| Pusher connections | +1 per Mirror, for as long as it is open |

Connections are the binding constraint on the Pusher free tier (100
concurrent), not messages.

## Needs a human

Pusher client events are **disabled by default** and are enabled per app in
the Pusher dashboard — there is no API for it. A club whose Pusher app has
not had them enabled cannot use this feature; the Mirror will simply never
receive anything.
