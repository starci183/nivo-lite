-- The `meta` connector (Facebook Pages + Instagram professional accounts). Additive.
--   connections.provider      + 'meta'          (public_meta: page_id, page_name, ig_id, ig_username; the Page token is AES-256-GCM in connection_secrets)
--   agent_connections.purpose + 'lead_source'   (an agent that receives the leads of a Page's lead ads)
--   inbound_events.channel    + 'instagram'     (Facebook already exists)
--   meta_threads              last message of each person per connection: the 24 hour messaging window
--   meta_comments             each comment seen: its time (private replies last 7 days) and whether it was privately answered (once)
-- The three constraints are rewritten from whatever they allow today (other lanes add their own values in their own migrations).

create or replace function pg_temp.allow_value(tbl regclass, col text, cname text, val text)
returns void language plpgsql as $$
declare d text; v text;
begin
  select pg_get_constraintdef(oid) into d from pg_constraint where conrelid = tbl and conname = cname;
  if d is null then
    raise exception 'constraint % on % not found', cname, tbl;
  end if;
  if d like '%''' || val || '''%' then
    return;
  end if;
  select string_agg('''' || m[1] || '''', ', ') into v from regexp_matches(d, '''([a-z_]+)''', 'g') as m;
  execute format('alter table %s drop constraint %I', tbl, cname);
  execute format('alter table %s add constraint %I check (%s in (%s, %L))', tbl, cname, col, v, val);
end $$;

select pg_temp.allow_value('public.connections'::regclass, 'provider', 'connections_provider_check', 'meta');
select pg_temp.allow_value('public.agent_connections'::regclass, 'purpose', 'agent_connections_purpose_check', 'lead_source');
select pg_temp.allow_value('public.inbound_events'::regclass, 'channel', 'inbound_events_channel_check', 'instagram');

-- A Page/Instagram account belongs to one live connection: the webhook finds its connection by these ids.
create index if not exists connections_meta_page on public.connections ((public_meta ->> 'page_id')) where provider = 'meta';
create index if not exists connections_meta_ig on public.connections ((public_meta ->> 'ig_id')) where provider = 'meta';

create table if not exists public.meta_threads (
  connection_id uuid not null references public.connections (id) on delete cascade,
  platform text not null check (platform in ('facebook', 'instagram')),
  user_id text not null,                 -- PSID / IGSID
  last_user_at timestamptz not null,     -- the person's last message to the Page: the standard window opens here
  primary key (connection_id, platform, user_id)
);
alter table public.meta_threads enable row level security;

create table if not exists public.meta_comments (
  connection_id uuid not null references public.connections (id) on delete cascade,
  comment_id text not null,
  platform text not null check (platform in ('facebook', 'instagram')),
  comment_at timestamptz,
  private_replied_at timestamptz,        -- set once, atomically, before the private reply is sent
  primary key (connection_id, comment_id)
);
alter table public.meta_comments enable row level security;
-- Both tables are written by the service role only (webhook and send helpers); no client policy.
