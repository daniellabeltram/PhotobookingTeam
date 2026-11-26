# Changelog

All notable changes to this project are recorded here. Dates are YYYY-MM-DD. The newest release is at the top.

## [1.0.0] - 2026-11-25

First release of the Daniella Beltram Photography booking and intake app.

### Added

- Client booking flow: pick a session type (Portraits, Couples, Families, Events or Holiday Minis), choose an open date and time, fill out the intake form, accept the policies and get a confirmation screen.
- Live availability that respects session length, buffer time, working days, blocked dates and minimum notice. Times are shown in Eastern Time.
- No double bookings: each time slot is reserved in one step on the server, so two clients can't book the same time.
- Event requests: Events bookings wait for Daniella's approval. She can approve them (the client then gets a retainer link) or decline them (the time is released).
- Retainer step: after booking, the client gets a payment link. The booking stays pending until Daniella marks the retainer as received.
- Confirmation emails with a calendar file (.ics) for the client, and a new-booking alert for Daniella.
- Admin page for Daniella:
  - sign-in with a password and optional second-factor code
  - booking list with filters for status, session type and date range
  - booking detail with all intake answers and the accepted policy version
  - status changes: approve or decline a request, mark a retainer paid, confirm without payment, cancel, complete and reschedule
  - resend an email that failed to send
  - block dates and times
  - add Holiday Minis slots by hand
  - export bookings to a CSV file
  - delete a client's personal details on request
- Privacy notice and policies pages.
- Spam protection on the booking form (a hidden field and rate limits).
- Mobile-first design that meets the WCAG 2.1 AA accessibility standard.

### Security

- Admin pages and admin data are available only after sign-in. Sessions expire when idle and after a set maximum time.
- Repeated failed sign-in attempts are blocked for a period.
- Admin pages and responses are not cached or indexed by search engines.
- Logs don't contain client names, emails or phone numbers.
