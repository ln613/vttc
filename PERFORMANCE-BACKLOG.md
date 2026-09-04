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
| MongoDB Atlas (shared tier) | **500 connections per node** | Verified on all three nodes: `current + available = 500`. NOT 100, and NOT the 1500 an old code comment claimed. |
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

## Full-day load test — measured 2026-09-04

`npm run load:test` drove **vttc-live-qa** (against `vttc-dev`) over real HTTP:
6 singles + 2 team events, 16 participants each, 8 tables at one point per
second, 10 real Pusher spectator clients. **46.9 min wall clock**
(15:10–15:57 UTC), a full day's match volume at true match pace.

All 8 events ran to completion — **186 singles matches + 227 team
sub-matches + 47 dead rubbers, 17,248 points, 0 errors, 0 bricked matches**.

| Service | Measured | Verdict |
| --- | --- | --- |
| MongoDB peak connections | **85 / 500 per node (17%)** | Comfortable |
| Pusher messages | 891 published → **~45k/day delivered at 50 viewers** | 22% of the 200k limit |
| Pusher peak connections | **50 / 100** | **The binding constraint** |
| Netlify requests | 12,274 (0 errors) | see projection below |

> Both Pusher rows were corrected against the vendor dashboards after the
> run — see "Corrections from the vendor dashboards" below. The harness
> under-reported both.

### Projected cost of one tournament day (50 spectators)

The spectator half was measured with 10 clients and scaled ×5; the scorer
half excludes the harness's idle-polling overhead (a real tablet fetches an
event when it picks up a match, not every 2s).

| | Requests | Bandwidth | Compute | Credits |
| --- | --- | --- | --- | --- |
| Requests (30,334 @ 5,000/credit) | 6.1 | — | — | 6.1 |
| Bandwidth, after the Schedule fix | — | 51.6 MB | — | 1.0 |
| Compute (0.363 credits / 1,000 req) | — | — | 1.1 GB-Hours | **11.0** |
| **Total** | | | | **≈ 18** |

**Compute is the largest component — bigger than requests and bandwidth
combined.** It was not instrumented by the harness; the rate was recovered
afterwards from the account's credit breakdown (+11.7 compute credits over
+32,244 requests = **0.131 GB-seconds per request**, at a p50 function
duration of 0.70 s). An earlier estimate of ~7 credits/day omitted it
entirely.

A tournament day therefore costs about **1.2 deploys**, and the Free plan's
300 credits/month covers roughly **17 tournament days** — before deploys.
Cutting function duration is now the highest-value lever, ahead of any
further payload work.

Excludes compute (GB-hours) and the 15 credits per deploy. **A tournament
day costs about the same as two-thirds of one deploy.** Deploys remain the
thing to control, not traffic.

### The one number that matters

**`type=events&full=true` was 90% of all bandwidth.** With 8 events in the
database it grew to **335 KB raw / 23 KB gzipped**, and the Schedule page
refetches the whole thing on every broadcast — ten of fifty spectators on
that page accounted for 183 MB of the 205 MB.

**Fixed** (see "Already done"): the endpoint now sends only the events the
Schedule can actually draw, cutting it ~83% and taking a projected day from
~10 credits to ~7. The remaining bandwidth is spread thinly enough that no
single endpoint dominates any more.

### Where the day's credits actually went

Cross-checking the account breakdown before/after all of this work:

| | Delta | Credits |
| --- | --- | --- |
| Production deploys | 6 | **90.0** |
| Web requests | +32,244 | 6.5 |
| Compute | +1.17 GB-Hours | 11.7 |
| Bandwidth | +108 MB | 2.1 |
| **Total** | | **110.2** |

**82% of it was deploys**, and only 41% of the request traffic was the
tournament run itself — the rest was iterating on the harness. Six deploys
cost five times more than a full simulated tournament day. This is the same
conclusion the original credit analysis reached, now confirmed end to end.

### Corrections from the vendor dashboards

Three of the harness's own numbers were wrong, all in the optimistic
direction. The vendor dashboards are the authority.

**1. Pusher bills per delivery, not per publish.** 1,765 publishes across
the day's runs showed up as **~17,000 messages** on the dashboard — a
publish costs one message per subscriber. Scaling by room size:

| Viewers | Messages/day | Share of the 200k cap |
| --- | --- | --- |
| 10 | 8,910 | 4% |
| **50** | **44,550** | **22%** |
| 100 | 89,100 | 45% |
| 200 | 178,200 | 89% |

**2. Pusher concurrent connections are the real ceiling.** The run peaked at
exactly **50 of the Sandbox plan's 100**. A real tournament is 50 spectators
+ 8 tablets + admin ≈ 60, and past ~90 concurrent viewers Pusher refuses new
connections — those clients silently stop receiving live updates while the
site otherwise looks fine. This binds long before the message cap does, and
it is the single most likely thing to break on a busy day.

**3. MongoDB peaked at ~85 connections, not 45.** The harness sampled
`serverStatus` through the driver, which reports only the node it is routed
to. The ceiling is **500 per node** (confirmed on all three), so 85 is 17% —
the conclusion is unchanged, but the measurement was low.

### Atlas restarted the cluster mid-afternoon

