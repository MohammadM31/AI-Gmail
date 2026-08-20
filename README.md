# AI Email App

Full-stack scaffold matching the original spec: multi-tenant AI email composer
(voice + text → bullets + charts via Gemini), contacts, templates, threaded
inbox, analytics dashboard, dark/light theme, Socket.io, Supabase Auth,
Docker, and CI.

## What's implemented

### backend/  (Express + TypeScript + Supabase + Gemini + Socket.io)
- **Auth** — `authController.ts` wired to real Supabase Auth (`signUp` /
  `signInWithPassword`), creates an `Organization` + `User` row on register.
  JWT verified per-request in `middleware/auth.ts`; `middleware/tenant.ts`
  scopes every data route to `organizationId`.
- **AI** — `geminiService.ts` calls Gemini with a strict JSON-shape prompt;
  `aiController.ts` exposes `/process`, `/generate-chart`,
  `/suggest-recipients`, `/analyze-topics`. Every AI call is audit-logged
  (`auditService.ts`) and tracked (`analyticsService.ts`).
- **Emails** — full CRUD + send + read-receipts + thread fetch +
  AI thread-summarize, in `emailController.ts` / `emailRoutes.ts`. Content is
  encrypted at rest with AES-256-GCM (`utils/encryption.ts`) and decrypted on
  read.
- **Contacts** — CRUD + fuzzy search; `recipientResolver.ts` matches
  AI-extracted names against saved contacts.
- **Templates** — CRUD, public/private.
- **Analytics** — usage counts, AI-derived frequent topics, CSV export.
- **Realtime** — `realtime/socket.ts`: authenticated Socket.io, rooms per
  organization, emits `email:sent`.
- **Security/production** — helmet, CORS scoped to `FRONTEND_URL`, rate
  limiting (100/min/user), zod validation on every write, pino structured
  logging, centralized error handler.
- **Tests/CI/Docker** — one Jest+Supertest test (`__tests__/health.test.ts`,
  extend from here), ESLint config, `Dockerfile`, and
  `.github/workflows/ci.yml` (lint + build + test for both apps).
- **Prisma schema** (`prisma/schema.prisma`) kept as the source of truth for
  migrations — runtime queries go through `@supabase/supabase-js` directly
  rather than Prisma Client.

### frontend/  (React + TS + Vite + Tailwind + Zustand)
- **Auth** — `AuthScreen.tsx` (login/register), session in `userStore.ts`
  (persisted to localStorage), app is gated behind it.
- **Composer** — text + voice input, recipient autocomplete against
  contacts, template quick-picks, editable bullets + Chart.js panel,
  save-as-draft.
- **Inbox** — `EmailList` (search) → `EmailDetail` (send, view chart).
- **Contacts** — add/remove UI.
- **Templates** — save + browse + "use in composer".
- **Analytics dashboard** — usage counts, AI-derived topics, CSV export
  link.
- **Settings** — profile, sign out, tone/chart-type defaults (session-only —
  see note in the component for the endpoint to wire up next).
- **Theme** — persistent dark/light toggle, Gmail-style layout.
- **Mock mode** — with no `VITE_API_URL` set, every API call
  (`services/apiClient.ts`) falls back to realistic in-memory mock data, so
  the entire UI — including inbox, contacts, templates, analytics — is
  fully clickable with zero setup.
- **Error handling** — `ErrorBoundary.tsx` wraps the app (see `main.tsx`).

## Known gaps / next steps
- E2E tests (Playwright) and Prettier config aren't included.
- PWA/offline support isn't included.
- There's still no per-user role system (owner/admin/member) — anyone in an
  org can view/rotate its invite code. Add a `role` column on `User` and gate
  `regenerateInviteCode` on it.
- Real unit/integration test coverage beyond the one health check.
- `updateEmail`/`updateContact` write `req.body` straight through without a
  zod schema — fine for now since routes are already tenant/owner-scoped,
  but worth tightening.

## Recently closed gaps
- **Auth/JWT** — `login`/`register` used to hand the frontend Supabase's own
  session token, but that token has no `organizationId` claim, so every
  tenant-scoped route (`requireTenant`) would silently reject real (non-mock)
  requests. The backend now mints its own JWT (`utils/jwt.ts`) after Supabase
  verifies the credentials, embedding `sub` + `organizationId`. Both
  endpoints now return `{ user, token }` instead of `{ user, session }`.
- **Organizations & invites** — added an `Organization` table (was
  referenced in code but never modeled) with a unique `inviteCode`.
  `POST /api/auth/register` now takes either `organizationName` (create a
  new org) or `inviteCode` (join an existing one). `GET/POST
  /api/auth/org/invite-code[/regenerate]` let a member view or rotate the
  code; it's surfaced in Settings with a copy button.
- **Settings persistence** — `GET/PUT /api/users/settings`
  (`settingsController.ts`) reads/writes the `UserSettings` table. The
  Settings screen saves on change instead of holding state only in memory.
- **Attachments** — `POST /api/emails/attachments/upload-url` returns a
  signed Supabase Storage upload URL; the frontend PUTs the file directly to
  Storage (bytes never pass through the Express process), then attaches
  `{name, path, size, type}` to the email on save. `GET
  /api/emails/attachments/signed-url?path=...` mints a 10-minute signed
  download URL, scoped so a caller can only ever request paths under their
  own `organizationId` prefix. Requires a Storage bucket (see below).

