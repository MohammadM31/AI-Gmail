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

## Out of scope

- Rich-text or HTML letter bodies. The message stays bullets plus an infographic.
- Paragraph-length emails generated from the prompt.

## Archive

Shipped 2026-11-04:

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
