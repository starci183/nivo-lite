-- Members add and edit the recurring contracts of their workspace straight from the sales workbench (RLS), no back-end hop.
-- The workbench was read-only for members; the policies check the workspace membership on the row written.

grant insert, update on table public.contracts to authenticated;

drop policy if exists "contracts_member_insert" on public.contracts;
create policy "contracts_member_insert" on public.contracts for insert to authenticated
  with check (public.is_member(workspace_id));

drop policy if exists "contracts_member_update" on public.contracts;
create policy "contracts_member_update" on public.contracts for update to authenticated
  using (public.is_member(workspace_id))
  with check (public.is_member(workspace_id));
