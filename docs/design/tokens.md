# Design tokens (v1)

> **[PLACEHOLDER]** Every value here is a stand-in until Daniella supplies her logo, palette and fonts. Swap the values, keep the token names. All pairs below were checked against WCAG 2.1 AA (text 4.5:1, large text and UI parts 3:1). Re-check when real brand colors arrive.

Feel: a quiet photography studio. Warm ivory, soft sand, deep cocoa. Lots of air, photos do the talking.

## Colors `[PLACEHOLDER]`

| Token | Hex | Use |
|---|---|---|
| `--color-bg` | `#FBF8F4` | Page background |
| `--color-surface` | `#FFFFFF` | Cards, inputs, dialogs |
| `--color-sand` | `#F1EAE2` | Subtle panels, table stripes |
| `--color-selected` | `#EFE3DA` | Selected card, selected day or time |
| `--color-text` | `#2B2623` | Body and headings |
| `--color-text-muted` | `#665D56` | Helper text, captions |
| `--color-primary` | `#6F4A38` | Buttons, links, selected outline |
| `--color-primary-hover` | `#5A3A2B` | Button hover and pressed |
| `--color-on-primary` | `#FFFFFF` | Text on primary |
| `--color-border` | `#D9D0C7` | Decorative dividers only (not for inputs) |
| `--color-border-strong` | `#8A7F76` | Input, checkbox and card outlines |
| `--color-focus` | `#1F5FA8` | Focus ring |
| `--color-error` / `-bg` | `#B3261E` / `#FDEDEB` | Errors |
| `--color-success` / `-bg` | `#2F6B4F` / `#E8F3EC` | Success, Confirmed |
| `--color-warning` / `-bg` | `#7A4B00` / `#FFF3DC` | Pending deposit, Requested |
| `--color-info` / `-bg` | `#1F4F8A` / `#E8F0FA` | Completed, notices |
| `--color-neutral` / `-bg` | `#4A423C` / `#EDE7E0` | Cancelled, Rescheduled, Expired |

Disabled controls use `--color-border-strong` text on `--color-sand` and are also marked by a strike-through or "unavailable" text, never by color alone (disabled controls are exempt from contrast rules, but stay readable).

### Contrast ratios (computed)

| Text on background | Ratio | Pass |
|---|---|---|
| text `#2B2623` on bg `#FBF8F4` | 14.1:1 | AA, AAA |
| text on surface `#FFFFFF` | 15.0:1 | AA, AAA |
| text on selected `#EFE3DA` | 11.9:1 | AA, AAA |
| muted `#665D56` on bg | 6.1:1 | AA |
| muted on surface | 6.4:1 | AA |
| muted on sand `#F1EAE2` | 5.4:1 | AA |
| on-primary `#FFFFFF` on primary `#6F4A38` | 7.7:1 | AA, AAA |
| on-primary on primary-hover `#5A3A2B` | 10.1:1 | AA, AAA |
| primary (link text) on bg | 7.3:1 | AA, AAA |
| primary on selected | 6.2:1 | AA |
| error `#B3261E` on bg / surface / error-bg | 6.2 / 6.5 / 5.8:1 | AA |
| success `#2F6B4F` on success-bg `#E8F3EC` | 5.5:1 | AA |
| warning `#7A4B00` on warning-bg `#FFF3DC` | 6.7:1 | AA |
| info `#1F4F8A` on info-bg `#E8F0FA` | 7.2:1 | AA |
| neutral `#4A423C` on neutral-bg `#EDE7E0` | 8.0:1 | AA |

| UI component against its background (needs 3:1) | Ratio | Pass |
|---|---|---|
| border-strong `#8A7F76` on bg / surface | 3.7 / 3.9:1 | AA |
| focus `#1F5FA8` on bg / surface | 6.1 / 6.4:1 | AA |

Focus on top of a primary button is only 1.2:1, so the ring always sits **outside** the control with a 2px gap showing the page background (see Focus ring).

## Typography `[PLACEHOLDER]`

- Headings: `"Cormorant Garamond", Georgia, serif` (elegant, light). Body and UI: `"Inter", system-ui, -apple-system, "Segoe UI", sans-serif`. Fallbacks must look fine on their own. Self-host or use `font-display: swap`; max two families, max 4 font files.
- Never go below 16px for inputs (prevents iOS zoom on focus).

| Token | Size / line height | Weight | Use |
|---|---|---|---|
| `--text-display` | 32 / 38 px (40 / 46 at ≥768) | 500 serif | Page `h1` |
| `--text-h2` | 24 / 30 | 500 serif | Section headings |
| `--text-h3` | 18 / 24 | 600 sans | Card titles, group labels |
| `--text-body` | 16 / 24 | 400 sans | Default |
| `--text-small` | 14 / 20 | 400 sans | Helper text, chips, captions |
| `--text-button` | 16 / 20 | 600 sans | Buttons |

Text sizes use `rem` so browser font-size settings and 200% zoom work. Line length 45 to 75 characters.

## Spacing, layout, shape

- Base unit 4px. Scale: `--space-1` 4, `-2` 8, `-3` 12, `-4` 16, `-5` 24, `-6` 32, `-7` 48, `-8` 64.
- Page gutter 16px at 375px, 24px at ≥768. Content max width 560px for the booking flow (centered), 1120px for admin.
- Breakpoints: 375 (design base), 768, 1024.
- Radii: `--radius-sm` 6px (inputs, chips), `--radius-md` 12px (cards, dialogs), `--radius-pill` 999px (chips, buttons are `--radius-sm`).
- Shadow: one soft level only, `0 1px 3px rgb(43 38 35 / 0.12)`, for cards and dialogs.
- Tap targets: at least 44 x 44px (buttons 48px high). 8px minimum between adjacent targets.
- Motion: 150ms ease for hover, 200ms for step change fade. Under `prefers-reduced-motion: reduce`, no transitions or animations (instant changes).

## Focus ring

`outline: 3px solid var(--color-focus); outline-offset: 2px;` on `:focus-visible` for every interactive element. Never `outline: none` without a replacement. On dark or primary backgrounds the 2px offset keeps the ring against the page color.

## Components cheat sheet

- **Primary button:** primary fill, on-primary text, 48px high, full width on mobile. One per screen.
- **Secondary button:** surface fill, 2px primary border, primary text.
- **Text link:** primary, underlined (always underlined in body text).
- **Input:** 48px high, 1px `border-strong`, surface fill, label above, helper below. Error state: 2px `error` border, error icon, error text below.
- **Chip (status):** pill, 14px text, icon plus word, colors from the pairs above.
- **Card (session type):** surface, 1px `border`, `radius-md`; the whole card is one radio-like button. Selected: 2px primary outline and `selected` fill plus a check icon.

## Dark mode
Not in v1. Set `color-scheme: light` so browsers don't auto-darken form controls.
