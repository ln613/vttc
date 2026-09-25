// Who serves and who receives in a doubles game.
//
// A game is a cycle of four. With A serving first to X, service passes
//
//     A → X → B → Y → A …
//
// and the receiver is always the next player in that same cycle: A serves
// to X, X serves to B, and so on. Service changes every two points, and
// every point once both sides reach one short of the target.
//
// Two things reshape the cycle, and both are permanent from the moment
// they happen — the sequence carries on from the new arrangement rather
// than snapping back:
//
//   * a new game. The umpire names the first server; the first receiver is
//     whoever served to them in the previous game (ITTF 2.13.6). So if
//     game 1 ran A→X→B→Y and X serves game 2, X serves to A, and the game
//     runs X→A→Y→B.
//   * the change of ends in the deciding game. The receiving pair swap who
//     is taking the serve, and stay swapped: A→X, then at 5 the ends
//     change and it becomes A→Y, Y→B, B→X, X→A.
//
// Nothing here is stored beyond the umpire's choices and the moment of the
// deciding-game swap — the rest is derived from the score, so every device
// and every reload agrees.
//
// Plain JavaScript, like leagueSchedule.js, so the Netlify functions and
// the browser share one copy. See doublesRotation.d.ts for the types.

const idOf = (player) => player?._id?.toString()

/** A doubles match is one where each side fields two players. */
export const isDoublesMatch = (match) =>
  (match?.side1?.length ?? 0) === 2 && (match?.side2?.length ?? 0) === 2

/**
 * How many times service has changed hands since the start of the game.
 */
export const getServeBlock = (score1, score2, targetPoints) => {
  const total = score1 + score2
  const deuce = targetPoints - 1
  const inDeuce = score1 >= deuce && score2 >= deuce
  const beforeDeuce = inDeuce ? deuce : Math.floor(total / 2)
  const afterDeuce = inDeuce ? total - 2 * deuce : 0
  return beforeDeuce + afterDeuce
}

const allPlayers = (side1, side2) => [...(side1 || []), ...(side2 || [])]

const partnerOf = (side1, side2, playerId) => {
  for (const pair of [side1 || [], side2 || []]) {
    if (!pair.some((p) => idOf(p) === playerId)) continue
    const partner = pair.find((p) => idOf(p) !== playerId)
    return idOf(partner)
  }
  return undefined
}

/** One game's cycle: [server, receiver, server's partner, receiver's partner]. */
const cycleFrom = (side1, side2, serverId, receiverId) => {
  const known = new Set(allPlayers(side1, side2).map(idOf))
  if (!known.has(serverId) || !known.has(receiverId)) return []
  const serverPartner = partnerOf(side1, side2, serverId)
  const receiverPartner = partnerOf(side1, side2, receiverId)
  if (!serverPartner || !receiverPartner) return []
  return [serverId, receiverId, serverPartner, receiverPartner]
}

/**
 * The cycle for each game played so far.
 *
 * `firstServerIds[g]` is the player the umpire named to serve game g. Game
 * 0 also needs `initialReceiverId`, the only receiver anyone chooses; every
 * later game's receiver is whoever served to that game's first server in
 * the game before.
 */
export const getGameCycles = (side1, side2, firstServerIds, initialReceiverId) => {
  const cycles = []
  for (let game = 0; game < (firstServerIds || []).length; game++) {
    const serverId = firstServerIds[game]?.toString()
    if (!serverId) break

    if (game === 0) {
      const first = cycleFrom(side1, side2, serverId, initialReceiverId?.toString())
      if (first.length !== 4) return []
      cycles.push(first)
      continue
    }

    // "The first receiver shall be the player who served to him or her in
    // the preceding game" — one place back around the previous cycle.
    const previous = cycles[game - 1]
    const at = previous.indexOf(serverId)
    if (at === -1) break
    const receiverId = previous[(at + 3) % 4]
    const next = cycleFrom(side1, side2, serverId, receiverId)
    if (next.length !== 4) break
    cycles.push(next)
  }
  return cycles
}

/** Who may serve first in a given game: the side whose turn it is. */
export const getServingSideForGame = (cycles, gameIndex, side1, side2) => {
  const previous = cycles?.[gameIndex - 1]
  if (!previous) return undefined
  // The pair that did not open the previous game opens this one.
  const openedLast = previous[0]
  const onSide1 = (side1 || []).some((p) => idOf(p) === openedLast)
  return onSide1 ? side2 : side1
}

/**
 * Who is serving and who is receiving right now.
 *
 * `swapAtBlock` is the service block during which the deciding game's
 * change of ends happened, or null. From that block on the receiving pair
 * are the other way round, and stay that way.
 */
export const getServerAndReceiver = ({
  cycle,
  score1,
  score2,
  targetPoints,
  swapAtBlock = null,
}) => {
  if (!cycle || cycle.length !== 4) {
    return { serverId: undefined, receiverId: undefined }
  }
  const block = getServeBlock(score1, score2, targetPoints)
  const order =
    swapAtBlock != null && block >= swapAtBlock
      ? withReceivingPairSwapped(cycle, swapAtBlock)
      : cycle

  return { serverId: order[block % 4], receiverId: order[(block + 1) % 4] }
}

// The pair receiving at the moment of the swap exchange places. The pair
// serving at that moment are untouched, so whoever is mid-serve keeps the
// ball.
const withReceivingPairSwapped = (cycle, swapAtBlock) => {
  const receiving = (swapAtBlock + 1) % 4
  const partner = (receiving + 2) % 4
  const order = [...cycle]
  ;[order[receiving], order[partner]] = [order[partner], order[receiving]]
  return order
}

/** The point at which the deciding game changes ends: 5 of 11, 3 of 7. */
export const getDecidingSwitchPoint = (targetPoints) =>
  Math.floor(targetPoints / 2)

/**
 * The service block the deciding-game swap falls in, given the total points
 * played when a side first reached the switch point. Recorded when it
 * happens, because the current score cannot say what it was.
 */
export const getSwapBlock = (totalPointsAtSwitch, targetPoints) =>
  totalPointsAtSwitch == null
    ? null
    : getServeBlock(totalPointsAtSwitch, 0, targetPoints)
