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

### Infographics

- Generate chart and infographic images with matplotlib instead of returning Chart.js JSON for the browser.
- When the prompt has real figures (growth, client counts, comparisons), the image must show those figures.
- When the prompt has no numbers, keep the bullets and add a graphic only if it makes a fact easier to see.

### Mail in and out

- Deliver a sent message to the recipient. "Send" today only sets `status` to `sent` in Supabase.
- Receive inbound mail into the inbox.
- Record bounces and delivery status.
- Send with SPF, DKIM, and DMARC once mail leaves the app.

### Mailbox

- Separate Sent, Drafts, Spam, Archive, and Trash. Trash should restore a soft-deleted message.
- Stars or flags, unread state, and an unread count.
- Custom labels.

### Conversation

- Reply, reply all, and forward, still as short AI summaries rather than essays.
- Quoted history on a reply, kept short.
- A per-user signature made of the same short facts, not a rich-text block.

### Addressing

- Let the user send to an address that is not already a saved contact.
- Cc and Bcc.
- Send-as aliases and mailing lists.

### Delivery controls

- Undo send.
- Schedule send.
- Filters and rules.
- Auto-reply.

### Search

- Search operators such as `from:`, `has:attachment`, and a date range. Current search matches a recipient name.

### Shared mail

- Shared inbox and delegation.
- Notify the user when new mail arrives. The current realtime event is only `email:sent` inside the organization.

## Out of scope

- Rich-text or HTML letter bodies. The message stays bullets plus an infographic.
- Paragraph-length emails generated from the prompt.

## Archive

Already in the repo when this backlog was created (2026-11-04):

- Voice or text prompt into Gemini bullets, subject, recipient extraction, and tone.
- Chart.js panel from model JSON (`/api/ai/generate-chart`, `ChartRenderer`).
- Drafts, send-as-status-change, inbox list, simple search, soft delete.
- Threads of messages the same user created.
- Contacts, templates, attachments through signed Supabase URLs.
- Read receipts stored on the email row.
- Auth, organization invite codes, roles, two-factor, encryption at rest, analytics, org-room Socket.io.
