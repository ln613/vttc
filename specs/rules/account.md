# Accoount Rules

## Account Types

- Super Admin
  - username: nan
  - password: SUPER_ADMIN_HASH (use Argon2 and salt SUPER_ADMIN_SALT)
- Admin
  - username: vttc
  - password: ADMIN_PASSWORD
- Player
  - player with isAdmin = true is a player and an admin
  - player with isSuperAdmin = true is a player and a super admin