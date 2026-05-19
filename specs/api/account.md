# Account APIs

## Sign in

### input

- email/phone
- password

### Prerequisite

- valid email address
- email/phone exist in db (players table, matching email or phone)

### Action

- find the account with that email/phone
- if password matchs
  - generate token
- otherwise, error

### Output

return the token or error message

