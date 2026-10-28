-- The authority action catalogue the lite back end (be/) seeds: app_be already reads public.authority_actions (20261012130100); the
-- catalogue seed (cli seed-modules) also upserts it. Nothing here deletes: an action still referenced by a workspace must not disappear.
drop policy if exists "authority_actions_app_be_insert" on public.authority_actions;
create policy "authority_actions_app_be_insert" on public.authority_actions for insert to app_be with check (action is not null);
drop policy if exists "authority_actions_app_be_update" on public.authority_actions;
create policy "authority_actions_app_be_update" on public.authority_actions for update to app_be using (action is not null) with check (action is not null);
grant insert, update on table public.authority_actions to app_be;
