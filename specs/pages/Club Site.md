# Club Site

A club's own public website, shown inside the app: Home, Coaches, Pricing, About & Contact. Turned on in the club config:

```json
"site": { "enabled": true, "languages": ["en", "zh"] },
"branding": { "topBarColor": "#3b1d82" }
```

Content lives in `clubs/<slug>/site/`: one resource file per language (`en.json`, `zh.json`) and `images.json`, which maps each image's name ("hero-1", "coach-nathan", "qr-wechat"…) to its address on Cloudinary (folder "Timing Sports"), served as `f_auto,q_auto` so each browser gets the smallest format it takes. To add or replace images, run `node scripts/with-club.mjs --club <slug> node scripts/upload-site-images.mjs <folder of images> --folder "<Cloudinary folder>"` (needs `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`); it uploads them and updates `images.json`. Images left in an `images/` folder are still bundled. Only the building club's files are included.

Plain pages that must exist as real files (not app routes) go in `clubs/<slug>/public/`; the build publishes them at the site root, for that club only. Timing Sports has `privacy.html`: its privacy policy (English and Chinese), which Google's sign-in review needs as a homepage-linked page.

## Footer

Every website page (Home, Coaches, Pricing, About & Contact) ends with a dark footer: "© {year} {name}", the address, the email (mailto link) and "Privacy Policy" / "隐私政策", which opens `/privacy.html` as a normal page (not an app route). A club without a site keeps the app exactly as before. Timing Sports is the first.

## Languages

- English and Simplified Chinese
- with more than one language, the top bar shows a toggle (globe icon, align right, before the account icon) labelled with the language it switches to: "中文" / "EN"
- the choice is remembered on the device; a first visit follows the browser's language, else English
- the toggle translates the top bar, the site pages, and the Booking, Account (with My Bookings, the password and rating dialogs) and Settings pages, with the top-up and payment dialogs, the password rules and the date picker. Dates, clock times (上午 9:00 / 下午 6:00 / 晚上 12:00 in Chinese), lengths and door-code times follow the language too
- not translated: messages that come from the server (e.g. "Not enough credits"), the emailed receipt, sign-in and sign-up, the tournament pages, and the super admin's Modules page
- strings: `src/i18n/en.json`, `src/i18n/zh.json` (the same keys in both), with {placeholders}; the club's own wording in `clubs/<slug>/site/`

## Look of the app pages

Booking, Account and Settings take the site's look for a club with a site: a purple heading band with a yellow kicker, a lilac page, white rounded cards, site buttons, and dialogs with purple headers (`src/pages/booking.css`, `--bk-*` variables set under `.bk-site`; `src/site/themed.ts` picks the class for a site club and the original inline style for any other). Other clubs look exactly as before.

## Top bar

- the club's colour (`branding.topBarColor`)
- links: "Home", (tournament links when that module is on), "Coaches", "Pricing", "Booking" (Calendar module), "About"

## Home (`/`)

- hero: the club's photos (`hero-1`…`hero-5`) as a rotating background, crossfading every 5.5 s with a slow zoom (no zoom with reduced motion), and dots to pick a photo; logo, "TIMING SPORTS", "Play · Connect · Enjoy", the services line; "Book a Court" (→ Booking), "See Pricing"
- five features: pro indoor court, safe & comfortable, more than one sport, expert coaching, easy booking
- about the club (the venue introduction)
- coaches teaser: each coach's photo, name and DUPR rating, "Meet the coaches"
- the venue: photo gallery
- the motto: "More sport · More friends · A better life"

## Coaches (`/coaches`)

- heading, lesson formats (private 1-on-1, semi-private 1-on-2, group classes)
- per coach: photo, name, DUPR rating, headline; credentials, competition results, coaching style; a quote where there is one
- who it's for: beginners, improvers, competitors, groups
- "Join us today!" → About & Contact

## Pricing (`/pricing`)

- court rental by day (Mon–Thu, Fri–Sun) and time, price per hour — built from the weekly booking prices an admin sets (rules/booking.md, Price), with the days and times written in the page's language, so the page always shows what booking charges
- "Promotions" (only when there are any): "Special prices for these days only." and the one-time prices still to come, in the same table with a date ("Sat, Oct 24", yellow) in place of the days
- "Book a Court", and a link to coaching

## About & Contact (`/about`)

- the venue introduction
- address (with a Google Maps link), email, phone, Instagram
- WhatsApp and WeChat QR codes
- gallery

`/coaches`, `/pricing` and `/about` send a club without a site back to its home page.
