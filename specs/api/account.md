# Account APIs

## Sign in

### input

- email/phone
- password

### Prerequisite

- email/phone is either
  - admin username, or
  - email/phone exist in db (players table, matching email or phone)

### Action

- if admin, check admin password
- otherwise, find the account with that email/phone
- if password matchs
  - generate token
- otherwise, error

### Output

return the token or error message
