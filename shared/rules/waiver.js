// The club's liability waiver — see specs/rules/waiver.md. A club that
// requires one (club config `liabilityWaiver`) asks every member to accept
// its current version before they use their account; the acceptance is kept
// on the player. Shared by the functions and the app.

/** The waiver the club requires, or null when it requires none. */
export const requiredWaiver = (config) => {
  const w = config?.liabilityWaiver
  return w?.required && w.version ? { version: String(w.version) } : null
}

/** Has this player accepted the version the club requires now? */
export const hasAcceptedWaiver = (config, player) => {
  const required = requiredWaiver(config)
  if (!required) return true
  return player?.waiver?.version === required.version
}
