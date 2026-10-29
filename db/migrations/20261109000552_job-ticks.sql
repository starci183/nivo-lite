-- The scheduler ticks of platform/jobs (R335): one row per tick holds the last UTC minute it fired. Every replica's
-- @nestjs/schedule fires the tick; under advisoryXactLock('tick:<name>') job_tick_claim moves the row to the new minute and
-- answers claimed, so exactly one replica enqueues the tick's job per minute and a replica that comes later answers not claimed.
create table public.job_ticks (
    name varchar(200) not null,
    minute varchar(16) not null,
    constraint job_ticks_pkey primary key (name)
);

alter table public.job_ticks enable row level security;
alter table public.job_ticks force row level security;

create policy job_ticks_app_be_select
on public.job_ticks for select to app_be
using (name is not null);

create policy job_ticks_app_be_insert
on public.job_ticks for insert to app_be
with check (name is not null);

create policy job_ticks_app_be_update
on public.job_ticks for update to app_be
using (name is not null)
with check (name is not null);

revoke all on table public.job_ticks from public, anon, authenticated;
grant select, insert, update on table public.job_ticks to app_be;

create function public.job_tick_claim(p_name varchar, p_minute varchar)
returns table (claimed boolean)
language sql
as $$
    with moved as (
        insert into public.job_ticks as t (name, minute) values (p_name, p_minute)
        on conflict (name) do update set minute = excluded.minute
         where t.minute < excluded.minute
        returning true as claimed
    )
    select coalesce((select m.claimed from moved as m), false)
$$;

revoke all on function public.job_tick_claim(varchar, varchar) from public, anon, authenticated;
grant execute on function public.job_tick_claim(varchar, varchar) to app_be;
