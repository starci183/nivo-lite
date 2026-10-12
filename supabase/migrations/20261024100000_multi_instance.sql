-- Multi-instance agents (owner decision 2026-10-12). A workspace may install SEVERAL agents of the same customer-facing type
-- (one Chatbot per branch or Fanpage, one Booking agent per branch, one Lead-gen agent per page or ad account). Back-office types
-- (accounting, inventory, shifts, hiring, sales, loyalty, content, video) stay one per workspace: they are the business's single ledger.
--
--   modules.multi_instance            mirrored from module.json "multi_instance" (scripts/seed-modules.mjs); the three types are set here too
--   module_installations.name         the instance label ("Chatbot – Chi nhánh Q1"); defaults to the type's name, unique per type (case-insensitive)
--   module_installations.is_multi     copied from modules.multi_instance by a trigger; the partial unique index keeps ONE installation per
--                                     (workspace, type) for every single-instance type
--   module_installations.agent_id     unique: every instance has its own agent row, so agent_connections (agent_id) already says which
--                                     instance listens on which connection; no installation_id is needed there
--   installation_id                   the instance that handles a row, on work_items, agent_conversations, leads, bookings and lead_flows;
--                                     filled by triggers (resolve_installation) so no insert site has to know about instances
--   knowledge_sources / brain_facts   installation_id null = shared by every instance of the type (the default); set = only that instance reads it
--   match_knowledge(p_installation)   the lens filter for instance-scoped documents
-- Back-compat: every existing installation becomes the single instance of its type, named after the type, and every existing row is
-- attributed to it. Additive except the dropped unique (workspace_id, module_key) constraint, which the partial index replaces.

-- ---------------------------------------------------------------- registry mirror
alter table public.modules add column if not exists multi_instance boolean not null default false;
update public.modules set multi_instance = true where key in ('chatbot', 'booking', 'lead_gen');

-- ---------------------------------------------------------------- installations: name, is_multi
alter table public.module_installations add column if not exists name text;
alter table public.module_installations add column if not exists is_multi boolean not null default false;

