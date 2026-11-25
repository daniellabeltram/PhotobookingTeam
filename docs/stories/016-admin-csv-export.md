# 016 — CSV export
**Scope:** v1 (02 §1.14)      **Status:** ready      **Priority:** P1
**As** Daniella (admin), **I want** to download bookings as a CSV file, **so that** I have a backup and can use the data in a spreadsheet.

## Acceptance criteria
1. **Given** Daniella is on the booking list with filters set, **When** she chooses "Export CSV", **Then** a file downloads containing exactly the bookings matching the current filters (all pages, not just the visible one).
2. **Given** the file, **When** opened in Excel, Google Sheets and Numbers, **Then** it opens with one header row and one row per booking, UTF-8 characters (e.g. accented names) display correctly, and commas, quotes and line breaks inside answers don't break columns.
3. **Given** the columns, **When** inspected, **Then** they include reference, status, session type, date, start time and end time (ET, header says "ET"), client name, email, phone, preferred contact, people counts, location, every intake answer (type-specific columns blank for other types), policy version, policy accepted at, amount due, amount paid, created at.
4. **Given** an answer starting with `=`, `+`, `-` or `@`, **When** exported, **Then** it is written so spreadsheets treat it as text, not a formula.
5. **Given** a request for the export without a valid admin session, **When** made, **Then** it is refused (story 010 #2).
6. **Given** the filename, **When** downloaded, **Then** it is `bookings-YYYY-MM-DD.csv` using today's ET date.
7. **Given** no booking matches, **When** exported, **Then** the file contains only the header row.

## Out of scope
- Scheduled or emailed exports. Import from CSV.

## Notes / open questions
- The file holds PII; the admin guide should tell Daniella to store it securely.

## Links
Design: docs/design/ (TBD) · API: docs/api.md (TBD) · Tests: docs/test-plans/ (TBD)
