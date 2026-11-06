-- Run this in the Supabase SQL editor. The app does not apply it.
-- Stars, labels, rules, aliases, signatures, delegation, bounce status,
-- folder, and unread move off the per-user Storage JSON file.
-- Each email flag is its own row, so two saves do not overwrite each other.

create table if not exists "MailboxProfile" (
  "userId" uuid primary key,
  "organizationId" uuid not null,
  signature jsonb not null default '[]'::jsonb,
  aliases jsonb not null default '[]'::jsonb,
  lists jsonb not null default '[]'::jsonb,
  "autoReply" jsonb not null default '{"enabled":false,"facts":[],"until":null}'::jsonb,
  rules jsonb not null default '[]'::jsonb,
  shares jsonb not null default '[]'::jsonb,
  access jsonb not null default '[]'::jsonb,
  "autoReplied" jsonb not null default '{}'::jsonb
);

create table if not exists "MailboxEmail" (
  "userId" uuid not null,
  "emailId" uuid not null references "Email"(id) on delete cascade,
  "organizationId" uuid not null,
  meta jsonb not null default '{}'::jsonb,
  primary key ("userId", "emailId")
);

create index if not exists mailbox_email_org_idx on "MailboxEmail" ("organizationId");

alter table "MailboxProfile" enable row level security;
alter table "MailboxEmail" enable row level security;

create or replace function page_mailbox(
  p_user uuid,
  p_org uuid,
  p_folder text,
  p_limit int,
  p_offset int,
  p_text text default '',
  p_subject text default '',
  p_from text default '',
  p_to text default '',
  p_label text default '',
  p_starred boolean default false,
  p_unread boolean default false,
  p_attachment boolean default false,
  p_before timestamptz default null,
  p_after timestamptz default null,
  p_status text default '',
  p_sort text default ''
)
returns table ("emailId" uuid, meta jsonb, total bigint)
language sql
stable
as $$
  with matched as (
    select m."emailId", m.meta, e."createdAt", e.subject, e.status
    from "MailboxEmail" m
    join "Email" e on e.id = m."emailId"
    where m."userId" = p_user
      and m."organizationId" = p_org
      and (
        (p_folder = 'trash' and (e."deletedAt" is not null or m.meta->>'folder' = 'trash'))
        or (
          p_folder <> 'trash'
          and e."deletedAt" is null
          and (
            (p_folder = 'starred' and coalesce((m.meta->>'starred')::boolean, false) and coalesce(m.meta->>'folder', '') <> 'trash')
            or (
              p_folder = 'inbox'
              and (
                m.meta->>'folder' = 'inbox'
                or (
                  m.meta->>'direction' = 'in'
                  and coalesce(m.meta->>'folder', '') not in ('trash', 'spam', 'archive', 'sent', 'drafts', 'scheduled')
                )
              )
            )
            or (p_folder not in ('starred', 'inbox', 'trash') and m.meta->>'folder' = p_folder)
          )
        )
      )
      and (p_text = '' or e.subject ilike '%' || p_text || '%' or coalesce(e."bulletPoints"::text, '') ilike '%' || p_text || '%')
      and (p_subject = '' or e.subject ilike '%' || p_subject || '%')
      and (p_from = '' or coalesce(m.meta->>'from', '') ilike '%' || p_from || '%')
      and (p_to = '' or coalesce(e.recipients::text, '') ilike '%' || p_to || '%')
      and (p_label = '' or coalesce(m.meta->'labels', '[]'::jsonb)::text ilike '%' || p_label || '%')
      and (not p_starred or coalesce((m.meta->>'starred')::boolean, false))
      and (not p_unread or coalesce((m.meta->>'unread')::boolean, false))
      and (not p_attachment or coalesce(e.attachments::text, '[]') not in ('[]', 'null'))
      and (p_before is null or e."createdAt" <= p_before)
      and (p_after is null or e."createdAt" >= p_after)
      and (p_status = '' or e.status = p_status)
  )
  select "emailId", meta, count(*) over () as total
  from matched
  order by
    case when p_sort = 'subject-asc' then lower(subject) end asc,
    case when p_sort = 'subject-desc' then lower(subject) end desc,
    case when p_sort = 'status' then status end asc,
    case when p_sort = 'oldest' then "createdAt" end asc,
    "createdAt" desc
  limit greatest(p_limit, 1)
  offset greatest(p_offset, 0);
$$;

create or replace function unread_mailbox(p_user uuid, p_org uuid)
returns bigint
language sql
stable
as $$
  select count(*)::bigint
  from "MailboxEmail" m
  join "Email" e on e.id = m."emailId"
  where m."userId" = p_user
    and m."organizationId" = p_org
    and e."deletedAt" is null
    and coalesce((m.meta->>'unread')::boolean, false)
    and (
      m.meta->>'folder' = 'inbox'
      or (
        m.meta->>'direction' = 'in'
        and coalesce(m.meta->>'folder', '') not in ('trash', 'spam', 'archive', 'sent', 'drafts', 'scheduled')
      )
    );
$$;
