# 0001. Front end, build, local dev and test tooling
Date: 2026-11-25 · Status: accepted

## Context
- The client flow is 5 steps on mostly phones (often from Instagram). Budget: JS under 150 KB gzipped on first load, LCP under 2.5 s (frontend-conventions).
- The admin page is one person's tool: a list, a detail view, a few forms.
- One-person business: every dependency is something that must be upgraded later. Fewer is better.
- Hosting is Netlify: a static `dist/` plus Netlify Functions in `netlify/functions/` (modern `export default async (req: Request, context) => Response` style).
- Hard requirement: the whole app runs and is testable locally with **no accounts or API keys**, and the Netlify CLI is optional.
- Node 22 and npm are installed. TypeScript is preferred.

## Options considered
1. **Vite + vanilla TypeScript, multi-page.** Pros: no runtime framework (0 KB), nothing to upgrade but Vite, plain DOM is easy to make accessible, fast builds. Cons: we write a small DOM helper and manage step state by hand.
2. **Vite + Preact (or Lit).** Pros: components and JSX. Cons: one more runtime dependency and plugin, small but real upgrade burden. The UI is small enough that it doesn't pay for itself.
3. **Astro / Next.js / SvelteKit.** Pros: full frameworks. Cons: SSR adapters, much larger dependency trees, framework-specific Netlify adapters. Over-engineered for 5 steps and one admin page.

## Decision
**Vite 8 + vanilla TypeScript (strict), multi-page build**, with these pages: `index.html` (booking flow), `policies.html`, `privacy.html`, `admin/index.html` (admin app), `admin/password-tool.html` (offline password-hash and TOTP-secret generator, see ADR 0003). The UI uses a tiny `h()` helper in `src/lib/dom.ts` that only sets `textContent` and attributes (never `innerHTML`), so XSS-safe output is the default. Shared validation uses **Zod 4** schemas in `shared/` that both the browser and the Functions import.

**Local dev without the Netlify CLI:** `npm run dev` runs `vite` only. A backend-owned Vite plugin (`netlify/dev/functions-dev-plugin.ts`) loads every file in `netlify/functions/` through `server.ssrLoadModule`, reads each file's exported `config.path` and `config.method`, converts the Node request into a web `Request`, calls the default export, and writes the `Response` back. It also loads `.env` into `process.env` for the functions (Vite only exposes `VITE_*` to the browser, and we use none). Result: front end and API on one origin (`http://localhost:5173`), with hot reload for both. `netlify dev` still works (it is optional), because the functions are standard Netlify functions.

**Tests:** **Vitest 5** for unit and integration tests (environment `node`; `happy-dom` for front-end DOM tests). Integration tests import a function's default export and call it with `new Request(...)`; no server is needed. **Playwright** runs e2e against `npm run dev` (its `webServer`), with the local-file store and file email outbox, and `@axe-core/playwright` for accessibility. **ESLint 10 + typescript-eslint 8** for lint, `tsc --noEmit` for type-checking.

**TypeScript version: 6.0.3, not 7.0.2.** TypeScript 7.0.2 is `latest` on npm (checked 2026-11-25), but `typescript-eslint@8.74.0` declares `peerDependencies.typescript: ">=4.8.4 <6.1.0"`. Pin 6.0.3 until typescript-eslint supports 7.

### Package list (versions verified with `npm view <pkg> version` on 2026-11-25; install with `--save-exact`)
| Package | Version | Kind | Why |
|---|---|---|---|
| `@netlify/blobs` | 11.1.11 | dependency | Production data store (ADR 0002) |
| `luxon` | 3.7.2 | dependency | Time zones and DST (ADR 0006) |
| `zod` | 4.6.7 | dependency | Shared request/config validation |
| `vite` | 8.3.8 | dev | Build and dev server (engines: node `^20.19.0 \|\| >=22.12.0`) |
| `typescript` | 6.0.3 | dev | See note above |
| `@netlify/functions` | 6.1.2 | dev | `Config` and `Context` types only |
| `@types/node` | 22.20.7 | dev | Matches Node 22 runtime |
| `@types/luxon` | 3.7.6 | dev | Types |
| `vitest` | 5.1.2 | dev | Unit/integration tests (engines: node `^22.12.0 \|\| ^24 \|\| >=26`). 5.1.2 was published on 2026-11-25; if it misbehaves, pin 5.1.1 |
| `happy-dom` | 21.0.4 | dev | DOM for front-end unit tests |
| `@playwright/test` | 1.65.1 | dev | E2E (Chromium is pre-installed; don't run `playwright install`) |
| `@axe-core/playwright` | 4.14.1 | dev | Accessibility checks in e2e |
| `eslint` | 10.15.0 | dev | Lint |
| `@eslint/js` | 10.0.1 | dev | Recommended rules (peer: eslint ^10) |
| `typescript-eslint` | 8.74.0 | dev | TS lint rules |
| `globals` | 17.14.0 | dev | Browser/node globals for ESLint |

Deliberately **not** used: `netlify-cli` (optional, install globally if wanted; 27.20.1 on 2026-11-25), `tsx` and `concurrently` (Node 22.18+ strips TypeScript types natively for the one script we run; one dev process), any UI framework, any date library besides Luxon, any email or Stripe SDK (we call REST with `fetch`).

## Consequences
- 3 runtime dependencies. Bundle budget is easy to meet: Luxon (about 23 KB gz) + Zod + app code.
- Developers write plain DOM code. Rules: one component per file under 200 lines, `h()` for all elements, no `innerHTML` (an ESLint `no-restricted-properties` rule enforces it).
- `tsconfig.json` uses `"module": "ESNext"`, `"moduleResolution": "Bundler"`, `"strict": true`, `"noUncheckedIndexedAccess": true`, `"erasableSyntaxOnly": true` (no enums or parameter properties, so `node scripts/*.ts` works), `"verbatimModuleSyntax": true`, `"lib": ["ES2023", "DOM"]`, `"types": ["node"]`. Imports have no file extensions (Vite, Vitest and Netlify's esbuild all resolve them). `package.json` has `"type": "module"` and `"engines": { "node": ">=22.18 <23" }`.
- Netlify builds and runs functions on Node 22 (`NODE_VERSION = "22"` in `netlify.toml`). Netlify's fallback runtime is Node 24 if the build version is not a valid Lambda runtime (docs checked 2026-11-25, https://docs.netlify.com/build/functions/configuration/).
- Revisit if the admin UI grows past roughly 15 screens (then consider Preact), or when typescript-eslint supports TypeScript 7.
