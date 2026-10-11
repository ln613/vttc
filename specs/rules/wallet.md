# Wallet Rules

How a club's players hold money with it. Two models; the club config chooses one:

```json
"creditModel": "points"
```

- `"credits"` (or absent): Credits
- `"points"`: Points — Timing Sports

Shared rules: shared/rules/wallet.js. Both models need the Credit module (rules/modules.md).

## Credits

The model every club had before:

- top up any whole-dollar amount from the minimum ($10): $1 = 100 credits
- the balance is in credits and pays for bookings (rules/booking.md, "Price")
- shown as "3,000 credits"

## Points

Two separate amounts:

- **balance**: dollars. A top-up adds the same amount (top up $100, the balance goes up by $100). It pays for bookings, at the booking's dollar price. Shown as "$100".
- **reward points**: given by some top-up amounts. Points cannot pay for anything (bookings, coaching, fees or products); they are only redeemed for gifts at the club.

Stored like credits (players.credits, at $1 = 100), so booking and its ledger work the same in both models; the reward points are a separate number (players.points).

### Top up

Only the amounts on offer, each with its reward points. Defaults:

| Top up | Reward points |
|---|---|
| $25 | none |
| $50 | 50 |
| $100 | 125 |
| $200 | 300 |
| $500 | 875 |
| $1000 | 2000 |

- an admin changes them on the Settings page ("Rewards" section): saved with the settings (`topUpOptions`)
- 1 to 12 amounts, each $1 to $10,000 in whole dollars, 0 or more points, no amount listed twice; shown smallest first
- any other amount is refused: "Choose one of the top-up amounts"
- the points are fixed when the top-up starts, so a later change to the offer doesn't alter a payment already under way
- once paid: the balance and the points go up together; each is written to its ledger (creditTransactions, pointTransactions), with the amount after it

### Club ID

A short id for a member, so the desk can tell members with the same name apart: the last 6 characters of their account id, in capitals ("79E7C6"). Shown on the member's Account page and Rewards page, and beside their name when an admin redeems.

### Gifts

An admin keeps the gifts on the Gifts page (pages/Gifts.md):

- name* (up to 80 characters), description (up to 500), image (optional), points needed* (a whole number from 1)
- the image is shrunk in the browser to fit 800px and stored with the gift
- deleting a gift hides it; redemptions of it keep its name

### Redeeming

At the club, by an admin, on the Rewards page (pages/Rewards.md):

- choose the number of items (1 to 99) and the member
- points needed = the gift's points × the number of items
- the points are taken only if the member has them all, in one update — two redemptions at once can't spend the same points. Otherwise "Not enough points" and nothing changes
- the redemption is recorded: member, club id, gift, points each, number of items, points taken, points left, who redeemed it ("Club admin" for the admin login, otherwise the admin's name), and when
- written to the member's points ledger
- shown in the member's redemption history and in the club's (pages/Redemptions.md)

The balance is never touched by redeeming, and points never pay for a booking.
