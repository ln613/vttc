# Gifts Page

`/gifts`. Admin only. Points model only (rules/wallet.md), with the Credit module. Reached from the Rewards page ("Manage gifts") and the Settings page ("Rewards" section).

## Layout

- heading: "Gifts" (kicker "Club admin"), "Add gift" button at the right
- the gifts, fewest points first, as cards: image, name, description, "{points} points", "Edit" and "Delete" links
- none: "No gifts yet. Add the first one."

## Gift dialog

"New gift" or "Edit gift" (h2):

- "Name"* — up to 80 characters
- "Description" (multi-line) — up to 500 characters
- "Image": "Choose image" (any image file, shrunk to fit 800px); once chosen, a preview, "Change image" and "Remove image"
- "Points needed"* — whole number from 1
- "Cancel", "Save": errors are shown in the dialog

## Delete

"Delete "{name}"? Past redemptions of it are kept." — confirm hides the gift (rules/wallet.md, "Gifts").
