-- Run this in the Supabase SQL editor. It does not change mailbox tables.

create table if not exists "Task" (
  id uuid primary key default gen_random_uuid(),
  "organizationId" uuid not null,
  "userId" uuid not null,
  title text not null,
  "projectId" uuid,
  "pipelineStageId" text,
  "emailId" uuid,
  "createdAt" timestamptz not null default now()
);

create index if not exists task_org_project_idx on "Task" ("organizationId", "projectId");

alter table "Task" enable row level security;
