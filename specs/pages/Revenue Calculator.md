# Revenue Calculator Page

## Layout

Vertical

- shared header
- title "Revenue Calculator" (h1, align left)
- Item List

## Item List

- each item:
  - event dropdown (all events)
  - number of participants dropdown (5, 8, 10, 12, 15, 20, 25, 30, 40, 50)
  - registration fee dropdown
  - 1st place prize dropdown
  - 2nd place prize dropdown
  - 3rd place prize dropdown
  - 4th place prize dropdown
  - delete button
    - confirm then delete the item 
  - registration fee and prize dropdown options the same as Event Edit page
  - when an event is selected, all registration fee and prize dropdown should be set based on the value of the selected event, if available
  - show the total registration fee and the total revenue
- add item button
  - button text "Add Event"
  - add another item to the list
- show the total registration fee and the total revenue of all items
- save as template button
  - prompt for a template name
  - if template name already exist, ask whether to override
  - save all items and their selections as a template to DB
- load template button
  - show a list of templates in DB
  - upon select a template, fill the item list
