// node scripts/gvttc-weekly/who.mjs — look up names in the gvttc players table (read-only)
import { createRequire } from 'module'
import { resolveClubTarget } from '../utils/clubEnv.mjs'
const { MongoClient } = createRequire(import.meta.url)('mongodb')
const c = await MongoClient.connect(resolveClubTarget('gvttc').uri)
const db = c.db('gvttc')
const q = JSON.parse(process.argv[2])
for (const [f, l] of q) {
  const ps = await db.collection('players').find({ firstName: new RegExp(f, 'i'), lastName: new RegExp(l, 'i') }, { projection: { firstName: 1, lastName: 1, ttcanId: 1, rating: 1 } }).limit(8).toArray()
  console.log(`${f} / ${l}:`, ps.map((p) => `${p.firstName} | ${p.lastName} | ${p.ttcanId ?? '-'} | ${p.rating ?? '-'}`).join('  ;  ') || 'NOT FOUND')
}
await c.close()
