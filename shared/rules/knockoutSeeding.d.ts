// Types for knockoutSeeding.js. The implementation is plain JavaScript so
// the Netlify functions and the browser can share one copy; this file is
// what the TypeScript side sees.
import type {
  KnockoutRound,
  ParticipantWithGroupInfo,
} from '../types/Tournament'

/** Every participant standing in a round, both lines of every match. */
export declare const roundParticipants: (
  round?: KnockoutRound,
) => ParticipantWithGroupInfo[]

export declare const participantIdOf: (
  entry?: ParticipantWithGroupInfo,
) => string | undefined

/** How many of the top seeds are pinned in place: A1 and B1. */
export declare const FIXED_SEED_COUNT: number

/** The ids of A1 and B1 — the two the draw is built around. */
export declare const getFixedParticipantIds: (
  participants: ParticipantWithGroupInfo[],
  options?: { isKnockoutOnly?: boolean },
) => Set<string>
