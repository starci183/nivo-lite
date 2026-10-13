-- The Zalo connection wizard without the service role. The browser (a Server Action over the signed-in user) calls one of three database
-- functions; each checks the caller owns the workspace, writes a ticket on the connection row and puts a job on the `zalo_wizard` queue.
-- The back end seals the keys (it alone holds the key), asks Zalo for the permission page, and writes the result next to the ticket in
-- connections.public_meta.wizard, which the wizard reads through RLS.
--   zalo_wizard_start(workspace, name, app id, app secret)  creates the pending connection and seals its keys      (command "app")
--   zalo_wizard_oa_secret(connection, oa secret key)        adds the OA Secret Key that signs every webhook        (command "oa")
--   zalo_wizard_begin(connection)                           builds the Zalo permission URL for "Ket noi Zalo OA"    (command "begin")
-- The secrets wait in zalo_wizard_drafts only until the job has sealed them; the queue payload never carries a secret.

select pgmq.create('zalo_wizard');

create table public.zalo_wizard_drafts (
    connection_id uuid primary key references public.connections (id) on delete cascade,
    app_id text,
    app_secret text,
    oa_secret text,
    created_at timestamptz not null default now()
);

alter table public.zalo_wizard_drafts enable row level security;

-- Only the back end role reads and removes a draft; the functions below write it as their owner.
create policy "zalo_wizard_drafts_app_be_select"
on public.zalo_wizard_drafts for select to app_be
using (connection_id is not null);

create policy "zalo_wizard_drafts_app_be_delete"
on public.zalo_wizard_drafts for delete to app_be
using (connection_id is not null);

revoke all on table public.zalo_wizard_drafts from public, anon, authenticated;
grant select, delete on table public.zalo_wizard_drafts to app_be;

create or replace function public.zalo_wizard_start(p_workspace uuid, p_name text, p_app_id text, p_app_secret text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
    v_connection uuid;
    v_ticket uuid := gen_random_uuid();
    v_name text := left(btrim(coalesce(p_name, '')), 60);
    v_app text := left(btrim(coalesce(p_app_id, '')), 40);
    v_secret text := btrim(coalesce(p_app_secret, ''));
begin
    if p_workspace is null or not public.is_owner(p_workspace) then
        raise exception 'only the owner of the workspace connects a channel' using errcode = '42501';
    end if;
    if length(v_name) < 2 then
        raise exception 'zalo_name' using errcode = '23514';
    end if;
    if v_app !~ '^[0-9]{6,30}$' or length(v_secret) < 8 then
        raise exception 'zalo_fields' using errcode = '23514';
    end if;
    insert into public.connections (workspace_id, provider, name, status, created_by, public_meta)
    values (p_workspace, 'zalo_oa', v_name, 'pending', auth.uid(),
            jsonb_build_object('app_id', v_app, 'wizard', jsonb_build_object('ticket', v_ticket, 'command', 'app', 'state', 'queued')))
    returning id into v_connection;
    -- The sealed keys arrive from the back end; until then the credential is empty and no webhook verifies.
    insert into public.connection_secrets (connection_id, ciphertext, webhook_secret)
    values (v_connection, '', replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', ''));
    insert into public.zalo_wizard_drafts (connection_id, app_id, app_secret) values (v_connection, v_app, v_secret);
    perform public.job_enqueue(
        p_workspace,
        'zalo_wizard',
        'run-zalo-wizard',
        jsonb_build_object('workspaceId', p_workspace, 'connectionId', v_connection, 'command', 'app', 'ticket', v_ticket),
        'zalo-wizard:' || v_ticket
    );
    return v_connection;
end $$;

create or replace function public.zalo_wizard_oa_secret(p_connection uuid, p_oa_secret text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
    v_workspace uuid;
    v_ticket uuid := gen_random_uuid();
    v_key text := btrim(coalesce(p_oa_secret, ''));
begin
    select workspace_id into v_workspace from public.connections where id = p_connection and provider = 'zalo_oa';
    if v_workspace is null or not public.is_owner(v_workspace) then
        raise exception 'only the owner of the workspace connects a channel' using errcode = '42501';
    end if;
    if length(v_key) < 8 or length(v_key) > 200 then
        raise exception 'zalo_keys' using errcode = '23514';
    end if;
    insert into public.zalo_wizard_drafts (connection_id, oa_secret) values (p_connection, v_key)
    on conflict (connection_id) do update set oa_secret = excluded.oa_secret;
    update public.connections
    set public_meta = public_meta || jsonb_build_object('wizard', jsonb_build_object('ticket', v_ticket, 'command', 'oa', 'state', 'queued'))
    where id = p_connection;
    perform public.job_enqueue(
        v_workspace,
        'zalo_wizard',
        'run-zalo-wizard',
        jsonb_build_object('workspaceId', v_workspace, 'connectionId', p_connection, 'command', 'oa', 'ticket', v_ticket),
        'zalo-wizard:' || v_ticket
    );
    return v_ticket;
end $$;

create or replace function public.zalo_wizard_begin(p_connection uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
    v_workspace uuid;
    v_ticket uuid := gen_random_uuid();
begin
    select workspace_id into v_workspace from public.connections where id = p_connection and provider = 'zalo_oa';
    if v_workspace is null or not public.is_owner(v_workspace) then
        raise exception 'only the owner of the workspace connects a channel' using errcode = '42501';
    end if;
    update public.connections
    set public_meta = public_meta || jsonb_build_object('wizard', jsonb_build_object('ticket', v_ticket, 'command', 'begin', 'state', 'queued'))
    where id = p_connection;
    perform public.job_enqueue(
        v_workspace,
        'zalo_wizard',
        'run-zalo-wizard',
        jsonb_build_object('workspaceId', v_workspace, 'connectionId', p_connection, 'command', 'begin', 'ticket', v_ticket),
        'zalo-wizard:' || v_ticket
    );
    return v_ticket;
end $$;

revoke execute on function public.zalo_wizard_start(uuid, text, text, text) from public, anon;
revoke execute on function public.zalo_wizard_oa_secret(uuid, text) from public, anon;
revoke execute on function public.zalo_wizard_begin(uuid) from public, anon;
grant execute on function public.zalo_wizard_start(uuid, text, text, text) to authenticated;
grant execute on function public.zalo_wizard_oa_secret(uuid, text) to authenticated;
grant execute on function public.zalo_wizard_begin(uuid) to authenticated;
