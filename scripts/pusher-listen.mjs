#!/usr/bin/env node
// Watch the live-score channel and print every broadcast as it arrives.
//
//   node --env-file=.env scripts/pusher-listen.mjs
//
// Use it to tell "the server never published" apart from "the page didn't
// react": score a point somewhere and watch. Silence here means the server
// isn't publishing at all — usually PUSHER_APP_ID / PUSHER_SECRET missing
// from that site's environment, which is easy to miss because the browser
// only needs VITE_PUSHER_KEY and VITE_PUSHER_CLUSTER, so the client
// subscribes happily and simply never hears anything.

import * as PusherNS from 'pusher-js/node.js'
const Pusher = PusherNS.Pusher ?? PusherNS.default?.Pusher ?? PusherNS.default

const clean = (v) => (v || '').replace(/^["']|["']$/g, '').trim()
const key = clean(process.env.VITE_PUSHER_KEY)
const cluster = clean(process.env.VITE_PUSHER_CLUSTER)

if (!key || !cluster) {
  console.error('VITE_PUSHER_KEY and VITE_PUSHER_CLUSTER must be set.')
  process.exit(1)
}

const stamp = () => new Date().toISOString().slice(11, 23)
console.log(`listening on "live-score"  (key ${key.slice(0, 6)}…, cluster ${cluster})`)
console.log('score a point, then watch here. Ctrl-C to stop.\n')

const pusher = new Pusher(key, { cluster })
pusher.connection.bind('state_change', ({ current }) =>
  console.log(`  ${stamp()}  connection: ${current}`),
)
pusher.connection.bind('error', (err) =>
  console.log(`  ${stamp()}  connection error: ${JSON.stringify(err).slice(0, 200)}`),
)

let count = 0
const channel = pusher.subscribe('live-score')
channel.bind('pusher:subscription_succeeded', () =>
  console.log(`  ${stamp()}  subscribed\n`),
)
channel.bind('updated', (data) => {
  count++
  const id = data?.eventId ?? null
  console.log(`  ${stamp()}  #${count} updated  eventId=${id ?? '(all events)'}`)
})

process.on('SIGINT', () => {
  console.log(`\n${count} broadcast(s) received.`)
  pusher.disconnect()
  process.exit(0)
})
