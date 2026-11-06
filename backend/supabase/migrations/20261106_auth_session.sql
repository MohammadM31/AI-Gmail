-- Run this in the Supabase SQL editor.
-- Cookie sessions are revoked here. A bearer token used by tests has no row.

create table if not exists "AuthSession" (
  id uuid primary key,
  "userId" uuid not null,
  "organizationId" uuid not null,
  "expiresAt" timestamptz not null,
  revoked boolean not null default false
);

create index if not exists auth_session_user_idx on "AuthSession" ("userId");

alter table "AuthSession" enable row level security;
