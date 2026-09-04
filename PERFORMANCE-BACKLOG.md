# Performance & Cost Backlog

Deferred optimizations and the measurements behind them, so none of this has
to be re-derived. Everything here was investigated in September 2026 while
tuning for a busy tournament day.

---

## Measured baselines

### Payload sizes (production, gzip is what bandwidth bills)

| Endpoint | Raw | Gzip | Refetched on every broadcast by |
| --- | --- | --- | --- |
| `type=liveScore` (idle) | 471 B | 140 B | Live Score page |
| `type=events&full=true` | 32 KB | 4.6 KB | Schedule page |
| `type=events` (summary) | 106 KB | 16 KB | Event List (page load) |
| `type=event&_id=…` | 95 KB | 9.1 KB | Event Detail page |

Largest single `eventStages` array measured: **275 KB** (U1500 Teams).

### Service limits

| Service | Limit | Notes |
| --- | --- | --- |
| MongoDB Atlas (shared tier) | **500 connections** | Verified: `current + available = 500`. NOT 100, and NOT the 1500 an old code comment claimed. |
| Pusher Sandbox (free) | **100 concurrent connections**, 200,000 msgs/day | Connections are the binding constraint, not messages. |
| Netlify Free / Personal | **300 / 1000 credits per month** | |

### Netlify credit rates

5,000 web requests = 1 · 1 GB-Hour compute = 10 · 1 GB bandwidth = 20 · **1 deploy = 15**

> **1 deploy costs the same as 75,000 web requests.** Deploys were 89% of one
> month's credits. Always check deploy count before optimizing traffic.

### Tournament shape (6 singles + 2 team events, 16 participants each)

- 16 participants → 4 groups of 4 → 24 group + 7 knockout = **31 matches per event**
- 8 events = **248 matches**; counting team sub-matches (mean 4.125 per tie) ≈ **442 table-matches**
- ~6 broadcast-triggering actions per match ≈ **2,650 broadcasts/day**

---

## Already done (for reference)

- **Removed the Pusher double-fire** — `withEventNotify` sent both `event-{id}` and `live-score`; now one broadcast carrying `eventId`. At 50 viewers this moved a tournament day from ~265k Pusher messages (over the 200k free cap) to ~132k.
- **Coalesced `live-score` broadcasts** — leading-edge throttle, 1500 ms window.
- **Client jitter + in-flight dedupe** (`src/utils/refetch.ts`) — spreads the thundering herd over 0–1500 ms.
- **Edge caching** for `liveScore` + `events` (`s-maxage=2`). Confirmed working in production (`age:` header present).
- **Environment-aware Mongo pool** — deployed instances use `maxPoolSize 5 / minPoolSize 1` (was 50/5), ~9× more burst headroom.
- **Targeted `$set` in `updateGame`** — writes only changed paths instead of the whole `eventStages`: **79 KB → 5.1 KB average (18× mean, up to 34×)**. Verified byte-identical across group / knockout / team-sub paths.

---

## Deferred — ranked by value

### 1. Shrink the event document (de-duplicate embedded players)
**The ~95 KB read.** Full player objects (`firstName`, `lastName`, `rating`, …) are
embedded in *every* match's `side1`/`side2` **and** in `participants`. Storing
player **ids** and joining on read would likely take the doc from ~95 KB to ~15 KB.

- **Gain:** shrinks every read, every write, *and* the 9.1 KB Event Detail refetch. The single highest-leverage change left.
- **Why deferred:** schema migration touching a lot of code + existing data.
- **Effort/risk:** high / high.

### 2. Move live scores out of the event document
Keep in-progress game scores in a small `matchScores` collection keyed by
`matchId`; merge into the event only on `finishMatch`.

- **Gain:** score saves become ~200-byte upserts — roughly **1000× less I/O** than today.
- **Why deferred:** Option A (targeted `$set`) already cut writes 18×; this is only needed if score-save load becomes a real bottleneck.
- **Effort/risk:** high / medium.

### 3. Pusher delta payloads (stop the notify-then-fetch round trip)
Today a broadcast makes every client refetch: **1 broadcast × N clients = N HTTP requests**.
Sending the changed score *in* the Pusher payload removes the refetch.

