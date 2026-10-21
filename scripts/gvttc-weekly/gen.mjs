import { pathToFileURL } from 'node:url'
// The week's transcribed scorecards: node gen.mjs <wkNdata.mjs>
const { fixtures, inferred, WEEK, DATE_LABEL } = await import(pathToFileURL(process.argv[2]).href)
import { resolveClubTarget } from '/Users/nanli/Desktop/vttc/scripts/utils/clubEnv.mjs'
import { writeFileSync } from 'node:fs'

const t = resolveClubTarget('gvttc')
process.env.MONGODB_URI = t.uri
process.env.MONGODB_DB = 'gvttc'
const { connectDB, getDB } = await import('/Users/nanli/Desktop/vttc/netlify/functions/utils/db.js')
await connectDB()
const db = getDB()

const esc = (s) => String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;')

// ==================== PLAYER LOOKUP ====================

const lookupPlayer = async (name) => {
  const i = name.lastIndexOf(' ')
  // A name with no surname (just "Amy") can't be looked up.
  if (i < 0) return { name, ttcan: null, rating: null, missing: true }
  const p = await db.collection('players').findOne({
    firstName: new RegExp(`^${name.slice(0, i).replace(/[.()]/g, '\\$&')}$`, 'i'),
    lastName: new RegExp(`^${name.slice(i + 1)}$`, 'i'),
  })
  if (!p) return { name, ttcan: null, rating: null, missing: true }
  // A hand-added player has no TTCan id and a placeholder 0 rating; show both
  // cells blank rather than printing a rating nobody earned.
  const ttcan = p.ttcanId ?? null
  const rating = typeof p.rating === 'number' ? p.rating : null
  return ttcan == null && !rating
    ? { name, ttcan: null, rating: null }
    : { name, ttcan, rating }
}

const resolveLineups = async () => {
  for (const f of fixtures) {
    for (const side of [f.home, f.away]) {
      side.resolved = []
      for (const n of side.players) side.resolved.push(await lookupPlayer(n))
    }
  }
}

// ==================== VALIDATION ====================

const SLOTS = [[0,0],[1,1],[2,2],[0,1],[1,2],[2,0],[0,2],[1,0],[2,1]]
// A sheet whose rows didn't follow the printed order lists its own pairings.
const pairsOf = (f) => f.pairs || SLOTS
// A match the sheet records only as a result: 'H' home won 3-0, 'A' away won.
const noScores = (games) => typeof games === 'string'

const isLegalGame = ([a, b]) => {
  const hi = Math.max(a, b), lo = Math.min(a, b)
  return hi === 11 ? lo <= 9 : hi > 11 && hi - lo === 2
}

const gamesWon = (games) =>
  noScores(games)
    ? (games === 'H' ? [3, 0] : [0, 3])
    : games.reduce((acc, [a, b]) => (a > b ? [acc[0] + 1, acc[1]] : [acc[0], acc[1] + 1]), [0, 0])

const validate = () => {
  const problems = []
  for (const f of fixtures) {
    if (f.games.length !== 9) problems.push(`table ${f.table}: ${f.games.length} matches`)
    let run = [0, 0]
    f.games.forEach((games, mi) => {
      const [h, a] = gamesWon(games)
      if (Math.max(h, a) !== 3) problems.push(`table ${f.table} match ${mi + 1}: ${h}:${a} is not a finished match`)
      h > a ? run[0]++ : run[1]++
      if (!noScores(games)) games.forEach((g, gi) => {
        const flagged = (f.queries || []).some(([m, n]) => m === mi + 1 && n === gi + 1)
        if (!isLegalGame(g) && !flagged) problems.push(`table ${f.table} match ${mi + 1} game ${gi + 1}: ${g[0]}-${g[1]} is not a legal score`)
      })
    })
    if (run[0] !== f.final[0] || run[1] !== f.final[1]) {
      problems.push(`table ${f.table}: running ${run.join(':')} but sheet says ${f.final.join(':')}`)
    }
    f.running = run
  }
  return problems
}

// ==================== RENDER ====================

const luRow = (slot, cls, p) => `<tr${p.missing ? ' class="unknown"' : ''}>
  <td class="slot"><span class="chip ${cls}">${slot}</span></td>
  <td class="pname">${esc(p.name)}${inferred[p.name] ? ` <span class="inf" title="${esc(inferred[p.name])}">?</span>` : ''}</td>
  <td class="tt">${p.ttcan ?? ''}</td>
  <td class="rt">${p.rating ?? ''}</td>
</tr>`