`replSetGetStatus` after the run: election **term 297**, last election
`stepUpRequestSkipDryRun` at **12:28 PDT**, and all three nodes reporting
~2 h uptime — an Atlas-initiated rolling restart / failover, 3.5 hours
*after* the load test ended, so not caused by it.

Two things follow. The shared tier gets restarted without warning, so this
*will* eventually land mid-tournament; `maybeResetOnError` in `db.js` exists
for exactly that and drops the cached client so the next request rebuilds
against the new topology. And it explains the lopsided Atlas opcounters:
shard-00-02 was primary during the test and shard-00-01 is primary now.
Read preference is `primary` — there are no secondary reads.

### Caveats on these numbers

- **A single IP cannot hold 50 spectator clients.** Netlify's edge starts
  refusing TCP connections — twice during this work, taking `vttc-live` and
  `vttc-live-qa` down *for this network* (~50 min, then ~4 min). True
  50-client fidelity needs 50 source IPs (a hosted load-test service).
- **MongoDB's peak was measured at 10 spectators**, where peak concurrency
  was 16 in-flight requests. At 50 spectators concurrency rises roughly 3×,
  which would put connections near ~140 — still well under 500, but this is
  extrapolation, not measurement.
- Pusher's 891 publishes did bill per delivery — confirmed against the
  dashboard, see the corrections section above.
- Netlify compute (GB-hours) was not instrumented; read it from the
  dashboard for the 15:10–15:57 UTC window.

---

## Already done (for reference)

- **Removed the Pusher double-fire** — `withEventNotify` sent both `event-{id}` and `live-score`; now one broadcast carrying `eventId`. At 50 viewers this moved a tournament day from ~265k Pusher messages (over the 200k free cap) to ~132k.
- **Coalesced `live-score` broadcasts** — leading-edge throttle, 1500 ms window.
- **Client jitter + in-flight dedupe** (`src/utils/refetch.ts`) — spreads the thundering herd over 0–1500 ms.
- **Edge caching** for `liveScore` + `events` (`s-maxage=2`). Confirmed working in production (`age:` header present).
- **Environment-aware Mongo pool** — deployed instances use `maxPoolSize 5 / minPoolSize 1` (was 50/5), ~9× more burst headroom.
- **Schedule payload trimmed to relevant events** — `events&full=true` now applies the client's own `isEventRelevant` rule server-side (an event ships only if it, or a sibling in its series, has a match on a table or in the queue). **402 KB → 67 KB (83%)** with three events live, and what the page renders is byte-identical. Matters most over time: unfinished events accumulate, and three abandoned ones were already 334 KB of every refetch. Falls back to sending everything when no table state exists.
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

### 4. Edge-cache the event-detail endpoint
`type=event` is the biggest broadcast-driven refetch (9.1 KB gzip) but is
currently `no-store`.

- **Why deferred:** the acting admin refetches immediately after their own mutation, so a cache hit could briefly hide their own change. `liveScore`/`events` accept this at `s-maxage=2`; event detail is more visible.
- **Effort/risk:** trivial / medium (staleness UX).

### 5. Targeted writes for the other full-document rewrites
`finishMatch`, `confirmMatch`, `resetMatch` still `$set` the whole `eventStages`.

- **Why deferred:** far less frequent than `updateGame` (once per match, not every 3 s).
- **Effort/risk:** low / low. Mechanical repeat of Option A.

### 6. Netlify build-ignore rule for VTTC
Stop spec/poster/doc commits from triggering a 15-credit deploy:

```toml
[build]
  ignore = "git diff --quiet HEAD^ HEAD -- src netlify shared public index.html vite.config.ts package.json"
```

- **Why deferred:** `vttc-live-qa` auto-builds from `master` on every push, which is a quiet 15 credits each. Worth doing before the next busy dev stretch.
- **Effort/risk:** trivial / low.

### 7. Spectator freshness without polling
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
- **Lost update: `updateGame` can land after `finishMatch`.** `confirmFinishMatch`
  (`src/stores/gamePlayStore.ts`) calls `cancelPendingSave()`, which clears the
  debounce *timer* but does not await `pendingSavePromise`. A save already in
  flight therefore commits after the finish and overwrites the finished match
  with a partial score snapshot — leaving it `confirmed: true` with
  `winningSide: null`, which permanently stalls the group/bracket (the match is
  no longer playable and the round can never complete). Reproduced repeatedly
  under load. In production the human tapping through the confirm dialog
  normally gives the save time to land, which is why it hasn't been seen.
  **Fix:** `await pendingSavePromise` (or a serialized save chain) before
  calling `finishMatch`. Server-side, `finishMatch` could also stamp a version
  and have `updateGame` write conditionally.

- **Knockout rounds use different best-of counts.** `knockoutGames` values like
  `"Best of 3 before Semifinal"` mean QF is best-of-3 while SF/Final are
  best-of-5. Anything writing a result must read `match.config.numberOfGames`
  from the match itself — sending a best-of-3 result to a best-of-5 match
  confirms it with **no winner** and bricks the bracket the same way as above.

- **Simulation harness** — `scripts/simulate-tournament.mjs` (the old in-process
  driver) stalls at 28/31 because of the best-of mismatch above. Superseded by
  `scripts/load-test.mjs`, which drives the deployed site over HTTP; see
  `npm run load:test`.
