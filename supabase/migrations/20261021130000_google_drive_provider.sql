-- Drive read grant for the Second Brain import (connection provider 'google_drive': a refresh token with drive.readonly, AES-256-GCM in connection_secrets).
-- Add 'google_drive' to whatever providers the constraint already allows (other lanes add theirs in their own migrations).
do $$
declare d text; v text;
begin
  select pg_get_constraintdef(oid) into d from pg_constraint where conrelid = 'public.connections'::regclass and conname = 'connections_provider_check';
  if d is null then
    v := '''telegram'', ''sepay'', ''zalo_oa'', ''payos'', ''casso'', ''webhook'', ''google'', ''smtp''';
  elsif d like '%''google_drive''%' then
    return;
  else
    select string_agg('''' || m[1] || '''', ', ') into v from regexp_matches(d, '''([a-z_]+)''', 'g') as m;
  end if;
  alter table public.connections drop constraint if exists connections_provider_check;
  execute 'alter table public.connections add constraint connections_provider_check check (provider in (' || v || ', ''google_drive''))';
end $$;