const lineupTable = (side, slots, cls) =>
  `<div><h3>${esc(side.name)}</h3><table class="lu"><thead><tr><th></th><th>Name</th><th class="r">TTCan ID</th><th class="r">Rating</th></tr></thead><tbody>` +
  side.resolved.map((p, i) => luRow(slots[i], cls, p)).join('') +
  `</tbody></table></div>`

const gameCell = (games, queries, mi) =>
  noScores(games) ? '<span class="noscore">no game scores on the sheet</span>' : games.map(([a, b], gi) => {
    const q = (queries || []).find(([m, n]) => m === mi + 1 && n === gi + 1)
    return `<span class="g${q ? ' q' : ''}"${q ? ` title="${esc(q[2])}"` : ''}><b class="${a > b ? 'won' : ''}">${a}</b>-<b class="${b > a ? 'won' : ''}">${b}</b></span>`
  }).join('')

const matchRow = (f, mi) => {
  const [hi, ai] = pairsOf(f)[mi]
  const games = f.games[mi]
  const [h, a] = gamesWon(games)
  const run = f.games.slice(0, mi + 1).reduce((acc, g) => {
    const [x, y] = gamesWon(g)
    return x > y ? [acc[0] + 1, acc[1]] : [acc[0], acc[1] + 1]
  }, [0, 0])
  return `<tr>
  <td class="num">${mi + 1}</td>
  <td class="pair"><span class="chip h">${'ABC'[hi]}</span><span class="chip a">${'XYZ'[ai]}</span></td>
  <td class="names"><span class="${h > a ? 'won' : ''}">${esc(f.home.resolved[hi].name)}</span> <span class="v">v</span> <span class="${a > h ? 'won' : ''}">${esc(f.away.resolved[ai].name)}</span></td>
  <td class="games">${gameCell(games, f.queries, mi)}</td>
  <td class="mr">${h}<span class="v">:</span>${a}</td>
  <td class="run">${run[0]}<span class="v">:</span>${run[1]}</td>
</tr>`
}

const card = (f) => `
<section class="card">
  <header class="ch">
    <div class="tbl"><span class="tlab">Table</span><span class="tnum">${f.table}</span></div>
    <div class="teams">
      <span class="tm ${f.final[0] > f.final[1] ? 'won' : ''}">${esc(f.home.name)}</span>
      <span class="v">v</span>
      <span class="tm ${f.final[1] > f.final[0] ? 'won' : ''}">${esc(f.away.name)}</span>
    </div>
    <div class="final"><span class="fs ${f.final[0] > f.final[1] ? 'won' : ''}">${f.final[0]}</span><span class="v">:</span><span class="fs ${f.final[1] > f.final[0] ? 'won' : ''}">${f.final[1]}</span></div>
    <label class="done"><input type="checkbox" id="done-${f.table}" data-table="${f.table}"> entered</label>
  </header>
  <div class="lineups">
    ${lineupTable(f.home, 'ABC', 'h')}
    ${lineupTable(f.away, 'XYZ', 'a')}
  </div>
  <div class="scroll"><table class="mt">
    <thead><tr><th></th><th>Slots</th><th>Players</th><th>Games</th><th>Match</th><th>${esc(f.home.name)} : ${esc(f.away.name)}</th></tr></thead>
    <tbody>${f.games.map((_, mi) => matchRow(f, mi)).join('')}</tbody>
  </table></div>
</section>`

// ==================== ASSEMBLE ====================

await resolveLineups()
const problems = validate()
if (problems.length > 0) {
  console.error('TRANSCRIPTION PROBLEMS:\n' + problems.map((p) => '  ' + p).join('\n'))
  process.exit(1)
}

const missing = []
for (const f of fixtures) {
  for (const [side, team] of [[f.home, f.home.name], [f.away, f.away.name]]) {
    for (const p of side.resolved) if (p.missing) missing.push({ name: p.name, team })
  }
}
const noRating = fixtures.flatMap((f) => [...f.home.resolved, ...f.away.resolved]).filter((p) => !p.missing && (p.ttcan == null || p.rating == null))
const totalQueries = fixtures.reduce((n, f) => n + (f.queries || []).length, 0)
const slots = fixtures.length * 6

console.log(`fixtures ${fixtures.length}  matches ${fixtures.length * 9}  slots ${slots}  missing ${missing.length}  no rating ${noRating.length}  queried games ${totalQueries}`)
console.log('missing: ' + missing.map((m) => `${m.name} (${m.team})`).join(', '))

