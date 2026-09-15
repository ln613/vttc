// TEMPORARY DIAGNOSTIC — delete once the league refetch count is explained.
//
// Counters only, deliberately. The previous version of this logged a stack
// trace per call, which was slow enough to make refetches overlap — and
// overlapping runs get collapsed by createJitteredRefetch's in-flight guard,
// so it changed the number it was measuring. One property increment costs
// nothing, so what it counts is what would have happened unmeasured.
//
//   __reset()   before the action
//   __counts()  after it
//
// Dev-only: import.meta.env.DEV is static, so this is dropped from
// production builds entirely.
const counts: Record<string, number> = {}

export const countCall = (label: string) => {
  if (!import.meta.env.DEV) return
  counts[label] = (counts[label] ?? 0) + 1
}

if (import.meta.env.DEV) {
  const w = window as unknown as Record<string, unknown>
  w.__counts = () => ({ ...counts })
  w.__reset = () => {
    for (const key of Object.keys(counts)) delete counts[key]
    return 'counters cleared'
  }
}
