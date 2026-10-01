-- Accounting workbench: corrections are ADDED, never edited into history.
-- An adjustment is a correction note (optionally with the amount it should have been) attached to an invoice or a payment.
-- The original row is never changed. Append-only: members read, owner | manager add, nobody updates or deletes.
create table if not exists public.accounting_adjustments (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  target_type text not null check (target_type in ('invoice', 'transaction')),
  target_id uuid not null,
  note text not null check (char_length(btrim(note)) >= 5),
  corrected_amount_vnd bigint check (corrected_amount_vnd is null or corrected_amount_vnd >= 0),
  created_by text not null,
  created_by_user uuid default auth.uid(),
  created_at timestamptz not null default now()
);

create index if not exists accounting_adjustments_target on public.accounting_adjustments (workspace_id, target_type, target_id, created_at desc);

alter table public.accounting_adjustments enable row level security;

drop policy if exists accounting_adjustments_read on public.accounting_adjustments;
drop policy if exists accounting_adjustments_insert on public.accounting_adjustments;
create policy accounting_adjustments_read on public.accounting_adjustments for select using (public.is_member(workspace_id));
create policy accounting_adjustments_insert on public.accounting_adjustments for insert
  with check (public.is_manager(workspace_id) and created_by_user = auth.uid());
-- no update / delete policy: history is append-only
