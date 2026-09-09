// Who may call what.
//
// Until now every endpoint accepted every caller — the token handed out at
// sign-in was never checked, so "admin" existed only as a flag in the
// browser. Now that tokens are verifiable (authToken.js), each endpoint
// declares the role it needs.
//
//   PUBLIC  no token. Spectator reads and the sign-in/sign-up bootstrap.
//   USER    any valid token. Scoring and self-service: a player umpires
//           their own match and manages their own registration, and the
//           tablet umpires without being an admin.
//   ADMIN   a token that verifies as an admin. Running the tournament,
//           anything destructive, and anything about money.
//
// Every registered handler must appear here — api.js refuses to serve one
// that doesn't, so a new endpoint can't quietly arrive unprotected.
export const PUBLIC = 'public'
export const USER = 'user'
export const ADMIN = 'admin'

export const ACCESS = {
  get: {
    // Spectators read all of this without signing in.
    players: PUBLIC, // contact details are filtered inside getPlayers
    playerRatingHistory: PUBLIC,
    playerHistory: PUBLIC,
    tournaments: PUBLIC,
    tournament: PUBLIC,
    events: PUBLIC,
    event: PUBLIC,
    eventSeries: PUBLIC,
    liveScore: PUBLIC,
    settings: PUBLIC, // read on app start, before anyone has signed in

    // Money.
    revenue: ADMIN,
    revenueTemplates: ADMIN,
  },

  post: {
    // Getting signed in has to work while signed out.
    signIn: PUBLIC,
    signUp: PUBLIC,
    sendVerificationCode: PUBLIC,
    verifyCode: PUBLIC,

    // Scoring. The umpire button is `isUserInMatch(match) || isAdmin`, so a
    // player umpires their own match; the tablet does it without being an
    // admin. All of these are reachable from the Game Play screen.
    updateGame: USER,
    finishMatch: USER,
    confirmMatch: USER,
    saveMatchSetup: USER,
    startTeamMatchSide: USER,
    markTeamMatchSideOpened: USER,
    saveTeamMatchAssignment: USER, // each side sets its own order of play
    resetMatch: USER, // in the Game Play menu, not just the admin row
    acquireMatchSession: USER,
    heartbeatMatchSession: USER,
    releaseMatchSession: USER,

    // A player acting for themselves.
    registerForEvent: USER,
    changeTeam: USER,
    getPartialTeams: USER,
    getPlayerUnpaidFees: USER,
    registerPushToken: USER,
    unregisterPushToken: USER,
    updateProfile: USER,
    changePassword: USER,

    // Running the tournament.
    saveTournament: ADMIN,
    saveEvent: ADMIN,
    simulateEvent: ADMIN,
    cloneEvent: ADMIN,
    deleteEvent: ADMIN,
    addParticipant: ADMIN,
    deleteParticipant: ADMIN,
    deletePlayerFromTeam: ADMIN,
    editParticipant: ADMIN,
    removePlayerFromEvent: ADMIN,
    setParticipantDefault: ADMIN,
    registerPlayerByAdmin: ADMIN,
    paymentReceived: ADMIN,
    generateGroups: ADMIN,
    generateKnockout: ADMIN,
    resetEvent: ADMIN,
    resetTeamMatch: ADMIN,
    startEvent: ADMIN,
    rebuildMatchQueue: ADMIN,
    postponeMatch: ADMIN,
    cancelMatch: ADMIN,
    assignMatchToTable: ADMIN,
    updateRatings: ADMIN,
    saveSettings: ADMIN,
    saveRevenueTemplate: ADMIN,
  },
}

export const policyFor = (method, type) => ACCESS[method]?.[type]

// null when allowed, otherwise the response to send.
export const denyReason = (policy, auth) => {
  if (policy === PUBLIC) return null
  if (!auth?.isAuthenticated) {
    return { status: 401, error: 'Sign in to do that' }
  }
  if (policy === ADMIN && !auth.isAdmin) {
    return { status: 403, error: 'That action is for admins' }
  }
  return null
}
