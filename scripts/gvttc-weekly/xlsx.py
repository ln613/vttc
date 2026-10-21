"""Build a week's Match Details workbook in the week 3 layout."""
import json
from openpyxl import Workbook
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
from openpyxl.utils import get_column_letter

SRC = '/Users/nanli/Desktop/vttc/scripts/gvttc-weekly/wk.json'
import os, sys
WEEK = int(sys.argv[1])  # python3 xlsx.py <week> [output path]
OUT = sys.argv[2] if len(sys.argv) > 2 else f'/Users/nanli/Documents/t/gvttc/week {WEEK}/GVTTC 2026 Fall - Week {WEEK} Match Details.xlsx'

GREY = PatternFill('solid', fgColor='D9D9D9')
YELLOW = PatternFill('solid', fgColor='FFFF00')
BOLD = Font(bold=True)
CENTER = Alignment(horizontal='center', vertical='center')
LEFT = Alignment(horizontal='left', vertical='center')
LAST_COL = 8


def merge(ws, row, c1, c2, value, **style):
    """Write a value into a merged span and style the whole span."""
    ws.merge_cells(start_row=row, start_column=c1, end_row=row, end_column=c2)
    cell = ws.cell(row=row, column=c1, value=value)
    apply_style(cell, **style)
    for c in range(c1 + 1, c2 + 1):
        apply_style(ws.cell(row=row, column=c), **style)
    return cell


def apply_style(cell, font=None, fill=None, align=None, border=None):
    if font: cell.font = font
    if fill: cell.fill = fill
    if align: cell.alignment = align
    if border: cell.border = border


def rule(ws, row, style, colour='000000'):
    """Draw a horizontal rule across the sheet on the bottom of `row`."""
    side = Side(style=style, color=colour)
    for c in range(1, LAST_COL + 1):
        cell = ws.cell(row=row, column=c)
        cell.border = Border(bottom=side)


def write_title(ws):
    merge(ws, 1, 1, LAST_COL, '2026 GVTTC Seasonal League (Fall)  ---  Match Details',
          font=Font(bold=True, size=18), align=CENTER)
    ws.row_dimensions[1].height = 28

    merge(ws, 2, 2, 3, 'Winner', font=BOLD, fill=YELLOW, align=CENTER)
    merge(ws, 2, 5, 6, 'Loser', font=BOLD, align=CENTER)
    apply_style(ws.cell(row=2, column=7, value='Score'), font=BOLD, align=CENTER)
    apply_style(ws.cell(row=2, column=8, value='Details'), font=BOLD, align=CENTER)
    rule(ws, 2, 'medium')


def write_fixture(ws, row, fx):
    grey_for = lambda team: GREY if team == fx['grey'] else None

    apply_style(ws.cell(row=row, column=1, value=f"Week -{fx['week']}"),
                font=Font(bold=True, underline='single'), align=LEFT)
    merge(ws, row, 2, 3, fx['left'], font=BOLD, fill=grey_for(fx['left']), align=CENTER)
    apply_style(ws.cell(row=row, column=4, value='VS.'),
                font=Font(bold=True, underline='single'), align=CENTER)
    merge(ws, row, 5, 6, fx['right'], font=BOLD, fill=grey_for(fx['right']), align=CENTER)
    apply_style(ws.cell(row=row, column=7, value=fx['final']), font=BOLD, align=CENTER)
    row += 1

    for r in fx['rows']:
        w, l = r['winner'], r['loser']
        apply_style(ws.cell(row=row, column=1, value=r['no']), align=CENTER)
        apply_style(ws.cell(row=row, column=2, value=w['slot']), font=BOLD, fill=grey_for(w['team']), align=CENTER)
        apply_style(ws.cell(row=row, column=3, value=w['name']), fill=grey_for(w['team']), align=LEFT)
        apply_style(ws.cell(row=row, column=5, value=l['slot']), font=BOLD, fill=grey_for(l['team']), align=CENTER)
        apply_style(ws.cell(row=row, column=6, value=l['name']), fill=grey_for(l['team']), align=LEFT)
        apply_style(ws.cell(row=row, column=7, value=r['score']), font=BOLD, align=CENTER)
        apply_style(ws.cell(row=row, column=8, value=r['details']), align=LEFT)
        row += 1

    rule(ws, row, 'mediumDashed')
    return row + 2  # the rule's row, then a blank one before the next fixture


def set_widths(ws):
    for col, width in zip('ABCDEFGH', [9, 5, 27, 5, 5, 27, 8, 22]):
        ws.column_dimensions[col].width = width


def build():
    fixtures = json.load(open(SRC))
    wb = Workbook()
    ws = wb.active
    ws.title = f'Week {WEEK}'
    ws.sheet_view.showGridLines = False
    set_widths(ws)
    write_title(ws)

    row = 4
    for fx in fixtures:
        row = write_fixture(ws, row, fx)

    ws.freeze_panes = 'A3'
    ws.page_setup.orientation = 'portrait'
    ws.page_setup.fitToWidth = 1
    ws.sheet_properties.pageSetUpPr.fitToPage = True
    wb.save(OUT)
    print(f'{OUT}\n{len(fixtures)} fixtures, {sum(len(f["rows"]) for f in fixtures)} matches, {row - 1} rows')


build()