/** The type's display name (Vietnamese, from the mirrored module.json), the fallback label of an instance. */
create or replace function public.module_type_name(p_key text)
returns text language sql stable set search_path = public as $$
  select coalesce(nullif(trim(m.definition #>> '{name,vi}'), ''), initcap(replace(p_key, '_', ' ')))
  from (select p_key as key) k left join public.modules m on m.key = k.key;
$$;

create or replace function public.module_installations_fill()
returns trigger language plpgsql set search_path = public as $$
begin
  new.is_multi := coalesce((select m.multi_instance from public.modules m where m.key = new.module_key), false);
  if new.name is null or trim(new.name) = '' then
    new.name := public.module_type_name(new.module_key);
  end if;
  new.name := left(trim(new.name), 80);
  return new;
end;
$$;
drop trigger if exists module_installations_fill on public.module_installations;
create trigger module_installations_fill before insert or update of module_key, name on public.module_installations
  for each row execute function public.module_installations_fill();

update public.module_installations i
   set name = public.module_type_name(i.module_key),
       is_multi = coalesce((select m.multi_instance from public.modules m where m.key = i.module_key), false)
 where i.name is null or trim(i.name) = '';
alter table public.module_installations alter column name set not null;
alter table public.module_installations drop constraint if exists module_installations_name_length;
alter table public.module_installations add constraint module_installations_name_length check (char_length(name) between 1 and 80);

-- One installation per (workspace, type) for single-instance types; any number (with distinct names) for multi-instance types.
alter table public.module_installations drop constraint if exists module_installations_workspace_id_module_key_key;
create unique index if not exists module_installations_single on public.module_installations (workspace_id, module_key) where not is_multi;
create unique index if not exists module_installations_name_unique on public.module_installations (workspace_id, module_key, lower(name));
create unique index if not exists module_installations_agent_unique on public.module_installations (agent_id) where agent_id is not null;
create index if not exists module_installations_ws_module on public.module_installations (workspace_id, module_key, created_at);

-- ---------------------------------------------------------------- installation_id on the rows an instance handles
alter table public.work_items add column if not exists installation_id uuid references public.module_installations (id) on delete set null;
alter table public.agent_conversations add column if not exists installation_id uuid references public.module_installations (id) on delete set null;
alter table public.leads add column if not exists installation_id uuid references public.module_installations (id) on delete set null;
alter table public.bookings add column if not exists installation_id uuid references public.module_installations (id) on delete set null;
alter table public.lead_flows add column if not exists installation_id uuid references public.module_installations (id) on delete set null;
create index if not exists work_items_installation on public.work_items (workspace_id, installation_id, status, created_at desc);
create index if not exists agent_conversations_installation on public.agent_conversations (workspace_id, installation_id, created_at desc);
create index if not exists leads_installation on public.leads (workspace_id, installation_id);
create index if not exists bookings_installation on public.bookings (workspace_id, installation_id, start_at);
create index if not exists lead_flows_installation on public.lead_flows (workspace_id, installation_id);

-- Instance-scoped knowledge: null = every instance of the type reads it (the default). Deleting an instance deletes what only it could read,
-- so private knowledge of one brand never starts reaching the others.
alter table public.knowledge_sources add column if not exists installation_id uuid references public.module_installations (id) on delete cascade;
alter table public.brain_facts add column if not exists installation_id uuid references public.module_installations (id) on delete cascade;
create index if not exists knowledge_sources_installation on public.knowledge_sources (workspace_id, installation_id) where installation_id is not null;
create index if not exists brain_facts_installation on public.brain_facts (workspace_id, installation_id) where installation_id is not null;
-- One ACTIVE fact per (subject, attribute) per scope: the shared value and each instance's own value may coexist ("Giờ mở cửa" of Q1 and of Q7).
drop index if exists public.brain_facts_one_active;
create unique index if not exists brain_facts_one_active on public.brain_facts
  (workspace_id, subject_key, attribute, coalesce(installation_id, '00000000-0000-0000-0000-000000000000'::uuid)) where status = 'active';

-- ---------------------------------------------------------------- the one resolver: which instance of a type handles this
/**
 * The instance of `p_module` in `p_ws` that a row belongs to, and how it was found (recorded in the event log by the command bus):
 *   conversation  the conversation's own instance (its agent), when it is of this type
 *   connection    the instance of this type whose agent is bound to the connection the conversation came in on (the Chatbot of the Q1
 *                 Fanpage hands a booking to the Booking agent bound to that same Fanpage)
 *   lead          the instance that captured the lead, when it is of this type; else the lead's latest conversation with an instance of this type
 *   chain         an earlier work item of the same chain handled by an instance of this type
 *   single        the only instance of the type
 *   first         several instances and nothing in the chain names one: the oldest (the caller records it)
 * No row when the type is not installed.
 */
create or replace function public.resolve_installation(p_ws uuid, p_module text, p_conversation uuid default null, p_lead uuid default null, p_chain uuid default null)
returns table (installation_id uuid, via text)
language plpgsql stable set search_path = public as $$
declare
  found uuid;
  n int;
begin
  select count(*) into n from public.module_installations i where i.workspace_id = p_ws and i.module_key = p_module;
  if n = 0 then return; end if;
  if n = 1 then
    return query select i.id, 'single'::text from public.module_installations i where i.workspace_id = p_ws and i.module_key = p_module;
    return;
  end if;
  if p_conversation is not null then
    select i.id into found from public.agent_conversations c join public.module_installations i on i.id = c.installation_id
     where c.id = p_conversation and c.workspace_id = p_ws and i.module_key = p_module;
    if found is not null then return query select found, 'conversation'::text; return; end if;
    select i.id into found from public.agent_conversations c
      join public.agent_connections ac on ac.connection_id = c.connection_id
      join public.module_installations i on i.agent_id = ac.agent_id
     where c.id = p_conversation and c.workspace_id = p_ws and c.connection_id is not null and i.module_key = p_module
     order by i.created_at limit 1;
    if found is not null then return query select found, 'connection'::text; return; end if;
  end if;
  if p_lead is not null then
    select i.id into found from public.leads l join public.module_installations i on i.id = l.installation_id
     where l.id = p_lead and l.workspace_id = p_ws and i.module_key = p_module;
    if found is null then
      select i.id into found from public.agent_conversations c join public.module_installations i on i.id = c.installation_id
       where c.lead_id = p_lead and c.workspace_id = p_ws and i.module_key = p_module order by c.created_at desc limit 1;
    end if;
    if found is null then
      select i.id into found from public.lead_flows f join public.module_installations i on i.id = f.installation_id
       where f.lead_id = p_lead and f.workspace_id = p_ws and i.module_key = p_module order by f.created_at desc limit 1;
    end if;
    if found is not null then return query select found, 'lead'::text; return; end if;
  end if;
  if p_chain is not null then
    select w.installation_id into found from public.work_items w join public.module_installations i on i.id = w.installation_id
     where w.workspace_id = p_ws and w.chain_id = p_chain and i.module_key = p_module order by w.created_at limit 1;
    if found is not null then return query select found, 'chain'::text; return; end if;
  end if;
  return query select i.id, 'first'::text from public.module_installations i where i.workspace_id = p_ws and i.module_key = p_module order by i.created_at limit 1;
end;
$$;
grant execute on function public.resolve_installation(uuid, text, uuid, uuid, uuid) to authenticated, service_role;

-- ---------------------------------------------------------------- triggers: rows get their instance where they are made
-- The trigger functions are security definer: a row written by a webhook, the website chat or a member is attributed the same way whatever
-- the writer may read. They only set installation_id on the row being written (and on a lead that has none yet).
create or replace function public.agent_conversations_fill_installation()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.installation_id is null or (tg_op = 'UPDATE' and new.agent_id is distinct from old.agent_id) then
    new.installation_id := (select i.id from public.module_installations i where i.agent_id = new.agent_id);
  end if;
  return new;
end;
$$;
drop trigger if exists agent_conversations_fill_installation on public.agent_conversations;
create trigger agent_conversations_fill_installation before insert or update of agent_id on public.agent_conversations
  for each row execute function public.agent_conversations_fill_installation();

-- A lead captured in a conversation belongs to that conversation's instance (first capture wins; a person can change it).
create or replace function public.agent_conversations_attribute_lead()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.lead_id is not null and new.installation_id is not null then
    update public.leads set installation_id = new.installation_id where id = new.lead_id and installation_id is null;
  end if;
  return null;
end;
$$;
drop trigger if exists agent_conversations_attribute_lead on public.agent_conversations;
create trigger agent_conversations_attribute_lead after insert or update of lead_id on public.agent_conversations
  for each row execute function public.agent_conversations_attribute_lead();

create or replace function public.work_items_fill_installation()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  conv uuid;
begin
  if new.installation_id is null then
    begin
      conv := nullif(new.proposal #>> '{fields,conversation_id}', '')::uuid;
    exception when others then conv := null;
    end;
    if conv is null and new.subject_type = 'conversation' then conv := new.subject_id; end if;
    select r.installation_id into new.installation_id
      from public.resolve_installation(new.workspace_id, new.department, conv, new.lead_id, case when new.chain_id is distinct from new.id then new.chain_id end) r;
  end if;
  return new;
end;
$$;
drop trigger if exists work_items_fill_installation on public.work_items;
create trigger work_items_fill_installation before insert on public.work_items
  for each row execute function public.work_items_fill_installation();

create or replace function public.bookings_fill_installation()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.installation_id is null and new.work_item_id is not null then
    select w.installation_id into new.installation_id from public.work_items w where w.id = new.work_item_id and w.department = 'booking';
  end if;
  if new.installation_id is null then
    select r.installation_id into new.installation_id from public.resolve_installation(new.workspace_id, 'booking', new.conversation_id, new.lead_id, null) r;
  end if;
  return new;
end;
$$;
drop trigger if exists bookings_fill_installation on public.bookings;
create trigger bookings_fill_installation before insert on public.bookings
  for each row execute function public.bookings_fill_installation();

-- A lead-gen prospect belongs to the instance whose agent is bound to the connection it came in on (else its conversation's, else the first).
create or replace function public.lead_flows_fill_installation()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.installation_id is null and new.connection_id is not null then
    select i.id into new.installation_id
      from public.agent_connections ac join public.module_installations i on i.agent_id = ac.agent_id
     where ac.connection_id = new.connection_id and i.module_key = 'lead_gen' and i.workspace_id = new.workspace_id
     order by i.created_at limit 1;
  end if;
  if new.installation_id is null then
    select r.installation_id into new.installation_id from public.resolve_installation(new.workspace_id, 'lead_gen', new.conversation_id, null, null) r;
  end if;
  if new.lead_id is not null and new.installation_id is not null then
    update public.leads set installation_id = new.installation_id where id = new.lead_id and installation_id is null;
  end if;
  return new;
end;
$$;
drop trigger if exists lead_flows_fill_installation on public.lead_flows;
create trigger lead_flows_fill_installation before insert or update of connection_id, lead_id on public.lead_flows
  for each row execute function public.lead_flows_fill_installation();

-- ---------------------------------------------------------------- backfill (one instance per type today)
update public.agent_conversations c set installation_id = i.id
  from public.module_installations i where i.agent_id = c.agent_id and c.installation_id is null;
update public.work_items w set installation_id = i.id
  from public.module_installations i where i.workspace_id = w.workspace_id and i.module_key = w.department and w.installation_id is null;
update public.bookings b set installation_id = i.id
  from public.module_installations i where i.workspace_id = b.workspace_id and i.module_key = 'booking' and b.installation_id is null;
update public.lead_flows f set installation_id = i.id
  from public.module_installations i where i.workspace_id = f.workspace_id and i.module_key = 'lead_gen' and f.installation_id is null;
-- Leads: the instance of their earliest conversation, else of their lead flow.
update public.leads l set installation_id = x.installation_id
  from (select distinct on (c.lead_id) c.lead_id, c.installation_id from public.agent_conversations c
         where c.lead_id is not null and c.installation_id is not null order by c.lead_id, c.created_at) x
 where x.lead_id = l.id and l.installation_id is null;
update public.leads l set installation_id = f.installation_id
  from public.lead_flows f where f.lead_id = l.id and l.installation_id is null and f.installation_id is not null;

-- ---------------------------------------------------------------- retrieval: instance-scoped documents
drop function if exists public.match_knowledge(uuid, text, extensions.vector, text, int, text, text);
create or replace function public.match_knowledge(
  p_workspace uuid, p_module text, p_query_embedding extensions.vector default null, p_query text default '', p_limit int default 8,
  p_audience text default 'internal', p_query_model text default null, p_installation uuid default null
)
returns table (layer text, id uuid, source_id uuid, module text, kind text, title text, content text, score real, visibility text, topic text)
language plpgsql stable security invoker set search_path = public, extensions as $$
declare
  q tsquery;
  words text;
  use_vec boolean := p_query_embedding is not null and p_query_model is not null;
begin
  if not (public.is_member(p_workspace) or coalesce(auth.role(), '') = 'service_role') then
    return;
  end if;
  words := trim(regexp_replace(public.knowledge_fold(p_query), '[^a-z0-9]+', ' ', 'g'));
  if words <> '' then
    q := to_tsquery('simple', array_to_string(regexp_split_to_array(words, '\s+'), ' | '));
  end if;

  return query
  with business as (
    select 'business'::text as layer, c.id, c.source_id, c.module, s.kind, s.title, c.content,
           (case when use_vec and c.embedding is not null and c.embedding_model = p_query_model then greatest(0, 1 - (c.embedding <=> p_query_embedding)) * 0.7 else 0 end
            + case when q is not null then least(1, ts_rank(c.fts, q)) * 0.3 else 0 end)::real as score,
           c.visibility, s.topic,
           (use_vec and c.embedding is not null and c.embedding_model = p_query_model and (c.embedding <=> p_query_embedding) < 0.8)
             or (q is not null and c.fts @@ q) as hit
    from public.knowledge_chunks c
    join public.knowledge_sources s on s.id = c.source_id
    where c.workspace_id = p_workspace and (c.module is null or c.module = p_module)
      and (p_audience <> 'customer' or c.visibility = 'public')
      -- a document restricted to one instance is read by that instance only
      and (s.installation_id is null or s.installation_id = p_installation)
  ),
  nivo as (
    select 'nivo'::text as layer, k.id, null::uuid as source_id, k.module, k.kind, k.title, k.body as content,
           (case when use_vec and k.embedding is not null and k.embedding_model = p_query_model then greatest(0, 1 - (k.embedding <=> p_query_embedding)) * 0.7 else 0 end
            + case when q is not null then least(1, ts_rank(k.fts, q)) * 0.3 else 0 end)::real as score,
           'internal'::text as visibility, null::text as topic,
           (use_vec and k.embedding is not null and k.embedding_model = p_query_model and (k.embedding <=> p_query_embedding) < 0.8)
             or (q is not null and k.fts @@ q) as hit
    from public.nivo_knowledge k
    where k.module in (p_module, 'core')
  ),
  merged as (
    select * from business union all select * from nivo
  )
  select m.layer, m.id, m.source_id, m.module, m.kind, m.title, m.content, m.score, m.visibility, m.topic
  from merged m where m.hit
  order by m.score desc
  limit greatest(1, least(coalesce(p_limit, 8), 40));
end;
$$;
grant execute on function public.match_knowledge(uuid, text, extensions.vector, text, int, text, text, uuid) to authenticated, service_role;