## I still could not verify a real build

This sandbox has no network access, so `npm install` fails (403 from the
npm registry) — I could not run `tsc`, `vite build`, `jest`, or actually hit
Gemini/Supabase from here. Everything is written against current, standard
APIs for the pinned versions and I read back through it for consistency
(shared types between routes/controllers, matching import paths, a
`vite-env.d.ts` for `import.meta.env`, ambient `SpeechRecognition` types),
but please run it for real and tell me what breaks — I'll fix it against
actual output rather than guesses.

## Run it

```bash
# frontend — works immediately, mock data, no keys needed
cd frontend
npm install
npm run dev            # http://localhost:5173

# backend — needs real keys for Gemini/Supabase/JWT to actually work
cd backend
cp .env.example .env   # fill in JWT_SECRET, SUPABASE_*, GEMINI_API_KEY, ENCRYPTION_KEY
npm install
npm run dev             # http://localhost:5000

# connect frontend -> real backend instead of mock:
# frontend/.env -> VITE_API_URL=http://localhost:5000

# or run both via Docker:
docker compose up --build
```

Supabase setup: create the tables in `prisma/schema.prisma` (now includes
`Organization`, with a unique `inviteCode` column), enable Row Level
Security, and create a Storage bucket named `attachments` (or set
`SUPABASE_ATTACHMENTS_BUCKET` to whatever you name it) — private, not
public, since access goes through the signed-URL endpoints only.

`ENCRYPTION_KEY` (backend/.env) must be a 32-byte value, base64-encoded —
e.g. generate one with `openssl rand -base64 32`.



## Business Requirements

### Problem Statement
In today's fast-paced business environment, speed-to-action is critical. However, traditional email communication remains inefficient for quickly converting ideas into actions. Despite AI advancements in email (paraphrasing, bullet summaries), the core email experience remains text-heavy and lacks visual elements, causing delays in decision-making and action.

### Goal
To create an AI-powered email application that accelerates idea communication and decision-making by automatically converting rough prompts into structured, visually enhanced emails.

### Core Requirements

#### 1. User Input
- Users can **type** or **speak** (voice input) their message
- Input is a rough, informal prompt (not a polished email)
- Example: *"Send quarterly sales report to John showing 20% growth"*

#### 2. AI Processing
The AI (Gemini) must automatically:
- **Extract recipients** from the prompt (e.g., "John" → John Doe)
- **Generate a subject line** relevant to the content
- **Create 3-7 concise bullet points** summarizing key information
- **Generate a visual representation** (chart/graph) if numeric data is present
- **Detect tone** (professional/casual/urgent)

#### 3. Output Display
- **Split view layout**:
  - Left: Editable bullet-point summary
  - Right: AI-generated chart/visual
- **Running summary** above the composer (AI-generated thread summary)
- **Recipient chips** displayed above the composer

#### 4. User Review & Send
- Users can **edit** bullet points before sending
- Users can **confirm by clicking "SEND"**
- Users can **save as draft** for later

#### 5. Email Management
- **Thread view** showing conversation history
- **Inbox** listing all sent/ drafted emails
- **Search** functionality within emails
- **Delete** emails (soft delete)

#### 6. Contacts & Recipients
- AI extracts recipient names from prompts
- Auto-suggest recipients from saved contacts
- Add/remove contacts manually
- Contact usage tracking (for suggestions)

#### 7. Templates
- Pre-built templates: "Sales Report", "Meeting Summary", "Project Update"
- Users can save custom templates
- Templates auto-fill the composer prompt

#### 8. Analytics
- Track usage: AI calls, emails sent, voice inputs, charts generated
- Display most frequent conversation topics
- Export analytics as CSV

#### 9. User Experience
- **Dark/Light theme toggle** (persistent)
- **Mobile-responsive** design
- **Gmail-like** email layout with sidebar navigation
- **Real-time** updates (Socket.io)

### Technology Stack

| Component | Technology |
|-----------|------------|
| **Frontend** | React + TypeScript + Vite + Tailwind CSS |
| **State Management** | Zustand |
| **Backend** | Node.js + Express + TypeScript |
| **Database** | Supabase (PostgreSQL) |
| **AI** | Google Gemini API |
| **Voice Input** | Web Speech API |
| **Charts** | Chart.js |
| **Real-time** | Socket.io |
| **Deployment** | Vercel (Frontend) + Render (Backend) |

### Feature Status

| Feature | Status |
|---------|--------|
| Voice Input | ✅ Complete |
| AI Generation (Bullets + Charts) | ✅ Complete |
| Split View | ✅ Complete |
| Send Email | ✅ Complete |
| Save Draft | ✅ Complete |
| Inbox | ✅ Complete |
| Dark/Light Theme | ✅ Complete |
| Templates | ⚠️ Partially Complete (Mock Data) |
| Contacts | ⚠️ Partially Complete (CRUD in progress) |
| Running Summary | ⚠️ Partially Complete (Component exists) |
| Thread View | ⚠️ Partially Complete (Component exists) |
| Analytics | ⚠️ Partially Complete (UI exists) |

### Key User Flows

#### Flow 1: Generate and Send Email