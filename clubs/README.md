# Clubs

One directory per club. Everything here is **non-secret** and is baked into
the build; secrets live in that club's env (Netlify dashboard in production,
`.env.<slug>` locally).

    clubs/<slug>/config.json

Pick the club with the `CLUB` environment variable (default `vttc`):

    CLUB=vttc npm run build
    CLUB=vttc npm start

The same file is read by both sides — the client through the `club-config`
alias in `vite.config.ts`, the server through `netlify/functions/utils/club.js`
— so the two can never disagree about a club's tables or rules.

The rating system is **not** club-configurable yet; `rating.js` still carries
VTTC's tables. Deferred until a second club needs different ones.
