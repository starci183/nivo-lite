-- Outgoing email per workspace ("Email gửi đi", connection provider 'smtp').
--   connections            + provider 'smtp' (host/port/security/from in public_meta; the password is AES-256-GCM in connection_secrets)
--                          + is_default: ONE default SMTP connection per workspace (the one sendWorkspaceEmail picks)
--   email_messages         every send attempt of src/lib/email/send.ts (sent | failed | no_smtp | blocked | rate_limited | waiting_decision)
--   authority_rules.action + 'send_email': customer-facing mail passes the authority gate like any other AI step (default 'ask')
-- Add 'smtp' to whatever providers the constraint already allows (other lanes add theirs in their own migrations).
do $$
declare d text; v text;
begin
  select pg_get_constraintdef(oid) into d from pg_constraint where conrelid = 'public.connections'::regclass and conname = 'connections_provider_check';
  if d is null then
    v := '''telegram'', ''sepay'', ''zalo_oa'', ''payos'', ''casso''';
  elsif d like '%''smtp''%' then
    return;
  else
    select string_agg('''' || m[1] || '''', ', ') into v from regexp_matches(d, '''([a-z_]+)''', 'g') as m;
  end if;
  alter table public.connections drop constraint if exists connections_provider_check;
  execute 'alter table public.connections add constraint connections_provider_check check (provider in (' || v || ', ''smtp''))';
end $$;
alter table public.connections add column if not exists is_default boolean not null default false;
create unique index if not exists connections_smtp_default on public.connections (workspace_id)
  where provider = 'smtp' and is_default and status <> 'disconnected';

create table public.email_messages (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  connection_id uuid references public.connections (id) on delete set null,
  to_address text not null,
  subject text not null default '',
  purpose text not null default '',
  status text not null check (status in ('sent', 'failed', 'no_smtp', 'blocked', 'rate_limited', 'waiting_decision')),
  via text not null default 'workspace' check (via in ('workspace', 'platform', 'none')),
  provider_message_id text,
  error text,
  refs jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index email_messages_workspace on public.email_messages (workspace_id, created_at desc);
alter table public.email_messages enable row level security;
create policy email_messages_read on public.email_messages for select to authenticated using (public.is_member(workspace_id));
revoke all on public.email_messages from anon, authenticated;
grant select on public.email_messages to authenticated;

-- send_email: the authority action for customer-facing email (department accounting).
alter table public.authority_rules drop constraint if exists authority_rules_action_check;
alter table public.authority_rules add constraint authority_rules_action_check check (action in (
  'reply_customer', 'handoff_lead', 'classify_lead', 'send_follow_up', 'send_quote',
  'confirm_order', 'send_care', 'issue_invoice', 'reconcile_payment', 'send_email'));
insert into public.authority_rules (workspace_id, department, action, mode, limit_vnd, required_fields)
select a.workspace_id, 'accounting', 'send_email', 'ask', null, array['contact']
  from public.authority a
on conflict (workspace_id, department, action) do nothing;
