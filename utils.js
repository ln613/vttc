const R = require('ramda');
const moment = require('moment');
const util = require('@ln613/util');

const e = {};

e.tap = x => R.tap(console.log, R.isNil(x) ? 'null' : x);

e.serial = (arr, func) => arr.reduce((promise, next) => promise.then(r => func(next).then(r1 => R.append(r1, r))), Promise.resolve([]));

e.sort = R.sort((a, b) => a - b);

e.sortDesc = R.sort((a, b) => b - a);

e.isOdd = n => n % 2 === 1;

const rrCycle = (x, r, l) => x < r ? x - r + l : x - r + 1;

e.rrSchedule = (x, sorted, continuousId) => {
  const l = sorted ? x : R.sortWith([R.descend(R.prop('rating'))], x);
  if (e.isOdd(l.length)) l.push({id: null});
  const t1 = R.range(1, l.length);
  const t2 = R.range(0, l.length / 2);
  return t1.map((r, i) => {
    const l1 = t1.map(n => l[rrCycle(n, r, l.length)]);
    const l2 = R.insert(0, l[0], l1);
    return t2
      .map(n => ({ round: i + 1, home: l2[n].id, away: l2[l.length - n - 1].id }))
      .filter(t => t.home && t.away)
      .map((t, j) => ({...t, id: continuousId ? ((i * l.length / 2) + j + 1) : (j + 1) }));
  })
}

e.getTeamRating = t => t.players && t.players.length > 1
  ? R.pipe(R.map(x => +(x.isSub ? 0 : (x.tRating || x.rating))), e.sort, R.takeLast(2), R.sum)(t.players)
  : 0;

e.rrScheduleTeam = (teams, startDate, ids) => {
  if (!ids) ids = R.range(1, Math.min(Math.floor(teams.length / 2) + 1, 7));

  return R.compose(
    rs => rs.map((w, i) => ({ id: i + 1, matches: w.map((m, j) => { m.id = ids[j]; return m; }), date: moment(startDate).add(i, 'week').toDate() })),
    R.splitEvery(ids.length),
    R.unnest,
    e.rrSchedule,
    R.map(t => ({...t, rating: e.getTeamRating(t)}))
  )(teams);
}

e.json2js = x => JSON.parse(x, (k, v) => R.takeLast(4, k).toLowerCase() === 'date' ? new Date(v) : v)

const rdiff = [[3,0],[5,-2],[8,-5],[10,-7],[13,-9],[15,-11],[18,-14],[20,-16],[25,-21],[30,-26],[35,-31],[40,-36],[45,-41],[50,-45],[55,-50]];
const rdelta = [401,301,201,151,101,51,26,-24,-49,-99,-149,-199,-299,-399];

const rateDiff = (r1, r2) => {
  const n = rdelta.findIndex(x => x <= r1 - r2);
  return n === -1 ? R.last(rdiff) : rdiff[n];
}

e.adjustRating = (g, im = true) => {
  if (g.isDouble || !g.result || g.result === '0:0') {
      return g;
  } else {
    const p1Win = +g.result[0] > +g.result[2];
    const d = p1Win ? rateDiff(g.p1Rating, g.p2Rating) : rateDiff(g.p2Rating, g.p1Rating);
    const c = { p1Diff: p1Win ? d[0] : d[1], p2Diff: p1Win ? d[1] : d[0] };
    return im ? Object.assign({}, g, c) : Object.assign(g, c);
  }
}

e.newRating = (r, d) => Math.max(r + d, 100)

e.sortTeam = R.pipe(R.map(t => [e.getTeamRating(t), t]), R.sortWith([R.descend(R.nth(0))]), R.map(R.nth(1)))

e.numOfGroups = n => Math.pow(2, Math.floor(Math.log10(n / 3) / Math.log10(2)))

e.group = ts => {
  const n = ts.length;
  const g = e.numOfGroups(n);
  return ts.map((t, i) => {
    const l = Math.floor(i / g);
    const c = i % g;
    const group = e.isOdd(l) ? (g - c) : c + 1;
    return {...t, group};
  });
}

e.gengames = (t, t1, t2) => {
  const team1 = util.findById(t1)(t.teams);
  const team2 = util.findById(t2)(t.teams);
  return R.range(0, 5).map(n => ({ id: n + 1, date: t.startDate, t1, t2,
    p1: +team1.players[n === 1 || n === 4 ? 1 : 0].id,
    p2: +team2.players[n === 0 || n === 4 ? 1 : 0].id,
    p3: n === 2 ? team1.players[1].id : undefined,
    p4: n === 2 ? team2.players[1].id : undefined
  }));
}

e.toDateOnly = d => R.is(String, d) ? R.take(10, d) : moment(d).add(8, 'hours').format('YYYY-MM-DD');

e.res = (body, code, cookie) => ({
  statusCode: code || 200,
  headers: R.merge(cookie ? { 'Set-Cookie': cookie } : {}, {
    'Access-Control-Allow-Origin': '*'
  }),
  body: JSON.stringify(body)
});

e.policy = r => ({
  principalId: process.env.principalId,
  policyDocument: { Statement: [ { Action: 'execute-api:Invoke', Effect: 'Allow', Resource: r }, ] }
});

e.parseCookie = r => R.fromPairs(r.multiValueHeaders.cookie.map(c => c.split('=')));

module.exports = e;