- **Blocker:** Pusher caps messages at **10 KB**. The liveScore payload fits, but `events` (32 KB) and `event` (95 KB) do not — so this only works as a **delta** with client-side merging.
- **Gain:** ~60 credits/month (4 tournament days × 50 clients).
- **Why deferred:** needs client-side state merging plus a reconciliation path for missed messages — a divergence/staleness bug surface in the live-scoring path, for headroom we don't currently need.
- **Effort/risk:** medium / **high** (silent staleness during a live event).

### 4. Shrink the Schedule payload
`events&full=true` (4.6 KB gzip) returns all unfinished events with full stage
data on every broadcast, even when only one event changed.

- **Gain:** cheaper than #3 for a good share of the same benefit.
- **Effort/risk:** low–medium / low. **Best next step if traffic needs trimming.**

### 5. Edge-cache the event-detail endpoint
`type=event` is the biggest broadcast-driven refetch (9.1 KB gzip) but is
currently `no-store`.

- **Why deferred:** the acting admin refetches immediately after their own mutation, so a cache hit could briefly hide their own change. `liveScore`/`events` accept this at `s-maxage=2`; event detail is more visible.
- **Effort/risk:** trivial / medium (staleness UX).

### 6. Targeted writes for the other full-document rewrites
`finishMatch`, `confirmMatch`, `resetMatch` still `$set` the whole `eventStages`.

- **Why deferred:** far less frequent than `updateGame` (once per match, not every 3 s).
- **Effort/risk:** low / low. Mechanical repeat of Option A.

### 7. Netlify build-ignore rule for VTTC
Stop spec/poster/doc commits from triggering a 15-credit deploy:

```toml
[build]
  ignore = "git diff --quiet HEAD^ HEAD -- src netlify shared public index.html vite.config.ts package.json"
```

- **Why deferred:** `vttc-live-qa` auto-builds from `master` on every push, which is a quiet 15 credits each. Worth doing before the next busy dev stretch.
- **Effort/risk:** trivial / low.

### 8. Spectator freshness without polling
Only **admins** get the 60 s live-score heartbeat
(`if (authState.isAdmin) startAutoStartHeartbeat()`). Spectators refresh only
when a match-level event fires somewhere — during a quiet stretch their screen
can sit stale for many minutes, and point-by-point scores are never live for them.

- **Do NOT fix with polling.** A 30 s heartbeat for 50 users over a 10 h day ≈ 60,000 requests + ~1.8 GB + ~1.7 GB-Hr ≈ **65 credits for one day** (a fifth of the Free plan). Fix it via Pusher payloads (#3) instead.

---

## Considered and rejected

### Server-side request debounce / duplicate-request coalescing
**Rejected.** Netlify Functions are Lambda: concurrent requests each get their
own instance and module state is per-instance. During the burst we care about,
50 simultaneous refetches land on ~50 instances, each seeing a request count of
**1**. In-instance debouncing only helps sequential requests to the same warm
instance. Edge caching is the only layer that sees the whole herd.

### Shedding requests when DB connections exceed a threshold (e.g. 250)
**Rejected.** Reading the connection count requires a `serverStatus` round-trip
*from every instance* — adding load to the thing being protected — and the
payoff is returning errors to users mid-tournament, the exact outcome we're
avoiding.

### Client polling heartbeat for all users
**Rejected** — see #8. Cheap in Pusher terms, expensive in Netlify credits
(bandwidth is 20 credits/GB).

---

## Watch thresholds

| Signal | Threshold | Action |
| --- | --- | --- |
| Mongo connections (`npm run db:connections`) | > 350 / 500 | Consider M10 (~1500 connections) |
| Pusher concurrent connections | > 100 | Sandbox cap — paid plan needed |
| Netlify credits | > 200 / month | Check deploy count **first** |

---

## Known issues (not performance)

- **`netlify dev` serves a stale function bundle** — it bundles at startup, so server changes need a restart. Cost real debugging time.
- **GDrive upload token expired** — `postapk:build` fails with `invalid_grant`; the APK still builds and copies locally.
- **Simulation harness** (`scripts/simulate-tournament.mjs`) stalls at 28/31 matches — it can't open the next knockout round. Rounds are pre-created placeholders that only fill once the previous round is fully finished **and confirmed**.
