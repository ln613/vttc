# Rewards Page

`/rewards`. Points model only (rules/wallet.md), with the Credit module. Open to everyone; in the site's look for a club with its own website.

## Layout

- shared header ("Rewards" link in the top bar, after "Booking")
- heading: "Rewards" (kicker "Rewards")
- "Top up and earn reward points, then trade them for gifts at the club. Points can only be redeemed for gifts."
- card:
  - signed-in member: "Your points: {points}", "Club ID: {club id}", a "Redemption history" link
  - not signed in: "Sign in — Sign in to see your points." (opens the sign-in dialog)
  - both: "Redeem your points at the front desk — just ask our staff."
  - admin: instead, links "Manage gifts" (Gifts page) and "Redemption history" (every member's)
- the gifts, fewest points first, as cards: image (or a gift icon), name, description, "{points} points"
  - admin: a "Redeem" button on each
  - none: "No gifts yet."

## Redeem dialog (admin)

- "Redeem {gift}" (h2)
- the gift's image, its name and "{points} points each"
- "Number of items": "−" and "+" round buttons, the number between them; starts at 1, from 1 to 99
- "Member" dropdown: "-- Choose a member --", then each member with an account (or with points) as "{name} ({club id})", by name
- once a member is chosen: "{name} has {points} points"
- "Points needed" {gift points × items}
- not enough: "Not enough points", and "Redeem" stays disabled
- "Cancel", "Redeem": redeems (rules/wallet.md, "Redeeming"), closes the dialog, and shows "Redeemed {items} × {gift} for {name}. They now have {points} points." in a message dialog with "OK"
