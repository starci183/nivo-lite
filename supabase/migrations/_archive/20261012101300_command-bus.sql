-- Agent command bus: every work item belongs to a chain (the first command's work item is the chain root) and knows how many hops deep it is.
-- sendCommand (src/lib/agent-commands.ts) refuses depth > 6 and a repeat of the same (command, subject) inside one chain.
alter table public.work_items add column if not exists chain_id uuid;
alter table public.work_items add column if not exists depth integer not null default 0 check (depth >= 0);

-- Backfill from parent_id: the root of each existing hand-off chain and the number of hops from it.
with recursive walk as (
  select id, id as root_id, 0 as hops from public.work_items where parent_id is null
  union all
  select w.id, walk.root_id, walk.hops + 1 from public.work_items w join walk on w.parent_id = walk.id
)
update public.work_items w set chain_id = walk.root_id, depth = walk.hops from walk where w.id = walk.id and w.chain_id is null;
update public.work_items set chain_id = id where chain_id is null;

create index if not exists work_items_chain on public.work_items (workspace_id, chain_id, action);
