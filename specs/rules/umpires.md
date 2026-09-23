# Human Umpires

The club may keep a list of the people who umpire, put them on tables for
the day, and record who ran each match.

Off by default: the **Save Umpire Info** setting gates all of it. While it
is off nobody is assigned, nobody is asked, and no match records an umpire.

## The settings

- **Save Umpire Info**, club-wide, default from `saveUmpireInfo` in the
  club config (absent = off). Turning it on adds the Umpires page to the
  Setting page and makes the rest of this apply
- **Max umpires on a table**, default from `maxUmpiresPerTable` in the club
  config (absent = 1)

## Umpires page

Admin only, reached from the Setting page. An **Add Umpire** button, and
one row per umpire.

### Add / Edit dialog

- First Name and Last Name, required, **stored in title case** however they
  were typed
- ID, Phone, Email, all optional

An umpire is identified by their **ID** when they have one and by their
**full name** when they do not — so two people with the same name must be
given IDs to tell them apart, and the second one is refused until they are.

### Each row

- the table they are on today, or a dash
- their name, with ID / phone / email beneath it
- **Assign Table for today**, **Unassign**, **Edit**, **Delete**

Sorted by assigned table number, then by name. Umpires with no table come
last.

### Assigning a table

Uses the same table picker as the tablet flow. A table that already has
**Max umpires on a table** umpires is greyed out — except for the umpire
being moved, to whom their own table is never full.

**An assignment is only for the current day.** It is stored against the
club date it was made for, and a table pinned yesterday is not shown today
and does not count towards any table's limit.

## Who umpired a match

Every match records **`umpiredBy`**: a name from the roster, or `"Admin"`
or `"Public"` for someone who is not on it.

It is written **when the match is finished**, not when it starts, so a
match handed over part-way through records whoever saw it out.

### Being asked

When a match arrives on a tablet's table, the first question — before the
serving side and the ends — is **"Who is umpiring this match?"**. The
choices are:

- the umpires assigned to that table today, and
- in a group match, every player in the group who is not on court,
  anywhere. They are all sitting at the same table waiting their turn, so
  any of them can umpire

It is only asked when there is a real choice. One name and no question is
not a choice, so it is applied without asking; no names at all records
nobody.

An admin records `"Admin"` and a public umpire records `"Public"`, without
being asked — they are not on the roster and answer for themselves. A
Mirror tablet is never asked, because it never finishes a match.

## Where it shows

On the match row, in the bottom-left corner, small: "Umpired by {name}".
