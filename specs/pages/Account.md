# Account Page

## Layout

Vertical

- shared header
- "{name} ({rating})" (h1, align left)
- Profile Section
- "Sign Out" button (hide in edit mode)

## Profile Section

- title row
  - "Profile" (h3, align left)
  - action icons (align right), hidden for admin and super admin
    - read only mode: Edit Icon (enter edit mode)
    - edit mode: "Cancel" and "Save" icons (exit edit mode)
    - saving indicator (spinning circle, while saving)
- First Name input
- Last Name input
- Sex: dropdown ("Male", "Female")
- Birth Date: date picker
- Email input
- Phone input
- rating row (admin only)
  - Rating input
  - History button (align right)
- "Change Password" button (hide in edit mode)

### Interaction

- validate upon saving
  - email
  - phone (Canadian/US phone number)
  - rating (non-negative integer)
- confirm cancel
- click "Change Password": show "Change Password" dialog, where user enters and confirms the new password (password rules are defined in header.md)
- rating admin adjustment history (with date/time) should be kept in db
- before saving, if the new rating/birth date would render the player unqualified for any future events he has registered, ask the admin to confirm whether to remove the player from those events, if yes, remove the player from those events then save the rating, if no, do nothing
- rating admin adjustment will affect the player's rating in already registered future events. the rating change from match results (between player's registration time of the event and event start time) will not.
- rating history button will show a dialog of the rating admin adjustment history for this player