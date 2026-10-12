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

## A new club

`clubs/new-club.template` is the guide: every field, and which steps are
yours (a Gmail app password, a Pusher app, a Netlify token, and afterwards
linking the repo and adding the site to Google sign-in) versus the script's.
Copy it to `.env.new-club.template` — a name git ignores, since it will hold
real secrets — fill it in, then:

    npm run club:new -- .env.new-club.template

## A club's own look

A club without a website can still have its own look:

- `clubs/<slug>/theme.css` — CSS variables under `html .bk-site` (colours,
  fonts, radius; see booking.css) and `.club-banner` (see
  src/components/club-banner.css). Its presence switches the dialogs,
  buttons, page headings and account pages from the app's plain style to
  the club's (`hasSiteLook()` in src/site/siteContent.ts). Only that club's
  build includes it.
- `branding.banner` in config.json — `{ background, logo, name, services?,
  tagline? }`: the banner is built from the background image with the logo
  and name laid over it, so it never stretches.
- `branding.topBarColor` — the top bar.

NovaPing is the first (navy, cyan and coral; Sora type; squared buttons).
Its logo and banner background are on Cloudinary in the "NovaPing" folder,
uploaded with `scripts/upload-site-images.mjs --no-manifest`.

The rating system is **not** club-configurable yet; `rating.js` still carries
VTTC's tables. Deferred until a second club needs different ones.
