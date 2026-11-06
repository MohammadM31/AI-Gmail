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

- Install Python and matplotlib in the Docker image and in CI, and test that an infographic prompt returns a PNG. The current image is Node only, so a deployed chart is missing.
- When `email:received` fires, put the message in the open inbox. The toast already shows. Also refresh the sender when `email:sent` fires.
- Move stars, labels, rules, aliases, signatures, delegation, and bounce status out of the per-user Storage JSON into tables. Two saves at once can overwrite that file, and starred or label search has to load the whole file.
- Page the mailbox in the database. `getThread` should limit the query to the caller's organization before it checks each message.
- Rewrite the README so Templates, Contacts, roles, threads, and analytics match what has shipped.
- Voice input is fixed to `en-US`. Add a language choice, and return the bullets in the language that was spoken.
- Cap AI and infographic calls per user and per organization. The shared 100-per-minute limit does not cover a prompt that calls the model, runs Python, and uploads a PNG.
- Accessibility and a mobile pass. Add keyboard access and the missing labels. A PWA is still out of scope.
- Store the session in an httpOnly cookie, with refresh and revocation. The token is in `localStorage` today.
- Tests for delivery, the infographic fallback, and tenant checks on `getThread`. A browser test for compose, undo, and send. CI should build the Docker image.
- Remove `item-1.patch`, `item-1b.patch`, `item-2.patch`, and the duplicate pipeline export file.
- Before send, highlight numbers, dates, and times in the bullets and ask the sender to confirm them.
- Let the sender change the chart type, edit the title, or turn the graphic off. Show the same graphic in old threads.
- A daily or per-contact digest: bullets plus one graphic.
- Turn action bullets into tasks linked to a project or a pipeline stage.
- Company mail only. A recipient must be an account created in this app, and the address must end in `@raidtechs.com`. Reject any other address. Do not send through external SMTP.
- Deliver inside the company. Sending to `hadi@raidtechs.com` puts an unread message in Hadi's inbox when Hadi signs in. The label is the subject and the unread state.

## Out of scope

- Rich-text or HTML letter bodies. The message stays bullets plus an infographic.
- Paragraph-length emails generated from the prompt.
- Mail to addresses outside `@raidtechs.com`, including Gmail and other public inboxes. External SMTP, DKIM, and inbound webhooks are not the delivery path.

## Archive

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