const CSS = `:root{
  --paper:#faf9f7; --surface:#fff; --ink:#1b1d21; --soft:#6a6660; --rule:#e5e1da;
  --accent:#b3281e; --accent-soft:#f6e7e4; --won:#1f7a4d; --warn:#9a5b00; --warn-soft:#fbf0dd;
  --chip-h:#2c3e6b; --chip-a:#7a3a1f;
}
@media (prefers-color-scheme:dark){ :root:not([data-theme="light"]){
  --paper:#161719; --surface:#1e1f22; --ink:#e9e6e1; --soft:#9a958d; --rule:#31333799;
  --accent:#e8695c; --accent-soft:#3a201d; --won:#5cc08c; --warn:#e0a44e; --warn-soft:#3a2f18;
  --chip-h:#8fa8de; --chip-a:#d79b78;
}}
:root[data-theme="dark"]{
  --paper:#161719; --surface:#1e1f22; --ink:#e9e6e1; --soft:#9a958d; --rule:#31333799;
  --accent:#e8695c; --accent-soft:#3a201d; --won:#5cc08c; --warn:#e0a44e; --warn-soft:#3a2f18;
  --chip-h:#8fa8de; --chip-a:#d79b78;
}
body{background:var(--paper);color:var(--ink);font-family:"Source Sans 3",system-ui,sans-serif;font-size:15px;line-height:1.5}
.wrap{max-width:1040px;margin:0 auto;padding-inline:18px;padding-block:28px 56px;display:flex;flex-direction:column;gap:22px}
h1{font-family:"Archivo Narrow",system-ui,sans-serif;font-size:clamp(28px,5vw,40px);font-weight:700;letter-spacing:-.01em;margin:0;text-wrap:balance}
.eyebrow{font-family:"Archivo Narrow",sans-serif;text-transform:uppercase;letter-spacing:.14em;font-size:12px;color:var(--accent);font-weight:700}
.sub{color:var(--soft);margin:2px 0 0}
.bar{display:flex;flex-wrap:wrap;gap:10px 26px;align-items:baseline;border-top:2px solid var(--ink);border-bottom:1px solid var(--rule);padding-block:12px}
.stat{display:flex;gap:7px;align-items:baseline}
.stat b{font-family:"IBM Plex Mono",monospace;font-size:19px;font-variant-numeric:tabular-nums}
.stat span{color:var(--soft);font-size:13px}
.card{background:var(--surface);border:1px solid var(--rule);border-radius:3px}
.ch{display:flex;align-items:center;gap:16px;flex-wrap:wrap;padding:13px 16px;border-bottom:1px solid var(--rule)}
.tbl{display:flex;align-items:baseline;gap:6px}
.tlab{font-family:"Archivo Narrow",sans-serif;text-transform:uppercase;letter-spacing:.12em;font-size:10px;color:var(--soft)}
.tnum{font-family:"IBM Plex Mono",monospace;font-size:26px;font-weight:600;color:var(--accent)}
.teams{flex:1;min-width:190px;font-family:"Archivo Narrow",sans-serif;font-size:19px;font-weight:600}
.tm.won{color:var(--won)}
.final{font-family:"IBM Plex Mono",monospace;font-size:22px;font-weight:600;font-variant-numeric:tabular-nums}
.fs.won{color:var(--won)}
.v{color:var(--soft);font-weight:400;padding-inline:3px}
.done{display:flex;align-items:center;gap:6px;font-size:13px;color:var(--soft);cursor:pointer;user-select:none}
.lineups{display:grid;grid-template-columns:1fr 1fr;gap:0 18px;padding:12px 16px;border-bottom:1px solid var(--rule)}
.lineups h3{font-family:"Archivo Narrow",sans-serif;text-transform:uppercase;letter-spacing:.1em;font-size:11px;color:var(--soft);margin:0 0 5px;font-weight:700}
table{border-collapse:collapse;width:100%}
.lu th{font-family:"Archivo Narrow",sans-serif;text-transform:uppercase;letter-spacing:.09em;font-size:9.5px;color:var(--soft);text-align:left;font-weight:700;padding:0 0 3px;border-bottom:1px solid var(--rule)}
.lu th.r{text-align:right}
.lu td{padding:3px 0;border-bottom:1px dotted var(--rule);font-size:14px;vertical-align:middle}
.lu .slot{width:26px}
.lu .tt,.lu .rt{font-family:"IBM Plex Mono",monospace;font-size:12px;text-align:right;color:var(--soft);font-variant-numeric:tabular-nums;white-space:nowrap}
.lu .tt{width:62px}.lu .rt{width:44px}
.chip{display:inline-grid;place-items:center;width:19px;height:19px;box-sizing:border-box;flex:none;padding:0;border-radius:2px;font-family:"IBM Plex Mono",monospace;font-size:11px;font-weight:600;color:#fff}
.chip.h{background:var(--chip-h)}.chip.a{background:var(--chip-a)}
:root[data-theme="dark"] .chip,:root:not([data-theme="light"]) .chip{color:#16171a}
@media (prefers-color-scheme:light){:root:not([data-theme="dark"]) .chip{color:#fff}}
.unknown .pname{color:var(--warn)}
.inf{display:inline-grid;place-items:center;width:15px;height:15px;box-sizing:border-box;flex:none;padding:0;border-radius:50%;background:var(--warn);color:var(--paper);font-size:10px;font-weight:700;vertical-align:1px;cursor:help}
.scroll{overflow-x:auto}
.mt{font-size:13.5px;min-width:560px}
.mt th{font-family:"Archivo Narrow",sans-serif;text-transform:uppercase;letter-spacing:.1em;font-size:10px;color:var(--soft);text-align:left;padding:8px 10px;border-bottom:1px solid var(--rule);font-weight:700}
.mt td{padding:6px 10px;border-bottom:1px solid var(--rule)}
.mt tr:last-child td{border-bottom:0}
.num{font-family:"IBM Plex Mono",monospace;color:var(--soft);width:22px}
.pair{white-space:nowrap;width:52px}
.pair .chip+.chip{margin-left:3px}
.names{min-width:150px}
.names .won{color:var(--won);font-weight:600}
.games{font-family:"IBM Plex Mono",monospace;font-size:12.5px;font-variant-numeric:tabular-nums;white-space:nowrap}
.g{margin-right:9px;color:var(--soft)}
.noscore{font-style:italic;color:var(--soft)}
.g b{font-weight:400}
.g b.won{color:var(--ink);font-weight:600}
.g.q{background:var(--warn-soft);box-shadow:0 0 0 2px var(--warn-soft);border-bottom:1px dotted var(--warn);cursor:help}
.g.q b.won{color:var(--warn)}
.mr,.run{font-family:"IBM Plex Mono",monospace;font-weight:600;font-variant-numeric:tabular-nums;white-space:nowrap}
.run{color:var(--soft)}
.done input{accent-color:var(--won);width:15px;height:15px}
.card.entered{opacity:.62}
.card.entered .ch{background:var(--accent-soft)}
@media (max-width:620px){.lineups{grid-template-columns:1fr;gap:14px}}
@media (prefers-reduced-motion:reduce){*{transition:none!important}}`

