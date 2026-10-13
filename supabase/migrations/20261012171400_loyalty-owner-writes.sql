-- The owner workbench of the loyalty agent writes the programme, the rewards and the contact details of a customer straight
-- through row level security (modules/db/loyalty/write-*.ts). Points, tiers, stock and the ledger stay with the server: the
-- loyalty_post function and the api run as the service roles, so nothing here grants those columns to the web role.

grant insert, update on table public.loyalty_programs to authenticated;
drop policy if exists "loyalty_programs_manager_insert" on public.loyalty_programs;
create policy "loyalty_programs_manager_insert" on public.loyalty_programs for insert to authenticated
    with check (public.is_manager(workspace_id));
drop policy if exists "loyalty_programs_manager_update" on public.loyalty_programs;
create policy "loyalty_programs_manager_update" on public.loyalty_programs for update to authenticated
    using (public.is_manager(workspace_id)) with check (public.is_manager(workspace_id));

grant insert, update, delete on table public.loyalty_rewards to authenticated;
drop policy if exists "loyalty_rewards_manager_insert" on public.loyalty_rewards;
create policy "loyalty_rewards_manager_insert" on public.loyalty_rewards for insert to authenticated
    with check (public.is_manager(workspace_id));
drop policy if exists "loyalty_rewards_manager_update" on public.loyalty_rewards;
create policy "loyalty_rewards_manager_update" on public.loyalty_rewards for update to authenticated
    using (public.is_manager(workspace_id)) with check (public.is_manager(workspace_id));
drop policy if exists "loyalty_rewards_manager_delete" on public.loyalty_rewards;
create policy "loyalty_rewards_manager_delete" on public.loyalty_rewards for delete to authenticated
    using (public.is_manager(workspace_id));

-- A customer: the owner may fix the name, the contacts, the birthday and the note, never the tier (the ledger moves it).
grant update (name, phone, email, birthday, note, updated_at) on table public.loyalty_customers to authenticated;
drop policy if exists "loyalty_customers_manager_update" on public.loyalty_customers;
create policy "loyalty_customers_manager_update" on public.loyalty_customers for update to authenticated
    using (public.is_manager(workspace_id)) with check (public.is_manager(workspace_id));
