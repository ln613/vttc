// Full-height units, chosen for what the browser actually supports.
//
// `dvh` is Chrome 108+ / Safari 15.4+. An older browser doesn't just ignore
// the unit — it throws the whole declaration away, so `height: 100dvh`
// leaves the element with no height at all and the page collapses into a
// blank strip. That is what the club's Nexus 7 (Chrome 95, Android 5) shows.
//
// `vh` has been supported everywhere for a decade. It differs from `dvh`
// only in how it treats a phone's retracting address bar, which costs
// nothing on a kiosk tablet running full-screen.
const supports = (value: string): boolean => {
  try {
    return typeof CSS !== 'undefined' && CSS.supports?.('height', value)
  } catch {
    return false
  }
}

export const FULL_HEIGHT = supports('100dvh') ? '100dvh' : '100vh'