const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<title>GVTTC Week ${WEEK} Scorecards</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Archivo+Narrow:wght@600;700&family=Source+Sans+3:wght@400;600&family=IBM+Plex+Mono:wght@400;600&display=swap">
<style>${CSS}</style>
</head>
<body>
<div class="wrap">
  <header>
    <p class="eyebrow">GVTTC Seasonal League 2026 Fall &middot; 2 Star Sanctioned</p>
    <h1>Week ${WEEK} &mdash; ${DATE_LABEL}</h1>
    <p class="sub">Transcribed from the six paper scorecards for entry into the league system. Every sheet&rsquo;s running total reconciles with its final team score.</p>
  </header>

  <div class="bar">
    <div class="stat"><b>${fixtures.length}</b><span>fixtures</span></div>
    <div class="stat"><b>${fixtures.length * 9}</b><span>matches</span></div>
    <div class="stat"><b>${slots - missing.length}<span style="color:var(--soft)">/${slots}</span></b><span>players identified</span></div>
    <div class="stat"><b id="progress">0/${fixtures.length}</b><span>entered</span></div>
  </div>

${fixtures.map(card).join('\n')}

</div>
<script>
(function(){
  var KEY='gvttc-wk${WEEK}-entered';
  var state={};
  try{ state=JSON.parse(localStorage.getItem(KEY)||'{}')||{}; }catch(e){ state={}; }
  var boxes=[].slice.call(document.querySelectorAll('.done input'));
  function paint(){
    var n=0;
    boxes.forEach(function(b){
      var on=!!state[b.dataset.table];
      b.checked=on; b.closest('.card').classList.toggle('entered',on); if(on)n++;
    });
    document.getElementById('progress').textContent=n+'/'+boxes.length;
  }
  boxes.forEach(function(b){
    b.addEventListener('change',function(){
      state[b.dataset.table]=b.checked;
      try{ localStorage.setItem(KEY,JSON.stringify(state)); }catch(e){}
      paint();
    });
  });
  paint();
})();
</script>
</body>
</html>`

writeFileSync(new URL(`./gvttc-week${WEEK}.html`, import.meta.url), html)
console.log('written ' + html.length + ' bytes')
process.exit(0)
