// Emit the week fixtures in the "Match Details" shape: winner of each match
// on the left, and each game reduced to the losing side's points.
import { pathToFileURL } from 'node:url'
// node tojson.mjs <wkNdata.mjs>
const { fixtures, WEEK } = await import(pathToFileURL(process.argv[2]).href)
import { resolveClubTarget } from '/Users/nanli/Desktop/vttc/scripts/utils/clubEnv.mjs'
import { writeFileSync } from 'node:fs'

const t = resolveClubTarget('gvttc')
process.env.MONGODB_URI = t.uri
process.env.MONGODB_DB = 'gvttc'
const { connectDB, getDB } = await import('/Users/nanli/Desktop/vttc/netlify/functions/utils/db.js')
await connectDB()
const db = getDB()

// Roster spelling, "LAST, First (BC)", falling back to the sheet's name for
// anyone not in the players table.
const rosterName = async (name) => {
  const i = name.lastIndexOf(' ')
  if (i < 0) return `${name} (BC)`
  const first = name.slice(0, i)
  const last = name.slice(i + 1)
  const p = await db.collection('players').findOne({
    firstName: new RegExp(`^${first.replace(/[.()]/g, '\\$&')}$`, 'i'),
    lastName: new RegExp(`^${last}$`, 'i'),
  })
  const [f, l] = p ? [p.firstName, p.lastName] : [first, last]
  return `${l.toUpperCase()}, ${f} (BC)`
}

const SLOTS = [[0,0],[1,1],[2,2],[0,1],[1,2],[2,0],[0,2],[1,0],[2,1]]
const noScores = (games) => typeof games === 'string'

const gamesWon = (games) =>
  noScores(games) ? (games === 'H' ? [3, 0] : [0, 3]) : games.reduce((a, [h, x]) => (h > x ? [a[0] + 1, a[1]] : [a[0], a[1] + 1]), [0, 0])

// Each game becomes the points of whoever lost it, negated when the match
// loser took that game — the standard way results are written down.
const detailsFor = (games, homeWonMatch) =>
  noScores(games) ? '' : '(' +
  games
    .map(([h, x]) => {
      const homeWonGame = h > x
      const loserPoints = homeWonGame ? x : h
      return (homeWonGame === homeWonMatch ? '' : '-') + loserPoints
    })
    .join(',') +
  ')'

const buildRows = async (f) => {
  const rows = []
  for (let mi = 0; mi < f.games.length; mi++) {
    const [hi, ai] = (f.pairs || SLOTS)[mi]
    const games = f.games[mi]
    const [h, a] = gamesWon(games)
    const homeWon = h > a
    const home = { slot: 'ABC'[hi] + f.table, name: await rosterName(f.home.players[hi]), team: f.home.name }
    const away = { slot: 'XYZ'[ai] + f.table, name: await rosterName(f.away.players[ai]), team: f.away.name }
    rows.push({
      no: mi + 1,
      winner: homeWon ? home : away,
      loser: homeWon ? away : home,
      score: `${Math.max(h, a)}:${Math.min(h, a)}`,
      details: detailsFor(games, homeWon),
    })
  }
  return rows
}

const out = []
for (const f of fixtures) {
  const homeWonTie = f.final[0] > f.final[1]
  out.push({
    table: f.table,
    week: WEEK,
    // The winning team goes on the left; the A/B/C side of the paper sheet is
    // the one shaded grey, whichever side that turns out to be.
    left: homeWonTie ? f.home.name : f.away.name,
    right: homeWonTie ? f.away.name : f.home.name,
    grey: f.home.name,
    final: `${Math.max(...f.final)}:${Math.min(...f.final)}`,
    rows: await buildRows(f),
  })
}

writeFileSync(new URL('./wk.json', import.meta.url), JSON.stringify(out, null, 2))
console.log(out.map((f) => `t${f.table} ${f.left} ${f.final} ${f.right}  (grey: ${f.grey})`).join('\n'))
process.exit(0)