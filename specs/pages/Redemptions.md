# Redemption History Page

`/redemptions`. Points model only (rules/wallet.md), with the Credit module. Signed in only ("Sign in to see your points." otherwise).

## A member

- heading: "Redemption History"
- "Your points: {points}"
- their redemptions, newest first: "{items} × {gift}", the date and time; at the right "−{points} points" and "{points} points left"
- none: "No redemptions yet."

## An admin

- heading: "All Redemptions" — every member's, newest first (the latest 500)
- a search box: "Search by name, club ID or gift" (every word must match)
- each also shows "{member} ({club id})" and "Redeemed by {name}"
