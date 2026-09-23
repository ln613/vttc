// Which two names in a knockout draw never move.
//
// The bracket's own `seedingList` cannot answer this. It is replaced with
// the *next* round's list the moment a round counts as fully populated
// (generateNextRoundIfNeeded), and in a draw with byes that happens as soon
// as the bracket is created — the byes already fill both next-round slots.
// What survives every rewrite is on the participants themselves: the group
// they came from and where they finished in it.
//
// Plain JavaScript, like leagueSchedule.js, so the Netlify functions and
// the browser share one copy. See knockoutSeeding.d.ts for the types.

/** Every participant standing in a round, both lines of every match. */
export const roundParticipants = (round) =>
  (round?.matches || [])
    .flatMap((km) => [km.participant1, km.participant2])
    .filter(Boolean)

export const participantIdOf = (entry) =>
  (entry?.participant?._id ?? entry?._id)?.toString()

/** How many of the top seeds are pinned in place: A1 and B1. */
export const FIXED_SEED_COUNT = 2

// A1 and B1 — the group winners the draw is built around, placed at
// opposite ends so they can only meet in the final. Moving either would
// undo the one thing the seeding exists to guarantee.
//
// A knockout-only event has no groups to rank by, so its draw seeds on
// rating instead (createInitialSeedingList) and the same two positions are
// held by the two highest-rated entrants.
export const getFixedParticipantIds = (participants, { isKnockoutOnly } = {}) => {
  if (!Array.isArray(participants)) return new Set()

  const ordered = [...participants].sort(
    isKnockoutOnly ? byRatingDescending : byGroupRank,
  )
  return new Set(
    ordered.slice(0, FIXED_SEED_COUNT).map(participantIdOf).filter(Boolean),
  )
}

const byRatingDescending = (a, b) =>
  (b?.participant?.rating || 0) - (a?.participant?.rating || 0)

// Rank first, then group: A1, B1, C1, ... — the order the snake seeding
// opens with, which is all that is needed to find the top two.
const byGroupRank = (a, b) =>
  (a?.ranking ?? 0) - (b?.ranking ?? 0) ||
  (a?.groupIndex ?? 0) - (b?.groupIndex ?? 0)
