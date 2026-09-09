# TODO

Things that are known and not done. Performance analysis and its backlog
live in `PERFORMANCE-BACKLOG.md`; this file is for what has to be *acted*
on — configuration to set, work half-finished, and bugs still open.

Written 2026-09-09.

---

## Before the next deploy

**Deploys are blocked.** The billing cycle closed at 1,011.9 / 1,000 credits
and only operational credits remain, which keep published sites online but
cannot be spent on deploys. The cycle resets **2026-09-12**. Nineteen
commits are queued locally and unpushed.

Remember one push deploys **both** `vttc-live` and `vttc-live-qa`, at 15
credits each, so batch rather than pushing one commit at a time.

### 1. Set `AUTH_SECRET` on each Netlify site

Sign-in tokens are now signed so the server can verify them
(`netlify/functions/utils/authToken.js`). The signing key is:

    AUTH_SECRET  →  SUPER_ADMIN_HASH  →  ADMIN_PASSWORD

Nothing sets `AUTH_SECRET` today, so it is silently falling back to
`SUPER_ADMIN_HASH`. That works, but it ties every session to a password
hash: change the super-admin password and everyone is signed out.

Set a long random value per site (they need not match across clubs):

    openssl rand -hex 32

### 2. Expect everyone to be signed out once

Tokens issued before this change carry no signature and cannot verify, so
after the deploy every client reads as anonymous until it signs in again.
Nothing errors — public reads keep working — but admins lose admin-only
data (the Players page shows blank email/phone) until they re-enter the
password.

### 3. Reload the tablets

A deploy swaps the bundle, but a tablet already sitting on a game-play
screen keeps running the old JS until it is reloaded. Refresh them before
the first matches.

---

## Security

### Rotate the exposed password hashes — not done

Until 2026-09-09 the public, unauthenticated `type=events` response
included **153 argon2 password hashes**, plus 162 emails, phone numbers and
dates of birth, for as long as the site had been live. The data has been
removed (`scripts/trim-embedded-players.mjs`, run against production), but
removal does not undo the exposure. Anyone who fetched that endpoint has
them.

Backup of the pre-migration documents, should anything need recovering:
`~/Desktop/vttc-backups/prod-events-before-trim-20260909T191323Z.json`

### Endpoint access — done, but read the rollout note

All 60 endpoints are classified in
`netlify/functions/utils/accessPolicy.js` as PUBLIC, USER or ADMIN, and
`api.js` enforces it. An endpoint with no policy is refused outright, so a
new handler cannot arrive unprotected by omission.

**Rollout:** every device must sign in again after this deploys —
pre-signing tokens cannot verify, and scoring now needs a valid one. The
client drops its stored session on a 401 so it asks rather than failing
silently, but a tablet left signed in on the old build will stop being able
to score until someone signs it in. **Sign in every tablet before the first
match.**

Still open: authorisation is role-level, not object-level. A signed-in
player can call `updateProfile` or `changePassword` — nothing yet checks
that the id in the body is *their own*. Worth a pass.

### Take reset out of the Game Play menu, then make `resetMatch` ADMIN

The menu (`src/pages/GamePlay.tsx`, the dropdown around line 528) offers
**Reset Game** and **Reset Match** to whoever is umpiring — which includes
a player umpiring their own match. Reset Game is client-side only, but
Reset Match calls `resetWholeMatch`, which posts `resetMatch` and wipes the
result server-side.

That is the only reason `resetMatch` is classified USER in
`accessPolicy.js`. Resetting is otherwise an admin action: the same control
on the Event Detail match row is gated behind `authState.isAdmin`, so today
the same operation needs an admin from one screen and nobody in particular
from another.

Two steps, in order:

1. Remove both reset items from the Game Play menu, leaving Exit. Admins
   keep the reset controls they already have on the Event Detail row.
2. Change `resetMatch` from `USER` to `ADMIN` in `accessPolicy.js`.

Doing them the other way round would leave a menu item that fails for
every non-admin umpire. Check whether anything else reaches
`resetWholeMatch` or `resetCurrentGame` before removing them.

### `dateOfBirth` still ships in event payloads

By design it stays *stored* — the age limits on registration and on the
draw read it off the embedded snapshot — but it should not be *sent*. The
sanitiser that strips it (`embeddedPlayers.js`, `PUBLIC_PLAYER_FIELDS`) is
committed and unshipped, so production still exposes 50 real dates of birth
until the deploy.

---

## Multi-club: what's left

The club is configuration now (`clubs/<slug>/config.json`, selected by
`CLUB`), covering branding, timezone, hall layout and tier rules. Still
outstanding:

- **GVTTC's table preferences and tier rules.** The layout is set (6 tables,
  rows 1-2-3 over 4-5-6) but `order`/`lowTierOrder`/`highTierOrder` are just
  1..6 and both tier lists are empty, so every event counts as mid-tier and
  no table is reserved for anything. Fill in once the court quality and the
  rating bands are known.
- **A second club's Netlify site.** Each club needs its own account/site
  with `CLUB` and its own secrets set there. `netlify.toml` is shared; only
  the environment differs.
- **The rating system.** `rating.js` still carries VTTC's `RDELTA`/`RDIFF`
  tables. Deferred deliberately until a second club needs different ones.
- **Tournament rules.** `shared/rules/tournamentRules.ts` (group counts,
  advancement) is still hardcoded.
- **Per-club logo files.** `branding.faviconUrl` is configurable but every
  club currently points at the shared `public/images/logo.png`. Per-club
  images need a copy step at build time.
- **`shared/rules/tableRules.ts`** reads the old duplicated table constants
  from `shared/types/Table.ts` and is imported nowhere (only re-exported
  through `index.ts`). Delete it, or point it at the club config.

---

## Open bugs

### Lost update: `updateGame` can land after `finishMatch`

`confirmFinishMatch` (`src/stores/gamePlayStore.ts`) calls
`cancelPendingSave()`, which clears the debounce *timer* but does not await
`pendingSavePromise`. A save already in flight commits after the finish and
overwrites the finished match with a partial score, leaving it
`confirmed: true` with `winningSide: null` — which permanently stalls the
group or bracket, because the match is no longer playable and the round can
never complete.

Reproduced repeatedly under load. In production the human tapping through
the confirm dialog normally gives the save time to land, which is why it
hasn't been seen.

**Fix:** await `pendingSavePromise` (or serialise the saves) before calling
`finishMatch`. Server-side, `finishMatch` could stamp a version and have
`updateGame` write conditionally.

---

## Environment reference

| Variable | Where | Notes |
| --- | --- | --- |
| `CLUB` | shared `.env` | Picks `clubs/<slug>/config.json`. Override per command with `npm start -- --club <slug>`. |
| `AUTH_SECRET` | per site | **Not set.** Signs auth tokens; see above. |
| `MONGODB_URI` / `MONGODB_DB` | per club | `MONGODB_DB` overrides the dev/prod suffix. |
| `PUSHER_APP_ID` / `PUSHER_SECRET` / `VITE_PUSHER_KEY` / `VITE_PUSHER_CLUSTER` | per club | |
| `CLUB_TIMEZONE` | optional | Overrides the club config's timezone. |
| `VITE_DEV_API_PORT` / `VITE_DEV_PORT` | optional | Local only, default 7004 / 7344. Needed to run two clubs side by side. |
| `NOTIFICATIONS_ENABLED` / `VITE_NOTIFICATIONS_ENABLED` | optional | Both are currently off. |

`.env.example` documents the layering; `.env.<slug>` holds a club's secrets
and overrides the shared `.env`.
