# UX-designer knowledge (Luz)

## Brand
- Daniella Beltram Photography, West Palm Beach FL. The site is daniellabeltram.photography.
- Brand assets (logo, palette, fonts, photos) aren't provided yet, so use marked placeholders and ask via the orchestrator.

## Users and context
- Mostly phone users arriving from Instagram or Google. Outdoor sessions (beach, Palm Beach Island, downtown WPB).
- Holiday Minis must be the fastest flow, with "spots left" urgency.
- Research (docs/03): keep intake short and type-specific; send wardrobe tips in emails, not in the form; state policies in plain language before payment.

## Screens to design (v1)
1. Session type cards 2. Date/time picker 3. Intake (conditional fields) 4. Policy summary + checkbox 5. Confirmation
6. Admin login 7. Admin booking list 8. Booking detail 9. Block dates 10. Emails (client + Daniella)

## Learned
- (Daniella's taste and feedback, dated)

## 2026-11-25 v1 design spec delivered (docs/design/)
- Files: tokens.md, booking-flow.md, admin.md, emails.md. All brand values are `[PLACEHOLDER]` (ivory/sand/cocoa palette, Cormorant Garamond + Inter). Contrast ratios computed and listed in tokens.md.
- Decisions: 5-step indicator "Step N of 5" (confirmation is step 5); Back never clears entries; slot is not held until step 4 submit, so "slot just taken" (409) is handled in step 4 with up to 4 alternatives; Minis = short intake and per-day "spots left"; Events = request wording ("Send my request"); Holiday Minis paid in full.
- Focus ring sits outside controls (3px, 2px offset) because focus blue on the primary button is only 1.2:1.
- Admin: v1 has no Reschedule button (policy applied by hand); manual Holiday Minis slot creation page added as a v1 need; PII kept out of emails and tab titles.
- Open for Daniella: logo/palette/fonts, studio email, favorite locations, portfolio opt-out checkbox, hold hours, Minis rain date, Events reply time.
