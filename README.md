# AI Email App

AI-first email for a company. A rough text or voice prompt becomes a short set
of bullets (the critical facts), plus an infographic when figures or facts are
easier to see. It is not a paragraph and not a rich-text letter.

The backlog lives in `PROJECT_TODO.md`.

## What it does

- **Accounts and roles** — Supabase Auth plus an app-issued JWT. Creating an
  organization makes you `STAFF` with the `ADMIN` staff role; joining with an
  invite code makes you a `CLIENT` by default. Staff roles are `IT`, `ADMIN`
  and `SUPER_ADMIN`, and `SUPER_ADMIN` cannot be picked at sign-up. Role checks
  live in `backend/src/middleware/requireRole.ts`. Clients do not see Pipeline,
  Requirements, or Analytics. Projects stays visible: staff get the project
  dashboard, and clients get the conversation board.
- **AI bullets** — `backend/src/services/geminiService.ts` calls OpenAI
  (`OPENAI_API_KEY`, optional `OPENAI_MODEL`). The file name is left over from
  an earlier Gemini version. It returns recipients, subject, bullets, tone and
  a chart or fact spec.
- **Infographics** — figures stated in the prompt become a matplotlib PNG
  (`backend/scripts/render_infographic.py`) stored in the Supabase Storage
  bucket. Chart.js in the browser is the fallback, and it still draws older
  messages that have no image.
- **Mailbox** — Inbox, Sent, Drafts, Scheduled, Spam, Archive, Trash and
  Starred, with unread counts, stars and labels. Trash restores a message.
- **Sending** — mail is delivered inside the organization after a 10 second
  undo window. Recipients are notified over Socket.io (`email:received`).
- **Threads** — thread view with an AI thread summary.
- **Contacts** — add, list and remove contacts, with a per-contact summary and
  thread list.
- **Templates** — save, edit and delete prompts, optionally with a recipient
  and schedule. Use one in the composer or send it now.
- **Projects** — staff create projects for a client account, with a
  description and optional repository and app URLs. The list shows requirement
  and pending-review counts.
- **Pipeline** — a per-contact pipeline generated from a thread: stages,
  comments, overdue and stuck notices, and PDF, CSV and JSON export.
- **Requirements** — requirements extracted from a client thread, modification
  proposals, and staff review (accept, reject, request changes), filterable by
  project.
- **Analytics** — usage counts, frequent topics, topic trends and CSV export.
- **Also** — attachments through signed Supabase Storage URLs, content
  encrypted at rest (AES-256-GCM), dark and light theme, and Socket.io rooms
  per organization.

## Layout

- `backend/` — Express, TypeScript, Supabase (`@supabase/supabase-js`) and
  Socket.io. Prisma Client is not used at runtime.
- `frontend/` — React, TypeScript, Vite, Tailwind and Zustand.

## Run it

Backend (Node 20):

```bash
cd backend
npm install
# create backend/.env (there is no .env.example) with the variables below
npm run dev        # http://localhost:5000
```

Required in `backend/.env`: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`,
`JWT_SECRET`, `OPENAI_API_KEY`, and `ENCRYPTION_KEY` (a base64 32-byte value,
e.g. `openssl rand -base64 32`; the backend throws at startup without it).
Optional: `OPENAI_MODEL`, `FRONTEND_URL` (CORS origin in production),
`SUPABASE_ATTACHMENTS_BUCKET` (default `attachments`), `PORT` (default 5000),
and `REQUIREMENTS_SWEEPER_ENABLED=true` to start the requirements cron jobs.

Infographics need Python 3 with matplotlib: `pip install -r backend/requirements.txt`.
Without Python, no PNG is rendered and the app uses Chart.js. The backend
Docker image includes Python 3 and matplotlib, and the runtime stage copies
`scripts/render_infographic.py`.

Frontend:

```bash
cd frontend
npm install
npm run dev        # http://localhost:5173
```

The frontend has no mock mode. With no `VITE_API_URL` it calls the hosted
backend at `https://ai-gmail-lw6d.onrender.com`. To use a local backend, put
`VITE_API_URL=http://localhost:5000` in `frontend/.env`.

Docker: `docker compose up --build` builds both apps; the backend reads
`backend/.env`.

Supabase: create a private Storage bucket named `attachments` (or set
`SUPABASE_ATTACHMENTS_BUCKET`). Attachments and infographic PNGs are stored
there, and attachments are served through signed URLs.
`backend/prisma/schema.prisma` is a reference copy. It does not yet include
the role columns or the project, pipeline and requirements tables the app
queries, so it is not enough to create the database on its own.

## Tests and CI

`npm test` in `backend/` runs Jest and Supertest, including auth, roles,
requirements, and the matplotlib renderer. That renderer test skips when
Python is missing, and it fails instead of skipping when `CI` is set. CI in
`.github/workflows/ci.yml` installs Python, lints, builds and tests the
backend, builds the backend image and checks that it can write a PNG, and
lints and builds the frontend.

## Next work

Company mail accepts only `@raidtechs.com` accounts in the sender's
organization. Create, reply, forward, and send all reject anything else.
The rest of the backlog is in `PROJECT_TODO.md`.
