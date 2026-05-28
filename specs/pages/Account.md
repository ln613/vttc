# Account Page

## Layout

Vertical

- shared header
- "Account" (h1, align left)
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
- Email input
- Phone input
- "Change Password" button (hide in edit mode)

### Interaction

- validate email and phone (Canadian phone number) upon saving
- confirm cancel
- click "Change Password": show "Change Password" dialog, where user enters and confirms the new password (password rules are defined in header.md)
