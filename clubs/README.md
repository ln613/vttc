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
- `branding.banner` in config.json — `{ background, backgroundMobile?,
  logo, name, services?, tagline? }`: the banner is built from the
  background image with the logo and name laid over it, so it never
  stretches. `backgroundMobile` is a simpler crop for phones. In theme.css,
  `--banner-size: auto 100%` shows the whole artwork at the banner's height
  (pinned right, `--banner-bg` filling the left) instead of cropping it.
- `branding.topBarColor` — the top bar.
- `clubs/<slug>/landing.json` — a landing page at "/" instead of the event
  list: a product-style home with a video, key features and a contact call
  (specs/pages/Landing.md). `media` holds the addresses (video, poster,
  pictures) once; `en` / `zh` the words. A club with a website opens on
  that instead.

NovaPing — the brand of this scoring and live-score system, run as its own
site — is the first (smooth navy, blue, violet and cyan colour bands with
coral and yellow accents; Exo 2 italic over Inter; pill buttons). Its
banner shows the product: a scoring tablet and the live score board. Its
landing page plays the promo video. Its logo, banner images and the video
are on Cloudinary in the "NovaPing" folder, uploaded with
`scripts/upload-site-images.mjs --no-manifest` (which takes .mp4 too); the
landing page's feature pictures are stills cut from the video by
Cloudinary (`so_<seconds>,c_crop,…` in the address).

The rating system is **not** club-configurable yet; `rating.js` still carries
VTTC's tables. Deferred until a second club needs different ones.
