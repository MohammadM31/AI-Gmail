# Project backlog

This file is the reference for what to build next. Cursor should read it before planning or implementing product work.

- Add every requested feature or next step under **Active** if it is not already listed.
- When an item ships, remove it from **Active** and move it to **Archive** with the date.
- Do not treat **Out of scope** items as work.

## Product rule

Emails are AI summaries of the critical facts, with an infographic that supports those facts. They are not paragraphs and not rich text.

- "Meeting at 7pm, possible prototype review, boss is joining" becomes those three facts, not a written email.
- "The app grew 75% and clients increased 25%" becomes short bullets plus an infographic that shows those numbers.
- Generate the infographic with matplotlib (Python). Chart.js in the browser is only the current stand-in.

## Active

- Run the new SQL in the Supabase SQL editor: `backend/supabase/migrations/20261106_mailbox_tables.sql`, `20261106_auth_session.sql`, and `20261106_tasks.sql`. Until those tables exist, mailbox flags stay on the Storage JSON file, cookie revocation does not survive a restart, and tasks return an empty list.

## Archive

Shipped 2026-11-06:

- Docker image and CI install Python and matplotlib, and a prompt with figures is checked as a PNG.
- An open inbox refreshes when `email:received` fires. Sent refreshes when `email:sent` fires.
- Stars, labels, rules, aliases, signatures, delegation, bounce status, folder, and unread are per-email rows. The mailbox list is paged in the database. `getThread` stays inside the caller's organization.
- README matches Templates, Contacts, roles, threads, analytics, and company mail.
- Voice input has a language choice, and the bullets come back in that language.
- AI and infographic calls are capped per user and per organization.
- Login, compose, inbox, email detail, and projects are labeled for keyboard and narrow screens. No PWA.
- The session is an httpOnly cookie, with refresh and revocation. The token is not stored in `localStorage`.
- Company-mail tests, the infographic PNG test, the Docker CI job, and a Playwright compose/undo test. The Playwright job skips until its secrets are set.
- Removed `item-1.patch`, `item-1b.patch`, `item-2.patch`, and the duplicate pipeline export file.
- Before send, numbers, dates, and times are highlighted and the sender confirms them.
- The sender can change the chart type, edit the title, or turn the graphic off. The same choice shows in the thread.
- Staff can request a daily digest or a per-contact digest. It is 3–5 bullets plus one graphic, stored as an inbox email.
- An action bullet can be tracked as a task on a project or a pipeline stage. The project page lists those tasks.
- Company mail only. A recipient must be an account in this app at `@raidtechs.com`. Anything else is rejected. Mail is not sent through external SMTP.
- A send to a teammate puts an unread message in that teammate's inbox. The label is the subject.

Shipped 2026-11-04:

- Project details can be edited after creation. An email that uses the project name rewrites that brief with the email’s new facts.
- Project list shows the name and its client, with search and a client filter. Add a new project starts as a button. The form asks for the client and a readme-style brief. Repository and app URLs are optional. Statistics and pictures each open on their own page. Clients include organization client accounts and saved contacts.
- Matplotlib infographics. A prompt with real figures becomes a PNG of those figures. A prompt without numbers keeps the bullets and adds a fact graphic only when that is easier to scan. Chart.js remains for older messages that have no image.
- Sending delivers inside the organization after a 10 second undo window. External delivery uses SMTP when `SMTP_HOST` and `SMTP_FROM` are set, and DKIM when `DKIM_PRIVATE_KEY`, `DKIM_DOMAIN`, and `DKIM_SELECTOR` are set. SPF and DMARC stay DNS records on the sending domain. Inbound mail and bounces arrive at `/api/mail/inbound` and `/api/mail/bounce` with `MAIL_WEBHOOK_SECRET`.
- Mailbox folders: Inbox, Sent, Drafts, Scheduled, Spam, Archive, Trash, and Starred. Trash restores a soft-deleted message. Stars, unread count, and labels.
- Reply, reply all, and forward stay short bullets, with a short quoted history. A signature is a list of facts.
- Send to an address that is not a saved contact. Cc, Bcc, send-as aliases, and mailing lists.
- Undo send, schedule send, filter rules, and auto-reply.
- Search operators: `from:`, `to:`, `subject:`, `has:attachment`, `is:starred`, `is:unread`, `label:`, `before:`, and `after:`.
- Shared mailbox delegation, and an `email:received` notification for the recipient.

Already in the repo when this backlog was created (2026-11-04):

- Voice or text prompt into Gemini bullets, subject, recipient extraction, and tone.
- Chart.js panel from model JSON (`/api/ai/generate-chart`, `ChartRenderer`).
- Drafts, send-as-status-change, inbox list, simple search, soft delete.
- Threads of messages the same user created.
- Contacts, templates, attachments through signed Supabase URLs.
- Read receipts stored on the email row.
- Auth, organization invite codes, roles, two-factor, encryption at rest, analytics, org-room Socket.io.

## Out of scope

- Rich-text or HTML letter bodies. The message stays bullets plus an infographic.
- Paragraph-length emails generated from the prompt.
- Mail to addresses outside `@raidtechs.com`, including Gmail and other public inboxes. External SMTP, DKIM, and inbound webhooks are not the delivery path.
