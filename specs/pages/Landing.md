# Landing

A product-style home page for a club that has no website but wants "/" to show off the system — NovaPing, the brand of this scoring and live-score system, is the first. It exists when `clubs/<slug>/landing.json` does; a club with a website (Club Site.md) opens on that instead, and any other club on the event list as before.

`landing.json`: `media` — the addresses once (`video`, `poster`, and the pictures named by the showcase items); then the words per language (`en`, `zh`). The page follows the club's look (theme.css: fonts, colours, buttons, the colour-band heading background).

## Top bar

- "Home" (→ `/`) joins the links; the club's banner (logo and name) stays above it, as on every page

## Sections

- hero, on the colour bands:
  - kicker: "For clubs and tournaments" (the banner above already says "Table Tennis Live Score System")
  - title: "Every point. / Every table. / Live." (the last line in the coral-to-yellow gradient)
  - text, then "Watch live scores" (→ Live Score) and "Browse events" (→ Events)
  - the promo video (the tap ring lands inside the player's half, just above the big number: anywhere in the half scores) in a glass frame with a pulsing "LIVE" badge and the caption "NovaPing in 15 seconds": plays muted, looped and inline with its controls; with reduced motion it doesn't start by itself (poster and controls only)
- how it works: three numbered steps — "Tap", "Live", "Next"
- key features: five rows, picture and words side by side, alternating sides — "Tap to score", "Every table, live", "Tables assigned for you", "Groups ranked instantly" (group standings: live standings, match details with every game score, tiebreakers handled automatically (no rule details); its picture is a group's standings with its match details open, showing two matches, best of 5, on a tie of three), "Brackets fill themselves" (knockout) — each with a tag ("01 · Scoring"…), a line and a checked list. The pictures are stills from the video (Cloudinary cuts them by time), except the groups one: a screenshot of a demo event (novaping-dev, made-up players)
- everything around it: three cards with an icon — singles, doubles and teams; players and ratings; your club's brand — then two bigger cards, each with a checked list:
  - "Sign-in and event registration": email, Google or phone sign-up; eligibility (rating limit, age, sex); doubles partner and teammates; fee instructions and paid entries; full or started events closed
  - "Tournament director's desk": reset a game or match; postpone, or send back to the queue; switch tables or assign one by hand; scores, forfeits and withdrawals; reorder the knockout draw; umpires to tables
- made for your club, on the colour bands: words and a checked list beside the same "11 · 9" scoreboard in three clubs' colours ("Your club", "Riverside TTC", "Summit Open")
- the call: "Bring live scoring to your club", "Email us" (mailto) with the address shown as text
- footer: "© {year} {club name}", the email, and "Privacy Policy" (`branding.privacyUrl`, a real page)

## Narrow screens

- ≤960px: hero, feature rows and the brand section stack (video under the buttons; every picture above its words); feature cards two across
- ≤720px: steps, cards and the bigger cards one column; the hero buttons fill the width; the sample scoreboards stop staggering and their names wrap
