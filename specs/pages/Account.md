# Account Page

## Layout

Vertical

- shared header
- "Account" (h1, align left)
- Profile Section
- "Sign Out" button

## Profile Section

- titel row
  - "Profile" (h3, align left)
  - action icons (align right), hidden for admin and super admin
    - read only mode: Edit Icon (enter edit mode)
    - edit mode: "Cancel" and "Save" icons (exit edit mode)
    - saving indicator (spinning circle, while saving)
- First Name input
- Last Name input
- Email input
- Phone input
- "Change Password" button

### Interaction

- validate email and phone (Canadian phone number) upon saving
- confirm cancel
- click "Change Password": show "Change Password" dialog, where user enters and confirms the new password
