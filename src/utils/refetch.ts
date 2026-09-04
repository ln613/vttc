// A Pusher broadcast makes every connected client refetch at the same
// instant. That thundering herd is what spikes serverless instances (and
// with them DB connections), so broadcast-driven refetches are spread over a
// small random delay and de-duplicated:
//
//   - jitter: each client waits a random slice of the window, flattening the
//     spike across time instead of all arriving together
//   - collapse: repeat triggers landing while one is already pending are
//     folded into that single pending run
//   - in-flight guard: a trigger arriving mid-request queues exactly one
//     follow-up run rather than piling on concurrent fetches
const DEFAULT_JITTER_MS = 1500

export const createJitteredRefetch = (
  run: () => Promise<unknown> | unknown,
  jitterMs: number = DEFAULT_JITTER_MS,
): (() => void) => {
  if (!run) throw new Error('createJitteredRefetch requires a run function')

  let timer: ReturnType<typeof setTimeout> | null = null
  let inFlight = false
  let runAgain = false

  const schedule = () => {
    if (timer) return // a run is already pending — collapse into it
    timer = setTimeout(
      () => {
        void execute()
      },
      Math.random() * jitterMs,
    )
  }

  const execute = async () => {
    timer = null
    if (inFlight) {
      runAgain = true
      return
    }
    inFlight = true
    try {
      await run()
    } finally {
      inFlight = false
      if (runAgain) {
        runAgain = false
        schedule()
      }
    }
  }

  return schedule
}
