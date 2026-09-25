// Types for doublesRotation.js. The implementation is plain JavaScript so
// the Netlify functions and the browser can share one copy; this file is
// what the TypeScript side sees.
import type { Player } from '../types/Player'
import type { Match } from '../types/Match'

export declare const isDoublesMatch: (match?: Match) => boolean

export declare const getServeBlock: (
  score1: number,
  score2: number,
  targetPoints: number,
) => number

/**
 * One cycle per game: [server, receiver, server's partner, receiver's
 * partner]. Game 0 uses `initialReceiverId`; later games derive their
 * receiver from the game before.
 */
export declare const getGameCycles: (
  side1: Player[] | undefined,
  side2: Player[] | undefined,
  firstServerIds: string[],
  initialReceiverId?: string,
) => string[][]

/** The pair whose turn it is to open a given game. */
export declare const getServingSideForGame: (
  cycles: string[][],
  gameIndex: number,
  side1: Player[] | undefined,
  side2: Player[] | undefined,
) => Player[] | undefined

export declare const getServerAndReceiver: (args: {
  cycle: string[] | undefined
  score1: number
  score2: number
  targetPoints: number
  swapAtBlock?: number | null
}) => { serverId?: string; receiverId?: string }

/** Half the target, rounded down: 5 of 11, 3 of 7. */
export declare const getDecidingSwitchPoint: (targetPoints: number) => number

export declare const getSwapBlock: (
  totalPointsAtSwitch: number | null | undefined,
  targetPoints: number,
) => number | null
