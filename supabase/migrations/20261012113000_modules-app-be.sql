-- The module catalogue the lite back end (be/) seeds: its role app_be reads and upserts public.modules and public.authority_actions
-- (cli seed-modules) under row level security. Nothing here deletes: a module still referenced by a workspace must not disappear.
drop policy if exists "modules_app_be_select" on public.modules;
create policy "modules_app_be_select" on public.modules for select to app_be using (key is not null);
drop policy if exists "modules_app_be_insert" on public.modules;
create policy "modules_app_be_insert" on public.modules for insert to app_be with check (key is not null);
drop policy if exists "modules_app_be_update" on public.modules;
create policy "modules_app_be_update" on public.modules for update to app_be using (key is not null) with check (key is not null);
grant select, insert, update on table public.modules to app_be;

drop policy if exists "authority_actions_app_be_select" on public.authority_actions;
create policy "authority_actions_app_be_select" on public.authority_actions for select to app_be using (action is not null);
drop policy if exists "authority_actions_app_be_insert" on public.authority_actions;
create policy "authority_actions_app_be_insert" on public.authority_actions for insert to app_be with check (action is not null);
drop policy if exists "authority_actions_app_be_update" on public.authority_actions;
create policy "authority_actions_app_be_update" on public.authority_actions for update to app_be using (action is not null) with check (action is not null);
grant select, insert, update on table public.authority_actions to app_be;
