-- starci:baseline 20261025120000
-- Lite baseline, re-cut at the canon database standard (alpha.18): the same schema as the previous baseline chain (lite-baseline, lite-baseline-standard,
-- job-ops-functions), whose files moved unchanged to supabase/migrations/_archive/. A database that applied that chain is marked as having applied this
-- version (be/docs/runbooks/cutover.md) and then takes the *_contract_* migrations that follow, which close the browser doors, retire the engine objects
-- and move the queue ticks to migration-owned cron jobs; on a database created from this file every one of them is a no-op or an upsert.

-- Extensions the schema uses (the platform ones - pgcrypto, uuid-ossp, supabase_vault - come with the stack).
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;
CREATE EXTENSION IF NOT EXISTS pgmq;
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS unaccent WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS vector WITH SCHEMA extensions;

-- The database role of the back end (be/); its password is set once by the owner, never in a migration.
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'app_be') THEN
        CREATE ROLE app_be LOGIN NOINHERIT;
    END IF;
END
$$;

--
-- PostgreSQL database dump
--

-- Dumped from database version 17.11
-- Dumped by pg_dump version 17.11

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: be_access; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA be_access;

--
-- Name: public; Type: SCHEMA; Schema: -; Owner: -
--

--
-- Name: SCHEMA public; Type: COMMENT; Schema: -; Owner: -
--

--
-- Name: user_emails(uuid[]); Type: FUNCTION; Schema: be_access; Owner: -
--

CREATE FUNCTION be_access.user_emails(p_ids uuid[]) RETURNS TABLE(id uuid, email text, last_sign_in_at timestamp with time zone)
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO ''
    AS $$
    select u.id, u.email::text, u.last_sign_in_at from auth.users u where u.id = any (p_ids);
$$;

--
-- Name: accept_invite(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.accept_invite(token text) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'extensions', 'auth'
    AS $$
declare
  inv public.workspace_invites;
  uid uuid := auth.uid();
  mail text;
begin
  if uid is null then raise exception 'not_signed_in' using errcode = 'P0001'; end if;
  select * into inv from public.workspace_invites i where i.token_hash = encode(extensions.digest(token, 'sha256'), 'hex') for update;
  if not found then raise exception 'invite_invalid' using errcode = 'P0001'; end if;
  if inv.revoked_at is not null then raise exception 'invite_revoked' using errcode = 'P0001'; end if;
  if inv.accepted_at is not null then raise exception 'invite_used' using errcode = 'P0001'; end if;
  if inv.expires_at < now() then raise exception 'invite_expired' using errcode = 'P0001'; end if;
  select u.email into mail from auth.users u where u.id = uid;
  if lower(coalesce(mail, '')) <> lower(inv.email) then raise exception 'invite_email_mismatch' using errcode = 'P0001'; end if;
  insert into public.workspace_members (workspace_id, user_id, role, staff_id, display_name)
  values (inv.workspace_id, uid, inv.role, inv.staff_id,
          coalesce((select s.name from public.staff s where s.id = inv.staff_id), public.display_name_of(uid)))
  on conflict (workspace_id, user_id) do update
    set role = case when public.workspace_members.role = 'owner' then 'owner' else excluded.role end,
        staff_id = coalesce(excluded.staff_id, public.workspace_members.staff_id), status = 'active';
  update public.workspace_invites set accepted_at = now(), accepted_by = uid where id = inv.id;
  return inv.workspace_id;
end;
$$;

--
-- Name: add_lead_responsibility(uuid, uuid, text, text, text, timestamp with time zone, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.add_lead_responsibility(p_workspace uuid, p_lead uuid, p_title text, p_owner text, p_next_action text, p_due timestamp with time zone DEFAULT NULL::timestamp with time zone, p_locale text DEFAULT 'vi'::text) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_actor text := public.lead_actor_name(p_workspace);
  v_en boolean := coalesce(p_locale, 'vi') = 'en';
  v_owner record;
  v_row public.responsibilities;
begin
  if not exists (select 1 from public.leads l where l.workspace_id = p_workspace and l.id = p_lead) then
    raise exception 'RESPONSIBILITIES_LEAD_NOT_FOUND' using errcode = 'P0002';
  end if;
  select * into v_owner from public.lead_step_owner(p_workspace, p_owner, v_actor);
  insert into public.responsibilities (workspace_id, lead_id, title, owner_kind, owner_agent_id, owner_name, next_action, due_at)
  values (p_workspace, p_lead, p_title, v_owner.o_kind, v_owner.o_agent, v_owner.o_name, p_next_action, p_due)
  returning * into v_row;
  insert into public.events (workspace_id, lead_id, kind, actor, summary)
  values (p_workspace, p_lead, 'responsibility.assigned', v_actor,
          case when v_en then 'Owner: ' || v_row.owner_name || ' · Next action: ' || v_row.next_action
               else 'Người phụ trách: ' || v_row.owner_name || ' · Bước tiếp theo: ' || v_row.next_action end);
  return public.lead_step_json(v_row);
end;
$$;

--
-- Name: admin_console_audit(text, uuid, jsonb); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.admin_console_audit(p_action text, p_workspace uuid DEFAULT NULL::uuid, p_data jsonb DEFAULT '{}'::jsonb) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
begin
  if not public.is_platform_admin() then
    raise exception 'not_platform_admin' using errcode = '42501';
  end if;
  insert into public.platform_audit (actor_email, actor_id, action, workspace_id, data)
  values (lower(btrim(auth.jwt() ->> 'email')), auth.uid(), left(p_action, 80), p_workspace, coalesce(p_data, '{}'::jsonb));
end;
$$;

--
-- Name: admin_console_quota(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.admin_console_quota(p_workspace uuid) RETURNS jsonb
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_result jsonb;
begin
  if not public.is_platform_admin() then
    raise exception 'not_platform_admin' using errcode = '42501';
  end if;
  select jsonb_build_object('credits_used', q.credits_used, 'credits_limit', q.credits_limit, 'cost_usd', q.cost_usd)
    into v_result
    from public.ai_quota_status(p_workspace) q
    limit 1;
  return v_result;
end;
$$;

--
-- Name: admin_console_signups(integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.admin_console_signups(p_days integer DEFAULT 14) RETURNS TABLE(day date, signups integer)
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
begin
  if not public.is_platform_admin() then
    raise exception 'not_platform_admin' using errcode = '42501';
  end if;
  return query select s.day, s.signups from public.admin_signups_per_day(p_days) s;
end;
$$;

--
-- Name: admin_console_user_emails(uuid[]); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.admin_console_user_emails(p_ids uuid[]) RETURNS TABLE(id uuid, email text, last_sign_in_at timestamp with time zone)
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
begin
  if not public.is_platform_admin() then
    raise exception 'not_platform_admin' using errcode = '42501';
  end if;
  return query
    select u.id, u.email::text, u.last_sign_in_at from auth.users u where u.id = any (p_ids);
end;
$$;

--
-- Name: admin_console_workspace_stats(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.admin_console_workspace_stats() RETURNS TABLE(workspace_id uuid, members integer, last_customer_message_at timestamp with time zone, messages_7d integer, open_decisions integer)
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
begin
  if not public.is_platform_admin() then
    raise exception 'not_platform_admin' using errcode = '42501';
  end if;
  return query select s.workspace_id, s.members, s.last_customer_message_at, s.messages_7d, s.open_decisions from public.admin_workspace_stats() s;
end;
$$;

--
-- Name: admin_extend_subscription(uuid, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.admin_extend_subscription(p_workspace uuid, p_days integer) RETURNS timestamp with time zone
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_before timestamptz;
  v_after timestamptz;
begin
  if not public.is_platform_admin() then
    raise exception 'not_platform_admin' using errcode = '42501';
  end if;
  if p_days is null or p_days < 1 or p_days > 3650 then
    raise exception 'days_invalid' using errcode = '22023';
  end if;
  select w.paid_until into v_before from public.workspaces w where w.id = p_workspace for update;
  if not found then
    raise exception 'WORKSPACES_NOT_FOUND' using errcode = 'P0002';
  end if;
  v_after := greatest(coalesce(v_before, to_timestamp(0)), now()) + make_interval(days => p_days);
  perform set_config('nivo.billing_writer', 'on', true);
  update public.workspaces set paid_until = v_after where id = p_workspace;
  perform set_config('nivo.billing_writer', 'off', true);
  insert into public.platform_audit (actor_email, actor_id, action, workspace_id, data)
  values (lower(btrim(auth.jwt() ->> 'email')), auth.uid(), 'workspace.extend', p_workspace,
          jsonb_build_object('days', p_days, 'from', v_before, 'to', v_after));
  return v_after;
end;
$$;

--
-- Name: admin_set_workspace_plan(uuid, text, bigint); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.admin_set_workspace_plan(p_workspace uuid, p_plan text, p_credits bigint DEFAULT NULL::bigint) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_before text;
  v_plan text;
begin
  if not public.is_platform_admin() then
    raise exception 'not_platform_admin' using errcode = '42501';
  end if;
  if p_credits is not null and p_credits < 0 then
    raise exception 'credits_invalid' using errcode = '22023';
  end if;
  select p.code into v_plan from public.plans p where p.code = p_plan and p.active = true;
  if not found then
    raise exception 'WORKSPACES_PLAN_UNKNOWN' using errcode = 'P0002';
  end if;
  select w.plan_code into v_before from public.workspaces w where w.id = p_workspace for update;
  if not found then
    raise exception 'WORKSPACES_NOT_FOUND' using errcode = 'P0002';
  end if;
  perform set_config('nivo.billing_writer', 'on', true);
  update public.workspaces set plan_code = v_plan where id = p_workspace;
  perform set_config('nivo.billing_writer', 'off', true);
  insert into public.ai_quota_overrides (workspace_id, credits_limit, updated_at)
  values (p_workspace, p_credits, now())
  on conflict (workspace_id) do update set credits_limit = excluded.credits_limit, updated_at = excluded.updated_at;
  insert into public.platform_audit (actor_email, actor_id, action, workspace_id, data)
  values (lower(btrim(auth.jwt() ->> 'email')), auth.uid(), 'workspace.set_plan', p_workspace,
          jsonb_build_object('from', v_before, 'to', v_plan, 'creditsTo', p_credits));
  return jsonb_build_object('planCode', v_plan, 'creditsLimit', p_credits);
end;
$$;

--
-- Name: admin_set_workspace_status(uuid, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.admin_set_workspace_status(p_workspace uuid, p_status text) RETURNS text
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_before text;
begin
  if not public.is_platform_admin() then
    raise exception 'not_platform_admin' using errcode = '42501';
  end if;
  if p_status not in ('active', 'past_due') then
    raise exception 'status_invalid' using errcode = '22023';
  end if;
  select w.status into v_before from public.workspaces w where w.id = p_workspace for update;
  if not found then
    raise exception 'WORKSPACES_NOT_FOUND' using errcode = 'P0002';
  end if;
  perform set_config('nivo.billing_writer', 'on', true);
  update public.workspaces set status = p_status where id = p_workspace;
  perform set_config('nivo.billing_writer', 'off', true);
  insert into public.platform_audit (actor_email, actor_id, action, workspace_id, data)
  values (lower(btrim(auth.jwt() ->> 'email')), auth.uid(), 'workspace.set_status', p_workspace,
          jsonb_build_object('from', v_before, 'to', p_status));
  return p_status;
end;
$$;

--
-- Name: admin_signups_per_day(integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.admin_signups_per_day(p_days integer DEFAULT 14) RETURNS TABLE(day date, signups integer)
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public', 'auth'
    AS $$
  select (u.created_at at time zone 'Asia/Ho_Chi_Minh')::date, count(*)::int
  from auth.users u
  where u.created_at > now() - make_interval(days => greatest(1, least(p_days, 90)))
  group by 1 order by 1 desc;
$$;

--
-- Name: admin_workspace_stats(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.admin_workspace_stats() RETURNS TABLE(workspace_id uuid, members integer, last_customer_message_at timestamp with time zone, messages_7d integer, open_decisions integer)
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select
    w.id,
    (select count(*)::int from public.workspace_members m where m.workspace_id = w.id and m.status = 'active'),
    (select max(am.created_at) from public.agent_messages am join public.agent_conversations c on c.id = am.conversation_id
       where am.workspace_id = w.id and am.role = 'user' and c.kind = 'customer'),
    (select count(*)::int from public.agent_messages am join public.agent_conversations c on c.id = am.conversation_id
       where am.workspace_id = w.id and am.role = 'user' and c.kind = 'customer' and am.created_at > now() - interval '7 days'),
    (select count(*)::int from public.work_items wi where wi.workspace_id = w.id and wi.status = 'waiting_decision')
  from public.workspaces w;
$$;

--
-- Name: agent_chat_send(uuid, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.agent_chat_send(p_conversation uuid, p_body text) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
    v_workspace uuid;
    v_kind text;
    v_holder text;
    v_body text := btrim(coalesce(p_body, ''));
    v_name text;
    v_message uuid;
    v_by_person boolean;
begin
    if v_body = '' or length(v_body) > 4000 then
        raise exception 'agent_chat_body' using errcode = '23514';
    end if;
    select workspace_id, kind, handled_by into v_workspace, v_kind, v_holder from public.agent_conversations where id = p_conversation;
    if v_workspace is null or not public.is_member(v_workspace) then
        raise exception 'only a member of the workspace writes in a conversation' using errcode = '42501';
    end if;
    -- While a person holds a customer conversation the AI stays quiet and the member writes as the company.
    v_by_person := v_kind = 'customer' and v_holder is not null;
    if v_by_person then
        select display_name into v_name from public.workspace_members
        where workspace_id = v_workspace and user_id = auth.uid() and status = 'active';
        insert into public.agent_messages (workspace_id, conversation_id, role, body, author_kind, author_name)
        values (v_workspace, p_conversation, 'agent', v_body, 'human', v_name)
        returning id into v_message;
    else
        insert into public.agent_messages (workspace_id, conversation_id, role, body)
        values (v_workspace, p_conversation, 'user', v_body)
        returning id into v_message;
    end if;
    perform public.job_enqueue(
        v_workspace,
        'chat_turn',
        case when v_by_person then 'chat-turn.deliver' else 'chat-turn.turn' end,
        jsonb_build_object(
            'kind', case when v_by_person then 'deliver' else 'turn' end,
            'workspaceId', v_workspace,
            'conversationId', p_conversation,
            'messageId', v_message,
            'channelEventId', 'agentchat:' || v_message,
            'lookupName', false
        ),
        case when v_by_person then 'chat-turn.deliver:' else 'chat-turn.turn:' end || v_message
    );
    return v_message;
end $$;

--
-- Name: agent_chat_start(uuid, text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.agent_chat_start(p_agent uuid, p_kind text, p_visitor text DEFAULT NULL::text) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
    v_workspace uuid;
    v_greeting text;
    v_conversation uuid;
    v_visitor text := nullif(left(btrim(coalesce(p_visitor, '')), 80), '');
begin
    if p_kind is null or p_kind not in ('test', 'customer') then
        raise exception 'agent_chat_kind' using errcode = '23514';
    end if;
    select workspace_id, greeting into v_workspace, v_greeting from public.agents where id = p_agent;
    if v_workspace is null or not public.is_member(v_workspace) then
        raise exception 'only a member of the workspace opens a conversation' using errcode = '42501';
    end if;
    if p_kind = 'test' and v_visitor is null then
        select display_name into v_visitor from public.workspace_members
        where workspace_id = v_workspace and user_id = auth.uid() and status = 'active';
    end if;
    insert into public.agent_conversations (workspace_id, agent_id, kind, visitor_name)
    values (v_workspace, p_agent, p_kind, v_visitor)
    returning id into v_conversation;
    if coalesce(v_greeting, '') <> '' then
        insert into public.agent_messages (workspace_id, conversation_id, role, body)
        values (v_workspace, v_conversation, 'agent', v_greeting);
    end if;
    return v_conversation;
end $$;

--
-- Name: agent_chat_take_over(uuid, boolean, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.agent_chat_take_over(p_conversation uuid, p_take boolean, p_line text DEFAULT ''::text) RETURNS text
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
    v_workspace uuid;
    v_name text;
    v_holder text;
begin
    select workspace_id into v_workspace from public.agent_conversations where id = p_conversation;
    if v_workspace is null or not public.is_member(v_workspace) then
        raise exception 'only a member of the workspace takes a conversation over' using errcode = '42501';
    end if;
    select display_name into v_name from public.workspace_members
    where workspace_id = v_workspace and user_id = auth.uid() and status = 'active';
    v_holder := case when p_take then coalesce(v_name, 'staff') else null end;
    update public.agent_conversations
    set handled_by = v_holder, handled_at = case when p_take then now() else null end
    where id = p_conversation;
    if btrim(coalesce(p_line, '')) <> '' then
        insert into public.agent_messages (workspace_id, conversation_id, role, body)
        values (v_workspace, p_conversation, 'system', replace(left(p_line, 400), '{user}', coalesce(v_name, '')));
    end if;
    return coalesce(v_holder, '');
end $$;

--
-- Name: agent_connections_same_workspace(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.agent_connections_same_workspace() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
begin
  if not exists (select 1 from public.agents a where a.id = new.agent_id and a.workspace_id = new.workspace_id)
     or not exists (select 1 from public.connections c where c.id = new.connection_id and c.workspace_id = new.workspace_id) then
    raise exception 'agent and connection must belong to the same workspace';
  end if;
  return new;
end $$;

--
-- Name: agent_conversations_attribute_lead(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.agent_conversations_attribute_lead() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
begin
  if new.lead_id is not null and new.installation_id is not null then
    update public.leads set installation_id = new.installation_id where id = new.lead_id and installation_id is null;
  end if;
  return null;
end;
$$;

--
-- Name: agent_conversations_fill_installation(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.agent_conversations_fill_installation() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
begin
  if new.installation_id is null or (tg_op = 'UPDATE' and new.agent_id is distinct from old.agent_id) then
    new.installation_id := (select i.id from public.module_installations i where i.agent_id = new.agent_id);
  end if;
  return new;
end;
$$;

--
-- Name: ai_credit_period(uuid, date); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.ai_credit_period(p_workspace uuid, p_period date) RETURNS TABLE(used numeric, base bigint, carry numeric, credits_limit bigint)
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  with p as (
    select p_period as d,
           (p_period - interval '1 month')::date as pd,
           (p_period + interval '1 month')::date as nd
  ), u as (
    select
      coalesce(sum(ceil(e.cost_usd / public.credit_usd_value())) filter (where (e.created_at at time zone 'Asia/Ho_Chi_Minh')::date >= p.d), 0) as cost,
      coalesce(sum(ceil(e.cost_usd / public.credit_usd_value())) filter (where (e.created_at at time zone 'Asia/Ho_Chi_Minh')::date < p.d), 0) as prev_cost
    from public.ai_usage_events e, p
    where e.workspace_id = p_workspace and e.kind <> 'guide'
      and (e.created_at at time zone 'Asia/Ho_Chi_Minh')::date >= p.pd
      and (e.created_at at time zone 'Asia/Ho_Chi_Minh')::date < p.nd
  ), k as (
    select coalesce(sum(x.credits), 0) as credits
    from public.credit_pack_purchases x, p
    where x.workspace_id = p_workspace and x.period = p.d
  ), b as (
    select
      p.d, p.pd, w.created_at, o.credits_limit as own_limit, pl.credits_rollover,
      coalesce(
        o.credits_limit,
        case when pl.per_seat
             then coalesce(w.tier_credits, pl.ai_credits_per_month) * greatest(coalesce(w.seat_count, 1), 1)
             else pl.ai_credits_per_month end
      ) as base
    from p
    left join public.workspaces w on w.id = p_workspace
    left join public.plans pl on pl.code = w.plan_code
    left join public.ai_quota_overrides o on o.workspace_id = p_workspace
  ), c as (
    select b.*,
      case
        when b.own_limit is null and coalesce(b.credits_rollover, false) and b.base is not null
             and (b.created_at at time zone 'Asia/Ho_Chi_Minh')::date < b.d
        then greatest(0, least(
          b.base::numeric,
          b.base::numeric * least(1, (b.d - greatest(b.pd, (b.created_at at time zone 'Asia/Ho_Chi_Minh')::date))::numeric / (b.d - b.pd))
            - (select u.prev_cost from u)))
        else 0
      end as carry
    from b
  )
  select u.cost, c.base, c.carry,
         case when c.base is null then null else floor(c.base + c.carry + (select k.credits from k))::bigint end
  from c cross join u;
$$;

--
-- Name: ai_quota_status(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.ai_quota_status(p_workspace uuid) RETURNS TABLE(period_start date, messages_used bigint, tokens_used bigint, cost_usd numeric, messages_limit integer, tokens_limit bigint, fallback_reply text, credits_used numeric, credits_limit bigint, credits_carried numeric, topup_balance bigint)
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  with p as (
    select date_trunc('month', now() at time zone 'Asia/Ho_Chi_Minh')::date as d
  ), u as (
    select
      count(*) filter (where e.kind = 'chat_reply') as messages,
      coalesce(sum(e.prompt_tokens + e.completion_tokens) filter (where e.kind <> 'guide'), 0) as tokens,
      coalesce(sum(e.cost_usd) filter (where e.kind <> 'guide'), 0) as cost
    from public.ai_usage_events e, p
    where e.workspace_id = p_workspace
      and (e.created_at at time zone 'Asia/Ho_Chi_Minh')::date >= p.d
  ), cr as (
    select * from public.ai_credit_period(p_workspace, (select d from p))
  ), t as (
    select
      coalesce((select sum(k.credits_remaining) from public.credit_topups k
                where k.workspace_id = p_workspace and k.credits_remaining > 0 and k.expires_at > now()), 0) as lots,
      coalesce((select dr.drawn from public.credit_topup_draws dr
                where dr.workspace_id = p_workspace and dr.period = (select d from p)), 0) as drawn
  )
  select
    p.d,
    u.messages,
    u.tokens::bigint,
    u.cost,
    coalesce(o.messages_limit, pl.ai_messages_per_month),
    coalesce(o.tokens_limit, pl.ai_tokens_per_month),
    o.fallback_reply,
    cr.used,
    cr.credits_limit,
    round(cr.carry, 2),
    case when cr.credits_limit is null then 0
         else greatest(0, t.lots - greatest(0, ceil(greatest(0, cr.used - cr.credits_limit)) - t.drawn))::bigint
    end
  from p
  cross join u
  cross join cr
  cross join t
  left join public.workspaces w on w.id = p_workspace
  left join public.plans pl on pl.code = w.plan_code
  left join public.ai_quota_overrides o on o.workspace_id = p_workspace;
$$;

--
-- Name: ai_usage_events_settle(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.ai_usage_events_settle() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
begin
  if new.kind = 'guide' or new.cost_usd <= 0 then return null; end if;
  if not exists (
    select 1 from public.credit_topups where workspace_id = new.workspace_id and credits_remaining > 0 and expires_at > now()
  ) then
    return null;
  end if;
  begin
    perform public.settle_credit_topups(new.workspace_id);
  exception when others then
    raise warning 'settle_credit_topups failed for %: %', new.workspace_id, sqlerrm;
  end;
  return null;
end;
$$;

--
-- Name: api_key_auth(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.api_key_auth(p_hash text) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare k public.api_keys; v_hits int;
begin
  select * into k from public.api_keys where key_hash = p_hash;
  if not found then return null; end if;
  if k.revoked_at is not null then return jsonb_build_object('revoked', true); end if;
  v_hits := public.api_rate_hit(k.id);
  -- informational, so at most one write a minute per key
  if k.last_used_at is null or k.last_used_at < now() - interval '1 minute' then
    update public.api_keys set last_used_at = now() where id = k.id;
  end if;
  return jsonb_build_object('id', k.id, 'workspace_id', k.workspace_id, 'name', k.name, 'scopes', to_jsonb(k.scopes), 'hits', v_hits);
end $$;

--
-- Name: api_key_create(uuid, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.api_key_create(p_workspace uuid, p_name text) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'extensions'
    AS $$
declare
  v_name text := left(regexp_replace(btrim(coalesce(p_name, '')), '\s+', ' ', 'g'), 60);
  v_key text;
  v_row public.api_keys;
  v_actor text;
begin
  if not public.is_manager(p_workspace) then raise exception 'not allowed' using errcode = '42501'; end if;
  if char_length(v_name) < 2 then raise exception 'name too short' using errcode = '22023'; end if;
  if (select count(*) from public.api_keys where workspace_id = p_workspace and revoked_at is null) >= 20 then
    raise exception 'too many active keys' using errcode = '23514';
  end if;
  v_key := 'nvk_' || translate(trim(trailing '=' from encode(gen_random_bytes(32), 'base64')), '+/', '-_');
  insert into public.api_keys (workspace_id, name, key_prefix, key_hash, created_by)
  values (p_workspace, v_name, left(v_key, 12), encode(digest(v_key, 'sha256'), 'hex'), auth.uid())
  returning * into v_row;
  select m.display_name into v_actor from public.workspace_members m where m.workspace_id = p_workspace and m.user_id = auth.uid();
  insert into public.events (workspace_id, kind, actor, summary, evidence)
  values (p_workspace, 'api.key_created', coalesce(v_actor, ''), 'API key created: ' || v_name, v_row.key_prefix);
  return jsonb_build_object(
    'key', v_key,
    'item', jsonb_build_object('id', v_row.id, 'name', v_row.name, 'prefix', v_row.key_prefix, 'createdAt', v_row.created_at, 'lastUsedAt', null, 'revokedAt', null)
  );
end $$;

--
-- Name: api_key_revoke(uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.api_key_revoke(p_workspace uuid, p_key uuid) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_row public.api_keys;
  v_actor text;
begin
  if not public.is_manager(p_workspace) then raise exception 'not allowed' using errcode = '42501'; end if;
  update public.api_keys set revoked_at = now()
  where id = p_key and workspace_id = p_workspace and revoked_at is null
  returning * into v_row;
  if not found then raise exception 'key not found' using errcode = '22023'; end if;
  select m.display_name into v_actor from public.workspace_members m where m.workspace_id = p_workspace and m.user_id = auth.uid();
  insert into public.events (workspace_id, kind, actor, summary, evidence)
  values (p_workspace, 'api.key_revoked', coalesce(v_actor, ''), 'API key revoked: ' || v_row.name, v_row.key_prefix);
  return jsonb_build_object(
    'id', v_row.id, 'name', v_row.name, 'prefix', v_row.key_prefix, 'createdAt', v_row.created_at,
    'lastUsedAt', v_row.last_used_at, 'revokedAt', v_row.revoked_at
  );
end $$;

--
-- Name: api_rate_hit(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.api_rate_hit(p_key uuid) RETURNS integer
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare v_window timestamptz := date_trunc('minute', now()); v_hits int;
begin
  insert into public.api_rate_limits as r (key_id, window_start, hits) values (p_key, v_window, 1)
  on conflict (key_id, window_start) do update set hits = r.hits + 1
  returning r.hits into v_hits;
  if random() < 0.02 then delete from public.api_rate_limits where window_start < now() - interval '1 hour'; end if;
  return v_hits;
end $$;

--
-- Name: app_errors_record(text, text, text, uuid, uuid, jsonb); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.app_errors_record(p_scope text, p_message text, p_stack text, p_ws uuid, p_connection uuid, p_ctx jsonb) RETURNS void
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
declare
  v_ws uuid := p_ws;
begin
  if v_ws is null and p_connection is not null then
    select c.workspace_id into v_ws from public.connections c where c.id = p_connection;
  end if;
  insert into public.app_errors (scope, message, stack, workspace_id, ctx)
  values (left(coalesce(p_scope, ''), 200), left(coalesce(p_message, ''), 4000), left(p_stack, 8000), v_ws, coalesce(p_ctx, '{}'::jsonb));
end
$$;

--
-- Name: assign_lead_responsibility(uuid, uuid, text, text, timestamp with time zone, text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.assign_lead_responsibility(p_workspace uuid, p_responsibility uuid, p_owner text, p_next_action text, p_due timestamp with time zone DEFAULT NULL::timestamp with time zone, p_title text DEFAULT NULL::text, p_locale text DEFAULT 'vi'::text) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_actor text := public.lead_actor_name(p_workspace);
  v_en boolean := coalesce(p_locale, 'vi') = 'en';
  v_owner record;
  v_row public.responsibilities;
begin
  select * into v_owner from public.lead_step_owner(p_workspace, p_owner, v_actor);
  update public.responsibilities
     set owner_kind = v_owner.o_kind, owner_agent_id = v_owner.o_agent, owner_name = v_owner.o_name,
         next_action = p_next_action, due_at = p_due, title = coalesce(p_title, title)
   where workspace_id = p_workspace and id = p_responsibility
  returning * into v_row;
  if not found then
    raise exception 'RESPONSIBILITIES_NOT_FOUND' using errcode = 'P0002';
  end if;
  insert into public.events (workspace_id, lead_id, kind, actor, summary)
  values (p_workspace, v_row.lead_id, 'responsibility.assigned', v_actor,
          case when v_en then 'Owner: ' || v_row.owner_name || ' · Next action: ' || v_row.next_action
               else 'Người phụ trách: ' || v_row.owner_name || ' · Bước tiếp theo: ' || v_row.next_action end);
  return public.lead_step_json(v_row);
end;
$$;

--
-- Name: automation_command_enqueue(uuid, text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.automation_command_enqueue(p_workspace uuid, p_kind text, p_template text) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_id uuid;
begin
  if (select auth.uid()) is null or not public.is_manager(p_workspace) then
    raise exception 'automation_command_enqueue: not a manager of the workspace' using errcode = '42501';
  end if;
  insert into public.automation_commands (workspace_id, kind, template_key, created_by)
  values (p_workspace, p_kind, p_template, (select auth.uid()))
  returning id into v_id;
  perform public.job_enqueue(p_workspace, 'automation', 'automation.command',
    jsonb_build_object('commandId', v_id), 'automation.command:' || v_id::text);
  return v_id;
end $$;

--
-- Name: automations_data(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.automations_data(ws uuid) RETURNS jsonb
    LANGUAGE sql STABLE
    SET search_path TO 'public'
    AS $$
  select jsonb_build_object(
    'installations', coalesce((select jsonb_agg(jsonb_build_object('module_key', i.module_key, 'operating_mode', i.operating_mode,
                                  'ctx', (select jsonb_build_object('id', v.id, 'version', v.version, 'snapshot', v.snapshot)
                                          from module_context_versions v where v.id = i.active_context_version_id)) order by i.created_at)
                               from module_installations i where i.workspace_id = ws), '[]'::jsonb),
    'pipelines', coalesce((select jsonb_agg(to_jsonb(p)) from automation_pipelines p where p.workspace_id = ws), '[]'::jsonb),
    'runs', coalesce((select jsonb_agg(jsonb_build_object('id', r.id, 'pipeline_id', r.pipeline_id, 'trigger_ref', r.trigger_ref, 'status', r.status,
                                  'steps', r.steps, 'evidence', r.evidence, 'error', r.error, 'created_at', r.created_at, 'finished_at', r.finished_at)
                                  order by r.created_at desc)
                      from (select * from automation_runs where workspace_id = ws order by created_at desc limit 80) r), '[]'::jsonb),
    'google', (select jsonb_build_object('id', c.id, 'status', c.status, 'last_error', c.last_error, 'public_meta', c.public_meta, 'name', c.name)
               from connections c where c.workspace_id = ws and c.provider = 'google' and c.status <> 'disconnected' order by c.created_at limit 1),
    'knowledge', coalesce((select jsonb_agg(jsonb_build_object('title', k.title, 'content', k.content))
                           from (select title, content from knowledge_sources where workspace_id = ws limit 60) k), '[]'::jsonb),
    'due_invoices', (select count(*) from invoices where workspace_id = ws and due_at is not null),
    'connections', coalesce((select jsonb_agg(jsonb_build_object('provider', c.provider, 'status', c.status))
                             from connections c where c.workspace_id = ws and c.status <> 'disconnected'), '[]'::jsonb),
    'chat_agents', (select count(*) from agents where workspace_id = ws and module in ('chatbot', 'booking') and status = 'active'),
    'workspace_name', (select name from workspaces where id = ws),
    'authority', (select jsonb_build_object('reply_style', a.reply_style, 'brand_voice', a.brand_voice) from authority a where a.workspace_id = ws),
    'rules', coalesce((select jsonb_agg(jsonb_build_object('department', r.department, 'action', r.action, 'mode', r.mode))
                       from authority_rules r where r.workspace_id = ws), '[]'::jsonb),
    'contracts', (select count(*) from contracts where workspace_id = ws),
    'shipped_orders', (select count(*) from orders where workspace_id = ws and shipped_at is not null)
  );
$$;

--
-- Name: be_account_providers(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.be_account_providers(p_user uuid) RETURNS TABLE(provider text)
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO ''
    AS $$
  select distinct i.provider from auth.identities i where i.user_id = p_user order by 1;
$$;

--
-- Name: be_account_sessions(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.be_account_sessions(p_user uuid) RETURNS TABLE(id uuid, created_at timestamp with time zone, last_active_at timestamp with time zone, user_agent text, ip text)
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO ''
    AS $$
  select s.id,
         s.created_at,
         coalesce(s.refreshed_at at time zone 'utc', s.updated_at, s.created_at) as last_active_at,
         s.user_agent,
         host(s.ip) as ip
    from auth.sessions s
   where s.user_id = p_user
     and (s.not_after is null or s.not_after > now())
   order by 3 desc nulls last
   limit 100;
$$;

--
-- Name: be_revoke_session(uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.be_revoke_session(p_user uuid, p_session uuid) RETURNS boolean
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
declare removed int;
begin
  delete from auth.sessions s where s.id = p_session and s.user_id = p_user;
  get diagnostics removed = row_count;
  return removed > 0;
end;
$$;

--
-- Name: booking_peak_load(uuid, timestamp with time zone, timestamp with time zone, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.booking_peak_load(p_resource uuid, p_start timestamp with time zone, p_block_end timestamp with time zone, p_exclude uuid) RETURNS integer
    LANGUAGE sql STABLE
    SET search_path TO 'public'
    AS $$
  select coalesce(max(load), 0)::int from (
    select (select coalesce(sum(b2.party_size), 0) from public.bookings b2
             where b2.resource_id = p_resource and b2.holds_slot and b2.status in ('requested', 'confirmed', 'rescheduled')
               and (p_exclude is null or b2.id <> p_exclude)
               and b2.start_at <= t.t and b2.block_end_at > t.t) as load
      from (
        select p_start as t
        union
        select b.start_at from public.bookings b
         where b.resource_id = p_resource and b.holds_slot and b.status in ('requested', 'confirmed', 'rescheduled')
           and (p_exclude is null or b.id <> p_exclude)
           and b.start_at > p_start and b.start_at < p_block_end
      ) t
  ) q;
$$;

--
-- Name: booking_rate_hit(text, integer, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.booking_rate_hit(p_key text, p_limit integer, p_window_sec integer) RETURNS boolean
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_window timestamptz := to_timestamp(floor(extract(epoch from now()) / p_window_sec) * p_window_sec);
  v_hits int;
begin
  insert into public.booking_rate (key, window_start, hits) values (p_key, v_window, 1)
  on conflict (key, window_start) do update set hits = public.booking_rate.hits + 1
  returning hits into v_hits;
  delete from public.booking_rate where window_start < now() - interval '2 days';
  return v_hits <= p_limit;
end $$;

--
-- Name: booking_relocate(uuid, uuid, timestamp with time zone, timestamp with time zone, timestamp with time zone, boolean); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.booking_relocate(p_booking uuid, p_resource uuid, p_start timestamp with time zone, p_end timestamp with time zone, p_block_end timestamp with time zone, p_force boolean DEFAULT false) RETURNS boolean
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_ws uuid;
  v_party int;
  v_cap int;
  v_old timestamptz;
  v_status text;
begin
  select workspace_id, party_size, start_at, status into v_ws, v_party, v_old, v_status from public.bookings where id = p_booking;
  if v_ws is null then raise exception 'booking not found'; end if;
  perform pg_advisory_xact_lock(hashtextextended(p_resource::text, 0));
  select capacity into v_cap from public.booking_resources where id = p_resource and workspace_id = v_ws;
  if v_cap is null then raise exception 'resource not found'; end if;
  if not p_force and public.booking_peak_load(p_resource, p_start, p_block_end, p_booking) + v_party > v_cap then
    return false;
  end if;
  update public.bookings
     set resource_id = p_resource, start_at = p_start, end_at = p_end, block_end_at = p_block_end, holds_slot = true,
         rescheduled_from = case when p_start <> v_old then v_old else rescheduled_from end,
         reschedule_count = reschedule_count + case when p_start <> v_old then 1 else 0 end,
         status = case when p_start <> v_old and v_status in ('confirmed', 'rescheduled') then 'rescheduled' else v_status end,
         conflict_note = '', updated_at = now()
   where id = p_booking;
  return true;
end $$;

--
-- Name: booking_reserve(jsonb, boolean); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.booking_reserve(p jsonb, p_force boolean DEFAULT false) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_res uuid := (p ->> 'resource_id')::uuid;
  v_cap int;
  v_party int := coalesce((p ->> 'party_size')::int, 1);
  v_id uuid;
  v_holds boolean := coalesce((p ->> 'holds_slot')::boolean, true);
begin
  perform pg_advisory_xact_lock(hashtextextended(v_res::text, 0));
  select capacity into v_cap from public.booking_resources where id = v_res and workspace_id = (p ->> 'workspace_id')::uuid;
  if v_cap is null then raise exception 'resource not found'; end if;
  if v_holds and not p_force
     and public.booking_peak_load(v_res, (p ->> 'start_at')::timestamptz, (p ->> 'block_end_at')::timestamptz, null) + v_party > v_cap then
    return null;
  end if;
  insert into public.bookings (workspace_id, lead_id, conversation_id, customer_name, customer_phone, customer_email, service_id, resource_id, start_at, end_at, block_end_at,
                               party_size, status, holds_slot, source_channel, price_vnd, deposit_vnd, deposit_status, note, conflict_note, origin, idempotency_key)
  values ((p ->> 'workspace_id')::uuid, nullif(p ->> 'lead_id', '')::uuid, nullif(p ->> 'conversation_id', '')::uuid, coalesce(p ->> 'customer_name', ''), nullif(p ->> 'customer_phone', ''),
          nullif(p ->> 'customer_email', ''), (p ->> 'service_id')::uuid, v_res, (p ->> 'start_at')::timestamptz, (p ->> 'end_at')::timestamptz, (p ->> 'block_end_at')::timestamptz,
          v_party, coalesce(p ->> 'status', 'requested'), v_holds, coalesce(p ->> 'source_channel', 'manual'), nullif(p ->> 'price_vnd', '')::bigint,
          coalesce((p ->> 'deposit_vnd')::bigint, 0), coalesce(p ->> 'deposit_status', 'none'), coalesce(p ->> 'note', ''), coalesce(p ->> 'conflict_note', ''),
          coalesce(p ->> 'origin', 'live'), nullif(p ->> 'idempotency_key', ''))
  returning id into v_id;
  return v_id;
end $$;

--
-- Name: bookings_fill_installation(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.bookings_fill_installation() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
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

--
-- Name: bookings_notify(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.bookings_notify() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_kind text;
begin
  if tg_op = 'INSERT' then
    v_kind := 'created';
  elsif new.status is distinct from old.status then
    v_kind := 'status';
  elsif new.start_at is distinct from old.start_at or new.resource_id is distinct from old.resource_id then
    v_kind := 'moved';
  else
    return new;
  end if;
  perform public.job_enqueue(
    new.workspace_id, 'booking_status', 'apply-booking-status',
    jsonb_build_object('workspaceId', new.workspace_id, 'bookingId', new.id, 'kind', v_kind, 'status', new.status,
                       'previous', case when tg_op = 'UPDATE' then old.status else null end),
    'booking_status:' || new.id::text || ':' || v_kind || ':' || new.status || ':' || (extract(epoch from clock_timestamp()) * 1000000)::bigint::text
  );
  return new;
end $$;

--
-- Name: brain_command(uuid, text, jsonb); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.brain_command(p_workspace uuid, p_kind text, p_payload jsonb) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_id uuid;
begin
  if auth.uid() is null or not public.is_member(p_workspace) then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  insert into public.brain_commands (workspace_id, requested_by, kind, payload)
  values (p_workspace, auth.uid(), p_kind, coalesce(p_payload, '{}'::jsonb))
  returning id into v_id;
  perform public.job_enqueue(p_workspace, 'knowledge', 'brain.command', jsonb_build_object('commandId', v_id, 'workspaceId', p_workspace), 'brain.command:' || v_id);
  return v_id;
end $$;

--
-- Name: brain_command_wait(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.brain_command_wait(p_id uuid) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_row public.brain_commands;
  v_looks int := 0;
begin
  loop
    select * into v_row from public.brain_commands where id = p_id and requested_by = auth.uid();
    if not found then
      raise exception 'not found' using errcode = 'P0002';
    end if;
    exit when v_row.status in ('done', 'failed') or v_looks >= 10;
    perform pg_sleep(0.5);
    v_looks := v_looks + 1;
  end loop;
  return jsonb_build_object('status', v_row.status, 'result', v_row.result, 'errorCode', v_row.error_code);
end $$;

--
-- Name: connection_command_submit(uuid, text, jsonb); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.connection_command_submit(p_workspace uuid, p_kind text, p_input jsonb) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_id uuid;
begin
  if auth.uid() is null or not public.is_member(p_workspace) then
    raise exception 'not a member of this workspace' using errcode = '42501';
  end if;
  delete from public.connection_commands where created_at < now() - interval '1 hour';
  insert into public.connection_commands (workspace_id, user_id, kind, input)
  values (p_workspace, auth.uid(), p_kind, coalesce(p_input, '{}'::jsonb))
  returning id into v_id;
  perform public.job_enqueue(
    p_workspace,
    'connection_commands',
    'connection.command',
    jsonb_build_object('commandId', v_id, 'workspaceId', p_workspace),
    'connection.command:' || v_id::text
  );
  return v_id;
end $$;

--
-- Name: connection_command_take(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.connection_command_take(p_id uuid) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  r public.connection_commands;
begin
  select * into r from public.connection_commands where id = p_id and user_id = auth.uid();
  if not found then
    return jsonb_build_object('status', 'missing');
  end if;
  if r.status = 'pending' then
    return jsonb_build_object('status', 'pending');
  end if;
  delete from public.connection_commands where id = p_id;
  return jsonb_build_object('status', 'done', 'outcome', r.outcome);
end $$;

--
-- Name: connection_mark_fed(uuid, timestamp with time zone, jsonb); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.connection_mark_fed(p_connection uuid, p_at timestamp with time zone, p_first_event jsonb) RETURNS void
    LANGUAGE sql
    SET search_path TO 'public'
    AS $$
    update public.connections
    set last_event_at = p_at,
        last_error = null,
        updated_at = p_at,
        status = case when status in ('pending', 'error') then 'connected' else status end,
        first_event = coalesce(first_event, p_first_event)
    where id = p_connection;
$$;

--
-- Name: content_items_touch(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.content_items_touch() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
begin new.updated_at := now(); return new; end $$;

--
-- Name: content_settings_touch(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.content_settings_touch() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
begin new.updated_at := now(); return new; end $$;

--
-- Name: create_free_workspace(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.create_free_workspace(p_name text) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_uid uuid := auth.uid();
  v_name text := btrim(coalesce(p_name, ''));
  v_id uuid;
begin
  if v_uid is null then
    raise exception 'not_signed_in' using errcode = '42501';
  end if;
  if not exists (select 1 from public.platform_flags f where f.key = 'workspace_signup_enabled' and f.enabled) then
    raise exception 'WORKSPACES_SIGNUP_DISABLED' using errcode = 'P0001';
  end if;
  if v_name = '' or char_length(v_name) > 120 then
    raise exception 'WORKSPACES_NAME_INVALID' using errcode = '22023';
  end if;
  insert into public.workspaces (owner_id, name, status) values (v_uid, v_name, 'active') returning id into v_id;
  return v_id;
end;
$$;

--
-- Name: credit_usd_value(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.credit_usd_value() RETURNS numeric
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select value from public.billing_config where key = 'credit_usd_value';
$$;

--
-- Name: dashboard_data(uuid, timestamp with time zone, timestamp with time zone, timestamp with time zone); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.dashboard_data(ws uuid, since7 timestamp with time zone, founding_from timestamp with time zone, founding_to timestamp with time zone) RETURNS jsonb
    LANGUAGE sql STABLE
    SET search_path TO 'public'
    AS $$
  select jsonb_build_object(
    'responsibilities', public.responsibility_rows(ws),
    'agents', coalesce((select jsonb_agg(to_jsonb(a) order by a.created_at) from agents a where a.workspace_id = ws), '[]'::jsonb),
    'events', coalesce((select jsonb_agg(to_jsonb(e) order by e.created_at desc)
                        from (select * from events where workspace_id = ws order by created_at desc limit 6) e), '[]'::jsonb),
    'leads', coalesce((select jsonb_agg(jsonb_build_object('id', l.id, 'stage', l.stage, 'created_at', l.created_at, 'contact_name', l.contact_name, 'company', l.company))
                       from leads l where l.workspace_id = ws), '[]'::jsonb),
    'pending', coalesce((select jsonb_agg(jsonb_build_object('id', x.id, 'responsibility_id', x.responsibility_id, 'created_at', x.created_at,
                                                             'lead_id', (select r.lead_id from responsibilities r where r.id = x.responsibility_id)) order by x.created_at desc)
                         from executions x where x.workspace_id = ws and x.status = 'pending_approval'), '[]'::jsonb),
    'promo', public.promo_state(ws, founding_from, founding_to),
    'governance', public.governance_rows(ws, since7),
    'exceptions', public.exception_rows(ws)
  );
$$;

--
-- Name: display_name_of(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.display_name_of(uid uuid) RETURNS text
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public', 'auth'
    AS $$
  select coalesce(nullif(trim(u.raw_user_meta_data ->> 'full_name'), ''), nullif(trim(u.raw_user_meta_data ->> 'name'), ''),
                  nullif(split_part(u.email, '@', 1), ''), 'Owner')
  from auth.users u where u.id = uid;
$$;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: exception_rows(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.exception_rows(ws uuid) RETURNS jsonb
    LANGUAGE sql STABLE
    SET search_path TO 'public'
    AS $$
  select coalesce(jsonb_agg(to_jsonb(w) || jsonb_build_object(
           'lead', (select jsonb_build_object('id', l.id, 'contact_name', l.contact_name, 'company', l.company, 'channel', l.channel) from leads l where l.id = w.lead_id),
           'staff', (select jsonb_build_object('name', s.name) from staff s where s.id = w.assigned_staff_id)) order by w.created_at), '[]'::jsonb)
  from (select * from work_items where workspace_id = ws and status in ('waiting_decision', 'failed') order by created_at limit 100) w;
$$;

--
-- Name: governance_rows(uuid, timestamp with time zone); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.governance_rows(ws uuid, since7 timestamp with time zone) RETURNS jsonb
    LANGUAGE sql STABLE
    SET search_path TO 'public'
    AS $$
  select jsonb_build_object(
    'auth', (select jsonb_build_object('goal_revenue_vnd', a.goal_revenue_vnd, 'goal_new_customers', a.goal_new_customers,
                                       'goal_first_reply_minutes', a.goal_first_reply_minutes)
             from authority a where a.workspace_id = ws),
    'leads', coalesce((select jsonb_agg(jsonb_build_object('id', l.id, 'contact_name', l.contact_name, 'company', l.company,
                                                           'origin', l.origin, 'stage', l.stage, 'created_at', l.created_at))
                       from (select * from leads where workspace_id = ws limit 10000) l), '[]'::jsonb),
    'orders', coalesce((select jsonb_agg(jsonb_build_object('id', o.id, 'lead_id', o.lead_id, 'order_no', o.order_no, 'items', o.items,
                                                            'amount_vnd', o.amount_vnd, 'status', o.status, 'origin', o.origin))
                        from orders o where o.workspace_id = ws and o.status in ('confirmed', 'invoiced', 'paid')), '[]'::jsonb),
    'invoices', coalesce((select jsonb_agg(jsonb_build_object('id', i.id, 'order_id', i.order_id, 'lead_id', i.lead_id, 'invoice_no', i.invoice_no,
                                                              'amount_vnd', i.amount_vnd, 'status', i.status, 'origin', i.origin))
                          from invoices i where i.workspace_id = ws and i.status in ('issued', 'paid')), '[]'::jsonb),
    'txs', coalesce((select jsonb_agg(jsonb_build_object('id', t.id, 'invoice_id', t.invoice_id, 'payer', t.payer, 'reference', t.reference,
                                                         'amount_vnd', t.amount_vnd, 'status', t.status, 'origin', t.origin))
                     from transactions t where t.workspace_id = ws and t.status in ('matched', 'unmatched', 'needs_review')), '[]'::jsonb),
    'work', coalesce((select jsonb_agg(jsonb_build_object('id', w.id, 'lead_id', w.lead_id, 'department', w.department, 'status', w.status,
                                                          'reason', w.reason, 'decided_path', w.decided_path, 'created_at', w.created_at,
                                                          'updated_at', w.updated_at, 'completed_at', w.completed_at,
                                                          'summary', w.proposal ->> 'summary',
                                                          'contact', w.proposal -> 'fields' ->> 'contact_name',
                                                          'customer', w.proposal -> 'fields' ->> 'customer') order by w.created_at desc)
                      from (select * from work_items where workspace_id = ws order by created_at desc limit 2000) w), '[]'::jsonb),
    'pending_without_work', (select count(*) from executions x where x.workspace_id = ws and x.status = 'pending_approval' and x.work_item_id is null),
    'decisions7', coalesce((select jsonb_agg(jsonb_build_object('work_item_id', d.work_item_id, 'lead_id', d.lead_id, 'decider_kind', d.decider_kind,
                                                                'outcome', d.outcome, 'created_at', d.created_at))
                            from decisions d where d.workspace_id = ws and d.created_at >= since7), '[]'::jsonb),
    'recent', coalesce((select jsonb_agg(to_jsonb(d) || jsonb_build_object('lead', (select jsonb_build_object('contact_name', l.contact_name)
                                                                                 from leads l where l.id = d.lead_id)) order by d.created_at desc)
                        from (select * from decisions where workspace_id = ws order by created_at desc limit 40) d), '[]'::jsonb)
  );
$$;

--
-- Name: hiring_application_submit(uuid, uuid, jsonb, text, text, text[]); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.hiring_application_submit(p_ws uuid, p_job uuid, p_fields jsonb, p_consent text, p_ip text, p_lines text[]) RETURNS TABLE(id uuid, duplicate boolean)
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
declare
  v_id uuid;
  v_name text := p_fields ->> 'name';
  v_phone text := coalesce(p_fields ->> 'phone', '');
begin
  if v_phone <> '' then
    select c.id into v_id from public.hiring_candidates c where c.job_id = p_job and c.phone = v_phone;
    if v_id is not null then return query select v_id, true; return; end if;
  end if;
  insert into public.hiring_candidates (workspace_id, job_id, name, phone, email, source, conversation_id, cv_path, cv_name, cv_mime, cv_size, answers, availability)
  values (p_ws, p_job, v_name, v_phone, coalesce(p_fields ->> 'email', ''), p_fields ->> 'source', (p_fields ->> 'conversationId')::uuid,
    p_fields ->> 'cvPath', p_fields ->> 'cvName', p_fields ->> 'cvMime', (p_fields ->> 'cvSize')::int, coalesce(p_fields -> 'answers', '[]'::jsonb),
    coalesce(p_fields ->> 'availability', ''))
  returning hiring_candidates.id into v_id;
  insert into public.hiring_consents (workspace_id, candidate_id, channel, consent_text, ip_hash) values (p_ws, v_id, p_fields ->> 'source', p_consent, p_ip);
  insert into public.hiring_events (workspace_id, candidate_id, kind, actor, summary)
  values (p_ws, v_id, 'applied', v_name, left(p_lines[1], 500)), (p_ws, v_id, 'consent', v_name, left(p_lines[2], 500));
  return query select v_id, false;
end
$$;

--
-- Name: hiring_availability_save(uuid, uuid, jsonb); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.hiring_availability_save(p_ws uuid, p_user uuid, p_windows jsonb) RETURNS integer
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
declare v_count int;
begin
  delete from public.hiring_availability where workspace_id = p_ws and member_user_id = p_user;
  insert into public.hiring_availability (workspace_id, member_user_id, weekday, start_min, end_min)
  select p_ws, p_user, (w ->> 'weekday')::smallint, (w ->> 'startMin')::int, (w ->> 'endMin')::int from jsonb_array_elements(coalesce(p_windows, '[]'::jsonb)) w;
  get diagnostics v_count = row_count;
  return v_count;
end
$$;

--
-- Name: hiring_candidate_link_staff(uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.hiring_candidate_link_staff(p_ws uuid, p_id uuid) RETURNS TABLE(staff_id uuid, missing boolean)
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
declare
  v_cand public.hiring_candidates%rowtype;
  v_positions uuid[];
  v_staff uuid;
begin
  select * into v_cand from public.hiring_candidates where id = p_id and workspace_id = p_ws;
  if not found or v_cand.stage <> 'hired' or v_cand.staff_id is not null then
    return query select v_cand.staff_id, true;
    return;
  end if;
  select coalesce(array_agg(p.id), '{}') into v_positions
  from public.shifts_positions p
  join public.hiring_jobs j on j.id = v_cand.job_id
  where p.workspace_id = p_ws and p.active and lower(btrim(p.name)) in (lower(btrim(j.position)), lower(btrim(j.title)));
  insert into public.shifts_staff (workspace_id, name, phone, position_ids, active)
  values (p_ws, v_cand.name, nullif(v_cand.phone, ''), v_positions[1:1], true) returning id into v_staff;
  update public.hiring_candidates set staff_id = v_staff where id = p_id;
  insert into public.hiring_events (workspace_id, candidate_id, kind, actor, summary) values (p_ws, p_id, 'staff_linked', 'NIVO', 'staff linked');
  return query select v_staff, false;
end
$$;

--
-- Name: hiring_candidate_move(uuid, uuid, text, text, text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.hiring_candidate_move(p_ws uuid, p_id uuid, p_stage text, p_reason text, p_actor text, p_summary text) RETURNS boolean
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
declare v_count int;
begin
  update public.hiring_candidates set stage = p_stage, stage_changed_at = now(), rejected_reason = case when p_stage = 'rejected' then left(p_reason, 300) else rejected_reason end
  where id = p_id and workspace_id = p_ws;
  get diagnostics v_count = row_count;
  if v_count = 0 then return false; end if;
  insert into public.hiring_events (workspace_id, candidate_id, kind, actor, summary) values (p_ws, p_id, 'stage', p_actor, left(p_summary, 500));
  return true;
end
$$;

--
-- Name: hiring_candidate_notes(uuid, uuid, text, text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.hiring_candidate_notes(p_ws uuid, p_id uuid, p_notes text, p_actor text, p_summary text) RETURNS boolean
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
declare v_count int;
begin
  update public.hiring_candidates set notes = left(p_notes, 4000) where id = p_id and workspace_id = p_ws;
  get diagnostics v_count = row_count;
  if v_count = 0 then return false; end if;
  insert into public.hiring_events (workspace_id, candidate_id, kind, actor, summary) values (p_ws, p_id, 'note', p_actor, left(p_summary, 500));
  return true;
end
$$;

--
-- Name: hiring_candidate_screened(uuid, uuid, integer, text, jsonb, text, text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.hiring_candidate_screened(p_ws uuid, p_id uuid, p_score integer, p_label text, p_reasons jsonb, p_summary text, p_actor text, p_line text) RETURNS boolean
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
declare v_count int;
begin
  update public.hiring_candidates set score = p_score, score_label = p_label, score_reasons = coalesce(p_reasons, '[]'::jsonb), score_summary = p_summary, screened_at = now(),
    stage = case when stage = 'applied' then 'screening' else stage end,
    stage_changed_at = case when stage = 'applied' then now() else stage_changed_at end
  where id = p_id and workspace_id = p_ws;
  get diagnostics v_count = row_count;
  if v_count = 0 then return false; end if;
  insert into public.hiring_events (workspace_id, candidate_id, kind, actor, summary) values (p_ws, p_id, 'screened', p_actor, left(p_line, 500));
  return true;
end
$$;

--
-- Name: hiring_candidates_delete(uuid, uuid[]); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.hiring_candidates_delete(p_ws uuid, p_ids uuid[]) RETURNS text[]
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
declare v_paths text[];
begin
  with gone as (
    delete from public.hiring_candidates where workspace_id = p_ws and id = any(p_ids) returning cv_path
  )
  select coalesce(array_agg(cv_path) filter (where cv_path is not null), '{}') into v_paths from gone;
  return v_paths;
end
$$;

--
-- Name: hiring_event_log(uuid, uuid, text, text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.hiring_event_log(p_ws uuid, p_candidate uuid, p_kind text, p_actor text, p_summary text) RETURNS void
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
begin
  insert into public.hiring_events (workspace_id, candidate_id, kind, actor, summary) values (p_ws, p_candidate, p_kind, p_actor, left(p_summary, 500));
end
$$;

--
-- Name: hiring_interview_confirm(text, timestamp with time zone, timestamp with time zone, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.hiring_interview_confirm(p_token text, p_start timestamp with time zone, p_end timestamp with time zone, p_line text) RETURNS boolean
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
declare v_row public.hiring_interviews%rowtype;
begin
  update public.hiring_interviews set status = 'confirmed', slot_start = p_start, slot_end = p_end, note = ''
  where token = p_token and status = 'proposed' returning * into v_row;
  if not found then return false; end if;
  insert into public.hiring_events (workspace_id, candidate_id, kind, actor, summary) values (v_row.workspace_id, v_row.candidate_id, 'interview_confirmed', 'candidate', left(p_line, 500));
  return true;
end
$$;

--
-- Name: hiring_interview_create(uuid, uuid, uuid, jsonb, text, uuid, text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.hiring_interview_create(p_ws uuid, p_candidate uuid, p_job uuid, p_fields jsonb, p_token text, p_work uuid, p_actor text, p_line text) RETURNS uuid
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
declare v_id uuid;
begin
  insert into public.hiring_interviews (workspace_id, candidate_id, job_id, interviewer_user_id, interviewer_name, mode, location, duration_min, proposed_slots, token, work_item_id)
  values (p_ws, p_candidate, p_job, (p_fields ->> 'interviewerUserId')::uuid, coalesce(p_fields ->> 'interviewerName', ''), p_fields ->> 'mode',
    coalesce(p_fields ->> 'location', ''), (p_fields ->> 'durationMin')::int, coalesce(p_fields -> 'slots', '[]'::jsonb), p_token, p_work)
  returning id into v_id;
  update public.hiring_candidates set stage = 'interview', stage_changed_at = now()
  where id = p_candidate and workspace_id = p_ws and stage in ('applied', 'screening', 'shortlisted');
  insert into public.hiring_events (workspace_id, candidate_id, kind, actor, summary) values (p_ws, p_candidate, 'interview_proposed', p_actor, left(p_line, 500));
  return v_id;
end
$$;

--
-- Name: hiring_interview_none_fit(text, text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.hiring_interview_none_fit(p_token text, p_note text, p_line text) RETURNS boolean
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
declare v_row public.hiring_interviews%rowtype;
begin
  update public.hiring_interviews set note = left(p_note, 300) where token = p_token and status = 'proposed' returning * into v_row;
  if not found then return false; end if;
  insert into public.hiring_events (workspace_id, candidate_id, kind, actor, summary) values (v_row.workspace_id, v_row.candidate_id, 'interview_declined_slots', 'candidate', left(p_line, 500));
  return true;
end
$$;

--
-- Name: hiring_interview_remind_claim(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.hiring_interview_remind_claim(p_id uuid) RETURNS boolean
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
declare v_count int;
begin
  update public.hiring_interviews set reminder_sent_at = now() where id = p_id and reminder_sent_at is null;
  get diagnostics v_count = row_count;
  return v_count > 0;
end
$$;

--
-- Name: hiring_interview_status(uuid, uuid, text, text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.hiring_interview_status(p_ws uuid, p_id uuid, p_status text, p_actor text, p_line text) RETURNS uuid
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
declare v_candidate uuid;
begin
  update public.hiring_interviews set status = p_status where id = p_id and workspace_id = p_ws returning candidate_id into v_candidate;
  if v_candidate is null then return null; end if;
  insert into public.hiring_events (workspace_id, candidate_id, kind, actor, summary) values (p_ws, v_candidate, 'interview_' || p_status, p_actor, left(p_line, 500));
  return v_candidate;
end
$$;

--
-- Name: hiring_job_ads(uuid, uuid, jsonb); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.hiring_job_ads(p_ws uuid, p_id uuid, p_ads jsonb) RETURNS boolean
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
declare v_count int;
begin
  update public.hiring_jobs set ad_variants = p_ads, updated_at = now() where id = p_id and workspace_id = p_ws;
  get diagnostics v_count = row_count;
  return v_count > 0;
end
$$;

--
-- Name: hiring_job_create(uuid, uuid, text, jsonb); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.hiring_job_create(p_ws uuid, p_user uuid, p_slug text, p_fields jsonb) RETURNS uuid
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
declare v_id uuid;
begin
  insert into public.hiring_jobs (workspace_id, slug, title, position, employment_type, schedule, pay_min_vnd, pay_max_vnd, pay_unit, location, headcount,
    description, requirements, questions, channels, closes_at, created_by)
  values (p_ws, p_slug, p_fields ->> 'title', coalesce(p_fields ->> 'position', ''), coalesce(p_fields ->> 'employmentType', 'full_time'),
    coalesce(p_fields ->> 'schedule', ''), (p_fields ->> 'payMinVnd')::bigint, (p_fields ->> 'payMaxVnd')::bigint, coalesce(p_fields ->> 'payUnit', 'month'),
    coalesce(p_fields ->> 'location', ''), coalesce((p_fields ->> 'headcount')::int, 1), coalesce(p_fields ->> 'description', ''),
    coalesce(p_fields -> 'requirements', '{}'::jsonb), coalesce(p_fields -> 'questions', '[]'::jsonb),
    coalesce(array(select jsonb_array_elements_text(p_fields -> 'channels')), array['page']::text[]), (p_fields ->> 'closesAt')::timestamptz, p_user)
  returning id into v_id;
  return v_id;
exception when unique_violation then
  return null;
end
$$;

--
-- Name: hiring_job_fill_check(uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.hiring_job_fill_check(p_ws uuid, p_job uuid) RETURNS TABLE(closed boolean, title text, hired bigint, headcount integer)
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
begin
  return query
  with target as (
    select j.id, j.title as job_title, j.headcount as wanted, j.status,
      (select count(*) from public.hiring_candidates c where c.job_id = j.id and c.stage = 'hired') as got
    from public.hiring_jobs j
    join public.hiring_settings s on s.workspace_id = j.workspace_id and s.auto_close_when_filled
    where j.id = p_job and j.workspace_id = p_ws and j.status <> 'closed'
  ), shut as (
    update public.hiring_jobs j set status = 'closed', updated_at = now()
    from target t where j.id = t.id and t.got >= t.wanted
    returning j.id
  )
  select exists (select 1 from shut), t.job_title, t.got, t.wanted from target t;
end
$$;

--
-- Name: hiring_job_status(uuid, uuid, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.hiring_job_status(p_ws uuid, p_id uuid, p_status text) RETURNS boolean
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
declare v_count int;
begin
  update public.hiring_jobs set status = p_status, updated_at = now() where id = p_id and workspace_id = p_ws;
  get diagnostics v_count = row_count;
  return v_count > 0;
end
$$;

--
-- Name: hiring_job_update(uuid, uuid, jsonb); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.hiring_job_update(p_ws uuid, p_id uuid, p_fields jsonb) RETURNS boolean
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
declare v_count int;
begin
  update public.hiring_jobs set
    title = p_fields ->> 'title', position = coalesce(p_fields ->> 'position', ''), employment_type = coalesce(p_fields ->> 'employmentType', 'full_time'),
    schedule = coalesce(p_fields ->> 'schedule', ''), pay_min_vnd = (p_fields ->> 'payMinVnd')::bigint, pay_max_vnd = (p_fields ->> 'payMaxVnd')::bigint,
    pay_unit = coalesce(p_fields ->> 'payUnit', 'month'), location = coalesce(p_fields ->> 'location', ''),
    headcount = coalesce((p_fields ->> 'headcount')::int, 1), description = coalesce(p_fields ->> 'description', ''),
    requirements = coalesce(p_fields -> 'requirements', '{}'::jsonb), questions = coalesce(p_fields -> 'questions', '[]'::jsonb),
    channels = coalesce(array(select jsonb_array_elements_text(p_fields -> 'channels')), array['page']::text[]),
    closes_at = (p_fields ->> 'closesAt')::timestamptz, updated_at = now()
  where id = p_id and workspace_id = p_ws;
  get diagnostics v_count = row_count;
  return v_count > 0;
end
$$;

--
-- Name: hiring_jobs_expire(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.hiring_jobs_expire(p_ws uuid) RETURNS text[]
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
declare v_titles text[];
begin
  with closed as (
    update public.hiring_jobs set status = 'closed', updated_at = now()
    where workspace_id = p_ws and status in ('open', 'paused') and closes_at < now()
    returning title
  )
  select coalesce(array_agg(title), '{}') into v_titles from closed;
  return v_titles;
end
$$;

--
-- Name: hiring_new_token(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.hiring_new_token() RETURNS text
    LANGUAGE sql
    SET search_path TO 'public'
    AS $$
  select replace(gen_random_uuid()::text, '-', '');
$$;

--
-- Name: hiring_offer_answer(text, boolean, text[], text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.hiring_offer_answer(p_token text, p_accept boolean, p_items text[], p_actor text, p_line text) RETURNS text
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
declare v_row public.hiring_offers%rowtype;
begin
  update public.hiring_offers set status = case when p_accept then 'accepted' else 'declined' end, responded_at = now()
  where token = p_token and status = 'sent' and (expires_at is null or expires_at >= now()) returning * into v_row;
  if not found then return 'stale'; end if;
  if p_accept then
    update public.hiring_candidates set stage = 'hired', stage_changed_at = now() where id = v_row.candidate_id;
    insert into public.hiring_onboarding (workspace_id, candidate_id, title, sort)
    select v_row.workspace_id, v_row.candidate_id, item, ordinality - 1 from unnest(p_items) with ordinality as t(item, ordinality);
  else
    update public.hiring_candidates set stage = 'withdrawn', stage_changed_at = now() where id = v_row.candidate_id;
  end if;
  insert into public.hiring_events (workspace_id, candidate_id, kind, actor, summary)
  values (v_row.workspace_id, v_row.candidate_id, case when p_accept then 'offer_accepted' else 'offer_declined' end, p_actor, left(p_line, 500));
  return case when p_accept then 'accepted' else 'declined' end;
end
$$;

--
-- Name: hiring_offer_cancel(uuid, uuid, text[], text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.hiring_offer_cancel(p_ws uuid, p_id uuid, p_statuses text[], p_actor text, p_line text) RETURNS TABLE(candidate_id uuid, work_item_id uuid)
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
declare v_row public.hiring_offers%rowtype;
begin
  update public.hiring_offers set status = 'cancelled' where id = p_id and workspace_id = p_ws and status = any(p_statuses) returning * into v_row;
  if not found then return; end if;
  insert into public.hiring_events (workspace_id, candidate_id, kind, actor, summary) values (p_ws, v_row.candidate_id, 'offer_cancelled', p_actor, left(p_line, 500));
  return query select v_row.candidate_id, v_row.work_item_id;
end
$$;

--
-- Name: hiring_offer_create(uuid, uuid, uuid, jsonb, text, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.hiring_offer_create(p_ws uuid, p_candidate uuid, p_job uuid, p_terms jsonb, p_token text, p_user uuid) RETURNS uuid
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
declare v_id uuid;
begin
  insert into public.hiring_offers (workspace_id, candidate_id, job_id, terms, status, token, created_by) values (p_ws, p_candidate, p_job, p_terms, 'draft', p_token, p_user)
  returning id into v_id;
  return v_id;
end
$$;

--
-- Name: hiring_offer_link(uuid, uuid, uuid, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.hiring_offer_link(p_ws uuid, p_id uuid, p_work uuid, p_status text) RETURNS void
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
begin
  update public.hiring_offers set work_item_id = p_work, status = case when p_status = 'draft' then status else p_status end where id = p_id and workspace_id = p_ws;
end
$$;

--
-- Name: hiring_offer_sent(uuid, uuid, text, text, timestamp with time zone, text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.hiring_offer_sent(p_ws uuid, p_id uuid, p_draft text, p_via text, p_expires timestamp with time zone, p_actor text, p_line text) RETURNS boolean
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
declare v_candidate uuid;
begin
  update public.hiring_offers set draft = p_draft, status = 'sent', sent_at = now(), expires_at = p_expires, sent_via = p_via where id = p_id and workspace_id = p_ws
  returning candidate_id into v_candidate;
  if v_candidate is null then return false; end if;
  update public.hiring_candidates set stage = 'offer', stage_changed_at = now() where id = v_candidate and stage not in ('hired', 'rejected', 'withdrawn');
  insert into public.hiring_events (workspace_id, candidate_id, kind, actor, summary) values (p_ws, v_candidate, 'offer_sent', p_actor, left(p_line, 500));
  return true;
end
$$;

--
-- Name: hiring_offers_expire(uuid, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.hiring_offers_expire(p_ws uuid, p_line text) RETURNS uuid[]
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
declare v_ids uuid[];
begin
  with gone as (
    update public.hiring_offers set status = 'expired' where workspace_id = p_ws and status = 'sent' and expires_at < now() returning candidate_id
  ), logged as (
    insert into public.hiring_events (workspace_id, candidate_id, kind, actor, summary) select p_ws, candidate_id, 'offer_expired', 'NIVO', left(p_line, 500) from gone returning candidate_id
  )
  select coalesce(array_agg(candidate_id), '{}') into v_ids from logged;
  return v_ids;
end
$$;

--
-- Name: hiring_onboarding_toggle(uuid, uuid, boolean); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.hiring_onboarding_toggle(p_ws uuid, p_id uuid, p_done boolean) RETURNS boolean
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
declare v_count int;
begin
  update public.hiring_onboarding set done = p_done, done_at = case when p_done then now() else null end where id = p_id and workspace_id = p_ws;
  get diagnostics v_count = row_count;
  return v_count > 0;
end
$$;

--
-- Name: hiring_ops_status(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.hiring_ops_status() RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare v_jobs jsonb := '[]'::jsonb; v_due int;
begin
  begin
    select coalesce(jsonb_agg(jsonb_build_object('jobname', jobname, 'schedule', schedule, 'active', active)), '[]'::jsonb)
      into v_jobs from cron.job where jobname like 'hiring-%';
  exception when others then
    v_jobs := '[]'::jsonb;
  end;
  select count(*) into v_due from public.hiring_candidates c join public.hiring_settings s on s.workspace_id = c.workspace_id
    where c.stage in ('rejected', 'withdrawn') and c.stage_changed_at < now() - make_interval(days => s.retention_days);
  return jsonb_build_object('cron', v_jobs, 'retention_due', v_due);
end $$;

--
-- Name: hiring_retention_log_add(uuid, integer, integer, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.hiring_retention_log_add(p_ws uuid, p_candidates integer, p_files integer, p_days integer) RETURNS void
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
begin
  insert into public.hiring_retention_log (workspace_id, deleted_candidates, deleted_files, retention_days) values (p_ws, p_candidates, p_files, p_days);
end
$$;

--
-- Name: hiring_settings_init(uuid, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.hiring_settings_init(p_ws uuid, p_slug text) RETURNS text
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
begin
  if exists (select 1 from public.hiring_settings where workspace_id = p_ws) then return 'exists'; end if;
  insert into public.hiring_settings (workspace_id, public_slug) values (p_ws, p_slug);
  return 'created';
exception when unique_violation then
  if exists (select 1 from public.hiring_settings where workspace_id = p_ws) then return 'exists'; end if;
  return 'taken';
end
$$;

--
-- Name: hiring_settings_save(uuid, jsonb); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.hiring_settings_save(p_ws uuid, p_patch jsonb) RETURNS text
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
declare v_count int;
begin
  update public.hiring_settings set
    public_slug = coalesce(p_patch ->> 'publicSlug', public_slug),
    retention_days = coalesce((p_patch ->> 'retentionDays')::int, retention_days),
    notify_new_candidate = coalesce((p_patch ->> 'notifyNewCandidate')::boolean, notify_new_candidate),
    remind_interview = coalesce((p_patch ->> 'remindInterview')::boolean, remind_interview),
    auto_close_when_filled = coalesce((p_patch ->> 'autoCloseWhenFilled')::boolean, auto_close_when_filled),
    apply_consent_text = coalesce(p_patch ->> 'applyConsentText', apply_consent_text),
    ad_tone = coalesce(p_patch ->> 'adTone', ad_tone),
    updated_at = now()
  where workspace_id = p_ws;
  get diagnostics v_count = row_count;
  if v_count = 0 then return 'missing'; end if;
  return 'ok';
exception when unique_violation then
  return 'taken';
end
$$;

--
-- Name: hiring_tick(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.hiring_tick() RETURNS boolean
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_slot text := to_char(date_trunc('minute', now()) - make_interval(mins => (extract(minute from now()))::int % 5), 'YYYYMMDDHH24MI');
  r record;
begin
  for r in select workspace_id from public.hiring_settings loop
    perform public.job_enqueue(r.workspace_id, 'hiring_tick', 'hiring_tick', jsonb_build_object('workspaceId', r.workspace_id), 'hiring_tick:' || r.workspace_id::text || ':' || v_slot);
  end loop;
  return true;
exception when others then
  raise notice 'hiring_tick failed: %', sqlerrm;
  return false;
end
$$;

--
-- Name: inventory_add_po_lines(uuid, uuid, uuid[], numeric[], numeric[]); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.inventory_add_po_lines(p_ws uuid, p_po uuid, p_item_ids uuid[], p_qtys numeric[], p_costs numeric[]) RETURNS void
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
begin
  insert into public.inventory_po_lines (workspace_id, po_id, item_id, qty_ordered, unit_cost_vnd)
  select p_ws, p_po, line.item_id, line.qty, line.unit_cost from unnest(p_item_ids, p_qtys, p_costs) as line (item_id, qty, unit_cost);
end
$$;

--
-- Name: inventory_apply_movement(uuid, uuid, uuid, text, numeric, text, text, text, text, text, text, text, numeric); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.inventory_apply_movement(p_ws uuid, p_item uuid, p_loc uuid, p_kind text, p_delta numeric, p_reason text, p_ref_type text, p_ref_id text, p_ref_label text, p_by text, p_evidence text, p_dedupe text, p_unit_cost numeric DEFAULT NULL::numeric) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare v_cost numeric; v_before numeric; v_total numeric; v_after numeric; v_new_cost numeric; v_id uuid;
begin
  select cost_vnd into v_cost from public.inventory_items where id = p_item and workspace_id = p_ws for update;
  if not found then raise exception 'inventory item not found'; end if;
  perform 1 from public.inventory_locations where id = p_loc and workspace_id = p_ws;
  if not found then raise exception 'inventory location not found'; end if;
  if p_dedupe is not null and exists (select 1 from public.inventory_movements where workspace_id = p_ws and dedupe_key = p_dedupe) then
    return jsonb_build_object('applied', false);
  end if;
  insert into public.inventory_stock_levels (workspace_id, item_id, location_id, qty) values (p_ws, p_item, p_loc, 0) on conflict do nothing;
  select qty into v_before from public.inventory_stock_levels where item_id = p_item and location_id = p_loc for update;
  select coalesce(sum(qty), 0) into v_total from public.inventory_stock_levels where item_id = p_item;
  v_after := v_before + p_delta;
  update public.inventory_stock_levels set qty = v_after, updated_at = now() where item_id = p_item and location_id = p_loc;
  if p_kind = 'in' and p_unit_cost is not null and p_delta > 0 then
    v_new_cost := case when v_total > 0 then round((v_total * v_cost + p_delta * p_unit_cost) / (v_total + p_delta), 2) else p_unit_cost end;
    update public.inventory_items set cost_vnd = v_new_cost, updated_at = now() where id = p_item;
  end if;
  insert into public.inventory_movements (workspace_id, item_id, location_id, kind, qty, qty_after, unit_cost_vnd, reason, ref_type, ref_id, ref_label, by_name, evidence, dedupe_key)
  values (p_ws, p_item, p_loc, p_kind, p_delta, v_after, p_unit_cost, coalesce(p_reason, ''), coalesce(p_ref_type, 'manual'), p_ref_id, p_ref_label, coalesce(p_by, 'NIVO'), p_evidence, p_dedupe)
  returning id into v_id;
  return jsonb_build_object('applied', true, 'movement_id', v_id, 'before', v_before, 'after', v_after, 'cost', coalesce(v_new_cost, v_cost));
end $$;

--
-- Name: inventory_cancel_po(uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.inventory_cancel_po(p_ws uuid, p_po uuid) RETURNS TABLE(po_no text, work_item_id uuid)
    LANGUAGE sql
    SET search_path TO 'public'
    AS $$
update public.inventory_purchase_orders as target set status = 'cancelled', updated_at = now()
where target.workspace_id = p_ws and target.id = p_po and target.status in ('draft', 'waiting_approval', 'sent')
returning target.po_no, target.work_item_id;
$$;

--
-- Name: inventory_close_receipt(uuid, numeric); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.inventory_close_receipt(p_receipt uuid, p_total numeric) RETURNS void
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
begin
  update public.inventory_receipts set total_vnd = p_total where id = p_receipt;
end
$$;

--
-- Name: inventory_default_location(uuid, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.inventory_default_location(p_ws uuid, p_name text) RETURNS uuid
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
declare v_id uuid;
begin
  select id into v_id from public.inventory_locations where workspace_id = p_ws order by is_default desc, created_at limit 1;
  if v_id is not null then return v_id; end if;
  insert into public.inventory_locations (workspace_id, name, is_default) values (p_ws, p_name, true) on conflict do nothing returning id into v_id;
  if v_id is not null then return v_id; end if;
  select id into v_id from public.inventory_locations where workspace_id = p_ws order by is_default desc, created_at limit 1;
  return v_id;
end
$$;

--
-- Name: inventory_delete_recipe(uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.inventory_delete_recipe(p_ws uuid, p_id uuid) RETURNS void
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
begin
  delete from public.inventory_recipes where workspace_id = p_ws and id = p_id;
end
$$;

--
-- Name: inventory_discard_receipt(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.inventory_discard_receipt(p_receipt uuid) RETURNS void
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
begin
  delete from public.inventory_receipts where id = p_receipt;
end
$$;

--
-- Name: inventory_edit_po_draft(uuid, uuid, date, uuid[], numeric[], numeric[]); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.inventory_edit_po_draft(p_po uuid, p_supplier uuid, p_expected date, p_line_ids uuid[], p_qtys numeric[], p_costs numeric[]) RETURNS void
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
begin
  delete from public.inventory_po_lines where po_id = p_po and id in (select line.id from unnest(p_line_ids, p_qtys) as line (id, qty) where line.qty <= 0);
  update public.inventory_po_lines as target set qty_ordered = line.qty, unit_cost_vnd = line.unit_cost
  from unnest(p_line_ids, p_qtys, p_costs) as line (id, qty, unit_cost)
  where target.po_id = p_po and target.id = line.id and line.qty > 0;
  update public.inventory_purchase_orders set supplier_id = p_supplier, expected_at = p_expected where id = p_po;
  perform public.inventory_recompute_po_total(p_po);
end
$$;

--
-- Name: inventory_import_item(uuid, uuid, text, text, text, text, numeric, numeric, numeric, numeric, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.inventory_import_item(p_ws uuid, p_id uuid, p_sku text, p_name text, p_unit text, p_category text, p_cost numeric, p_sell numeric, p_reorder_point numeric, p_reorder_qty numeric, p_supplier uuid) RETURNS uuid
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
declare v_id uuid;
begin
  if p_id is null then
    insert into public.inventory_items (workspace_id, sku, name, unit, category, cost_vnd, sell_price_vnd, reorder_point, reorder_qty, supplier_id)
    values (p_ws, p_sku, p_name, p_unit, p_category, p_cost, p_sell, p_reorder_point, p_reorder_qty, p_supplier)
    returning id into v_id;
  else
    update public.inventory_items set
      name = p_name, unit = p_unit, category = p_category, cost_vnd = p_cost, sell_price_vnd = p_sell, reorder_point = p_reorder_point, reorder_qty = p_reorder_qty,
      supplier_id = coalesce(p_supplier, supplier_id), updated_at = now()
    where workspace_id = p_ws and id = p_id
    returning id into v_id;
  end if;
  return v_id;
end
$$;

--
-- Name: inventory_insert_po(uuid, text, uuid, date, text, text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.inventory_insert_po(p_ws uuid, p_po_no text, p_supplier uuid, p_expected date, p_note text, p_source text, p_by text) RETURNS uuid
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
declare v_id uuid;
begin
  insert into public.inventory_purchase_orders (workspace_id, po_no, supplier_id, status, expected_at, note, source, created_by)
  values (p_ws, p_po_no, p_supplier, 'draft', p_expected, p_note, p_source, p_by)
  on conflict (workspace_id, po_no) do nothing
  returning id into v_id;
  return v_id;
end
$$;

--
-- Name: inventory_mark_po_reminded(uuid, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.inventory_mark_po_reminded(p_po uuid, p_note text) RETURNS void
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
begin
  update public.inventory_purchase_orders set reminders = reminders + 1, send_note = p_note, updated_at = now() where id = p_po;
end
$$;

--
-- Name: inventory_mark_po_sent(uuid, text, text, uuid, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.inventory_mark_po_sent(p_po uuid, p_via text, p_message text, p_work_item uuid, p_note text) RETURNS void
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
begin
  update public.inventory_purchase_orders set
    status = 'sent', sent_at = now(), sent_via = p_via, message = p_message, work_item_id = p_work_item, send_note = p_note, updated_at = now()
  where id = p_po;
end
$$;

--
-- Name: inventory_mark_po_waiting(uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.inventory_mark_po_waiting(p_po uuid, p_work_item uuid) RETURNS void
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
begin
  update public.inventory_purchase_orders set status = 'waiting_approval', work_item_id = p_work_item, updated_at = now() where id = p_po and status = 'draft';
end
$$;

--
-- Name: inventory_open_receipt(uuid, uuid, text, text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.inventory_open_receipt(p_ws uuid, p_po uuid, p_invoice text, p_note text, p_by text) RETURNS uuid
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
declare v_id uuid;
begin
  insert into public.inventory_receipts (workspace_id, po_id, invoice_no, note, received_by) values (p_ws, p_po, p_invoice, p_note, p_by) returning id into v_id;
  return v_id;
end
$$;

--
-- Name: inventory_receive_po_line(uuid, numeric, numeric); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.inventory_receive_po_line(p_line uuid, p_qty numeric, p_cost numeric) RETURNS void
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
begin
  update public.inventory_po_lines set qty_received = qty_received + p_qty, unit_cost_vnd = p_cost where id = p_line;
end
$$;

--
-- Name: inventory_recompute_po_total(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.inventory_recompute_po_total(p_po uuid) RETURNS numeric
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
declare v_total numeric;
begin
  update public.inventory_purchase_orders set
    total_vnd = coalesce((select round(sum(qty_ordered * unit_cost_vnd)) from public.inventory_po_lines where po_id = p_po), 0), updated_at = now()
  where id = p_po
  returning total_vnd into v_total;
  return v_total;
end
$$;

--
-- Name: inventory_refuse_po(uuid, uuid, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.inventory_refuse_po(p_ws uuid, p_po uuid, p_note text) RETURNS void
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
begin
  update public.inventory_purchase_orders set status = 'draft', work_item_id = null, send_note = p_note, updated_at = now()
  where workspace_id = p_ws and id = p_po and status = 'waiting_approval';
end
$$;

--
-- Name: inventory_save_item(uuid, uuid, text, text, text, jsonb, text, numeric, numeric, numeric, numeric, uuid, text[]); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.inventory_save_item(p_ws uuid, p_id uuid, p_sku text, p_name text, p_unit text, p_units jsonb, p_category text, p_cost numeric, p_sell numeric, p_reorder_point numeric, p_reorder_qty numeric, p_supplier uuid, p_aliases text[]) RETURNS uuid
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
declare v_id uuid;
begin
  if p_id is null then
    insert into public.inventory_items (workspace_id, sku, name, unit, units, category, cost_vnd, sell_price_vnd, reorder_point, reorder_qty, supplier_id, aliases)
    values (p_ws, p_sku, p_name, p_unit, p_units, p_category, p_cost, p_sell, p_reorder_point, p_reorder_qty, p_supplier, p_aliases)
    returning id into v_id;
  else
    update public.inventory_items set
      sku = coalesce(nullif(p_sku, ''), sku), name = p_name, unit = p_unit, units = p_units, category = p_category, cost_vnd = p_cost, sell_price_vnd = p_sell,
      reorder_point = p_reorder_point, reorder_qty = p_reorder_qty, supplier_id = p_supplier, aliases = p_aliases, updated_at = now()
    where workspace_id = p_ws and id = p_id
    returning id into v_id;
  end if;
  return v_id;
end
$$;

--
-- Name: inventory_save_location(uuid, uuid, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.inventory_save_location(p_ws uuid, p_id uuid, p_name text) RETURNS uuid
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
declare v_id uuid;
begin
  if p_id is null then
    insert into public.inventory_locations (workspace_id, name) values (p_ws, p_name) returning id into v_id;
  else
    update public.inventory_locations set name = p_name where workspace_id = p_ws and id = p_id returning id into v_id;
  end if;
  return v_id;
end
$$;

--
-- Name: inventory_save_recipe(uuid, uuid, text, text[], uuid[], numeric[]); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.inventory_save_recipe(p_ws uuid, p_id uuid, p_name text, p_aliases text[], p_item_ids uuid[], p_qtys numeric[]) RETURNS uuid
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
declare v_id uuid;
begin
  if p_id is null then
    insert into public.inventory_recipes (workspace_id, name, aliases) values (p_ws, p_name, p_aliases) returning id into v_id;
  else
    update public.inventory_recipes set name = p_name, aliases = p_aliases where workspace_id = p_ws and id = p_id returning id into v_id;
    if v_id is null then return null; end if;
    delete from public.inventory_recipe_lines where workspace_id = p_ws and recipe_id = v_id;
  end if;
  insert into public.inventory_recipe_lines (workspace_id, recipe_id, item_id, qty)
  select p_ws, v_id, line.item_id, line.qty from unnest(p_item_ids, p_qtys) as line (item_id, qty);
  return v_id;
end
$$;

--
-- Name: inventory_save_supplier(uuid, uuid, text, text, text, text, text, text, integer, text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.inventory_save_supplier(p_ws uuid, p_id uuid, p_name text, p_contact text, p_email text, p_phone text, p_zalo text, p_channel text, p_lead_time integer, p_terms text, p_note text) RETURNS uuid
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
declare v_id uuid;
begin
  if p_id is null then
    insert into public.inventory_suppliers (workspace_id, name, contact_name, email, phone, zalo, channel, lead_time_days, payment_terms, note)
    values (p_ws, p_name, p_contact, p_email, p_phone, p_zalo, p_channel, p_lead_time, p_terms, p_note)
    returning id into v_id;
  else
    update public.inventory_suppliers set
      name = p_name, contact_name = p_contact, email = p_email, phone = p_phone, zalo = p_zalo, channel = p_channel, lead_time_days = p_lead_time,
      payment_terms = p_terms, note = p_note
    where workspace_id = p_ws and id = p_id
    returning id into v_id;
  end if;
  return v_id;
end
$$;

--
-- Name: inventory_set_item_active(uuid, uuid, boolean); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.inventory_set_item_active(p_ws uuid, p_id uuid, p_active boolean) RETURNS void
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
begin
  update public.inventory_items set active = p_active, updated_at = now() where workspace_id = p_ws and id = p_id;
end
$$;

--
-- Name: inventory_set_po_message(uuid, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.inventory_set_po_message(p_po uuid, p_message text) RETURNS void
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
begin
  update public.inventory_purchase_orders set message = p_message, updated_at = now() where id = p_po;
end
$$;

--
-- Name: inventory_set_po_status(uuid, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.inventory_set_po_status(p_po uuid, p_status text) RETURNS void
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
begin
  update public.inventory_purchase_orders set status = p_status, updated_at = now() where id = p_po;
end
$$;

--
-- Name: invite_preview(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.invite_preview(token text) RETURNS TABLE(workspace_name text, email text, role text, staff_name text, state text)
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public', 'extensions'
    AS $$
  select w.name, i.email, i.role, s.name,
         case when i.revoked_at is not null then 'revoked'
              when i.accepted_at is not null then 'accepted'
              when i.expires_at < now() then 'expired'
              else 'pending' end
  from public.workspace_invites i
  join public.workspaces w on w.id = i.workspace_id
  left join public.staff s on s.id = i.staff_id
  where i.token_hash = encode(extensions.digest(token, 'sha256'), 'hex');
$$;

--
-- Name: is_manager(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.is_manager(ws uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select coalesce(public.member_role(ws) in ('owner', 'manager'), false);
$$;

--
-- Name: is_member(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.is_member(ws uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select exists (select 1 from public.workspace_members m where m.workspace_id = ws and m.user_id = auth.uid() and m.status = 'active');
$$;

--
-- Name: is_owner(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.is_owner(ws uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select coalesce(public.member_role(ws) = 'owner', false);
$$;

--
-- Name: is_platform_admin(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.is_platform_admin() RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select auth.uid() is not null
    and exists (
      select 1 from public.platform_admins a
      where a.email = lower(btrim(coalesce(auth.jwt() ->> 'email', '')))
    );
$$;

--
-- Name: job_ack(text, bigint); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.job_ack(p_queue text, p_msg_id bigint) RETURNS boolean
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_ok boolean;
begin
  v_ok := pgmq.delete(p_queue, p_msg_id);
  delete from public.job_slots where queue = p_queue and msg_id = p_msg_id;
  update public.job_outbox set state = 'done', finished_at = now(), last_error = null where queue = p_queue and msg_id = p_msg_id;
  return coalesce(v_ok, false);
end $$;

--
-- Name: job_archive(text, bigint, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.job_archive(p_queue text, p_msg_id bigint, p_error text DEFAULT NULL::text) RETURNS boolean
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_ok boolean;
begin
  v_ok := pgmq.archive(p_queue, p_msg_id);
  delete from public.job_slots where queue = p_queue and msg_id = p_msg_id;
  update public.job_outbox set state = 'failed', finished_at = now(), last_error = left(p_error, 1000) where queue = p_queue and msg_id = p_msg_id;
  return coalesce(v_ok, false);
end $$;

--
-- Name: job_enqueue(uuid, text, text, jsonb, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.job_enqueue(p_workspace uuid, p_queue text, p_name text, p_payload jsonb, p_dedupe text) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_id uuid;
  v_msg bigint;
begin
  insert into public.job_outbox (workspace_id, queue, name, payload, dedupe_key)
  values (p_workspace, p_queue, p_name, coalesce(p_payload, '{}'::jsonb), p_dedupe)
  on conflict (dedupe_key) do nothing
  returning id into v_id;
  if v_id is null then
    select id into v_id from public.job_outbox where dedupe_key = p_dedupe;
    return v_id;
  end if;
  select pgmq.send(p_queue, public.job_message(p_name, p_payload, p_dedupe, v_id)) into v_msg;
  update public.job_outbox set msg_id = v_msg, sent_at = now() where id = v_id;
  return v_id;
end $$;

--
-- Name: job_fail(text, bigint, integer, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.job_fail(p_queue text, p_msg_id bigint, p_delay_s integer, p_error text DEFAULT NULL::text) RETURNS boolean
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
begin
  perform pgmq.set_vt(p_queue, p_msg_id, greatest(0, p_delay_s));
  delete from public.job_slots where queue = p_queue and msg_id = p_msg_id;
  update public.job_outbox set state = 'queued', last_error = left(p_error, 1000) where queue = p_queue and msg_id = p_msg_id;
  return true;
end $$;

--
-- Name: job_message(text, jsonb, text, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.job_message(p_name text, p_payload jsonb, p_dedupe text, p_outbox uuid) RETURNS jsonb
    LANGUAGE sql IMMUTABLE
    AS $$ select jsonb_build_object('name', p_name, 'payload', coalesce(p_payload, '{}'::jsonb), 'dedupe', p_dedupe, 'outbox_id', p_outbox) $$;

--
-- Name: job_read(text, integer, integer, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.job_read(p_queue text, p_vt integer, p_qty integer, p_ws_limit integer DEFAULT 2) RETURNS TABLE(msg_id bigint, attempt integer, enqueued_at timestamp with time zone, message jsonb)
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $_$
declare
  r record;
  v_ws uuid;
  v_ws_text text;
  v_busy int;
  v_attempt int;
begin
  for r in select * from pgmq.read(p_queue, greatest(5, p_vt), greatest(1, least(p_qty, 100))) loop
    v_ws_text := r.message->'payload'->>'workspaceId';
    v_ws := case when v_ws_text ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then v_ws_text::uuid end;
    if v_ws is not null then
      perform pg_advisory_xact_lock(hashtextextended('nivo.job-ws:' || v_ws::text, 0));
      delete from public.job_slots s where s.workspace_id = v_ws and s.lease_until < now();
      select count(*) into v_busy from public.job_slots s where s.workspace_id = v_ws and not (s.queue = p_queue and s.msg_id = r.msg_id);
      if v_busy >= greatest(1, p_ws_limit) then
        perform pgmq.set_vt(p_queue, r.msg_id, 3 + floor(random() * 2)::int);
        continue;
      end if;
      insert into public.job_slots as s (queue, msg_id, workspace_id, lease_until)
      values (p_queue, r.msg_id, v_ws, now() + make_interval(secs => greatest(5, p_vt)))
      on conflict on constraint job_slots_pkey do update set lease_until = excluded.lease_until;
    end if;
    v_attempt := null;
    update public.job_outbox o set attempts = o.attempts + 1, state = 'running', started_at = now()
     where o.queue = p_queue and o.msg_id = r.msg_id
    returning o.attempts into v_attempt;
    return query select r.msg_id, coalesce(v_attempt, r.read_ct), r.enqueued_at, r.message;
  end loop;
end $_$;

--
-- Name: job_requeue(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.job_requeue(p_outbox uuid) RETURNS bigint
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  o public.job_outbox;
  v_msg bigint;
begin
  select * into o from public.job_outbox where id = p_outbox and state = 'failed' for update;
  if o.id is null then return null; end if;
  select pgmq.send(o.queue, public.job_message(o.name, o.payload, o.dedupe_key, o.id)) into v_msg;
  update public.job_outbox set msg_id = v_msg, sent_at = now(), state = 'queued', attempts = 0, finished_at = null where id = o.id;
  return v_msg;
end $$;

--
-- Name: job_stats(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.job_stats() RETURNS jsonb
    LANGUAGE sql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select jsonb_build_object(
    'queues', coalesce((
      select jsonb_object_agg(q.queue_name, jsonb_build_object(
        'depth', m.queue_length, 'oldestAgeSeconds', coalesce(m.oldest_msg_age_sec, 0), 'total', m.total_messages))
        from pgmq.list_queues() q cross join lateral pgmq.metrics(q.queue_name) m), '{}'::jsonb),
    'running', (select count(*) from public.job_slots where lease_until > now()),
    'failed24h', (select count(*) from public.job_outbox where state = 'failed' and finished_at > now() - interval '24 hours'),
    'oldestQueuedAgeSeconds', coalesce((select extract(epoch from now() - min(created_at))::int from public.job_outbox where state = 'queued'), 0),
    'checkedAt', now()
  );
$$;

--
-- Name: job_status(uuid, text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.job_status(p_workspace uuid, p_queue text, p_dedupe text) RETURNS TABLE(id uuid, state text, attempts integer)
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO ''
    AS $$
  select o.id, o.state, o.attempts
  from public.job_outbox o
  where o.workspace_id = p_workspace
    and o.queue = p_queue
    and o.dedupe_key = p_dedupe
    and p_queue in ('chat_turn', 'decisions')
  limit 1
$$;

--
-- Name: job_status(uuid, text, text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.job_status(p_workspace_id uuid, p_queue text, p_name text, p_dedupe_key text) RETURNS TABLE(id uuid, state text)
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO ''
    AS $$
    select o.id, o.state
    from public.job_outbox o
    where o.workspace_id = p_workspace_id
        and o.queue = p_queue
        and o.name = p_name
        and o.dedupe_key = p_dedupe_key
    limit 1;
$$;

--
-- Name: job_touch(text, bigint, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.job_touch(p_queue text, p_msg_id bigint, p_vt integer) RETURNS boolean
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
begin
  perform pgmq.set_vt(p_queue, p_msg_id, greatest(0, p_vt));
  update public.job_slots set lease_until = now() + make_interval(secs => greatest(5, p_vt)) where queue = p_queue and msg_id = p_msg_id;
  return found;
end $$;

--
-- Name: knowledge_chunk_visibility_sync(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.knowledge_chunk_visibility_sync() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
begin
  if new.visibility is distinct from old.visibility or new.module is distinct from old.module then
    update public.knowledge_chunks set visibility = new.visibility, module = new.module where source_id = new.id;
  end if;
  return new;
end;
$$;

--
-- Name: knowledge_enqueue_source(uuid, text, text, text, text, jsonb); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.knowledge_enqueue_source(p_workspace uuid, p_kind text, p_title text, p_storage_path text, p_url text, p_meta jsonb) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $_$
declare
  v_meta jsonb := coalesce(p_meta, '{}'::jsonb);
  v_id uuid;
  v_title text := left(btrim(coalesce(p_title, '')), 160);
  v_content text := '';
  v_tags text[];
  v_module text := nullif(btrim(coalesce(v_meta->>'module', '')), '');
  v_inst uuid;
  v_inst_raw text := nullif(btrim(coalesce(v_meta->>'installationId', '')), '');
begin
  if coalesce(auth.role(), '') <> 'service_role' and not public.is_manager(p_workspace) then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  if p_kind not in ('file', 'url', 'text', 'faq') then
    raise exception 'unknown kind %', p_kind using errcode = '22023';
  end if;
  if p_kind = 'file' then
    if p_storage_path is null or split_part(p_storage_path, '/', 1) <> p_workspace::text or p_storage_path like '%..%' then
      raise exception 'storage path must start with the workspace id' using errcode = '22023';
    end if;
    if v_title = '' then v_title := left(regexp_replace(regexp_replace(p_storage_path, '^.*/', ''), '\.[^.]+$', ''), 160); end if;
  elsif p_kind = 'url' then
    if p_url is null or p_url !~* '^https?://' then
      raise exception 'url must be http(s)' using errcode = '22023';
    end if;
    v_content := p_url;
    if v_title = '' then v_title := left(regexp_replace(p_url, '^https?://', ''), 160); end if;
  else
    v_content := btrim(coalesce(v_meta->>'content', ''));
    if v_content = '' then raise exception 'content is empty' using errcode = '22023'; end if;
    if v_title = '' then raise exception 'title is required' using errcode = '22023'; end if;
  end if;
  if v_module is not null and not exists (select 1 from public.modules where key = v_module) then v_module := null; end if;
  -- One agent instance may be the only reader of the document (null = shared by every instance of the type). It must belong to this workspace.
  if v_inst_raw is not null then
    begin
      v_inst := v_inst_raw::uuid;
    exception when invalid_text_representation then
      raise exception 'invalid installation' using errcode = '22023';
    end;
    if not exists (select 1 from public.module_installations i where i.id = v_inst and i.workspace_id = p_workspace) then
      raise exception 'installation does not belong to the workspace' using errcode = '22023';
    end if;
    select i.module_key into v_module from public.module_installations i where i.id = v_inst; -- the document's module is the instance's type
  end if;
  select coalesce(array_agg(distinct left(btrim(t), 40)) filter (where btrim(t) <> ''), '{}')
    into v_tags
    from jsonb_array_elements_text(case when jsonb_typeof(v_meta->'tags') = 'array' then v_meta->'tags' else '[]'::jsonb end) t;

  insert into public.knowledge_sources (workspace_id, module, kind, title, content, status, progress, topic, tags, visibility, storage_path, source_url, origin, created_by, installation_id)
  values (
    p_workspace, v_module, p_kind, v_title, v_content, 'queued', 0,
    nullif(left(btrim(coalesce(v_meta->>'topic', '')), 80), ''), v_tags[1:12],
    case when v_meta->>'visibility' = 'public' then 'public' else 'internal' end,
    case when p_kind = 'file' then p_storage_path end,
    case when p_kind = 'url' then p_url end,
    nullif(left(btrim(coalesce(v_meta->>'origin', '')), 300), ''),
    auth.uid(),
    v_inst
  )
  returning id into v_id;

  perform public.job_enqueue(p_workspace, 'knowledge', 'knowledge.index', jsonb_build_object('sourceId', v_id, 'workspaceId', p_workspace), 'knowledge.index:' || v_id);
  return v_id;
end $_$;

--
-- Name: knowledge_fold(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.knowledge_fold(t text) RETURNS text
    LANGUAGE sql IMMUTABLE PARALLEL SAFE
    SET search_path TO 'public', 'extensions'
    AS $$
  select lower(extensions.unaccent('extensions.unaccent'::regdictionary, coalesce(t, '')));
$$;

--
-- Name: knowledge_retry_source(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.knowledge_retry_source(p_source uuid) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_ws uuid;
  v_status text;
begin
  select workspace_id, status into v_ws, v_status from public.knowledge_sources where id = p_source for update;
  if v_ws is null then raise exception 'not found' using errcode = 'P0002'; end if;
  if coalesce(auth.role(), '') <> 'service_role' and not public.is_manager(v_ws) then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  if v_status not in ('failed', 'blocked_credits') then
    return p_source; -- already queued, running or ready: nothing to do
  end if;
  update public.knowledge_sources set status = 'queued', progress = 0, error = null, updated_at = now() where id = p_source;
  perform public.job_enqueue(v_ws, 'knowledge', 'knowledge.index', jsonb_build_object('sourceId', p_source, 'workspaceId', v_ws),
          'knowledge.index:' || p_source || ':retry:' || floor(extract(epoch from clock_timestamp()) * 1000)::bigint);
  return p_source;
end $$;

--
-- Name: lead_actor_name(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.lead_actor_name(p_workspace uuid) RETURNS text
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_name text;
begin
  if auth.uid() is null then
    raise exception 'not_signed_in' using errcode = '42501';
  end if;
  select m.display_name into v_name from public.workspace_members m
   where m.workspace_id = p_workspace and m.user_id = auth.uid() and m.status = 'active';
  if not found then
    raise exception 'WORKSPACE_MEMBERS_NOT_MEMBER' using errcode = '42501';
  end if;
  return v_name;
end;
$$;

--
-- Name: lead_flows_fill_installation(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.lead_flows_fill_installation() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
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

--
-- Name: responsibilities; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.responsibilities (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    workspace_id uuid NOT NULL,
    lead_id uuid NOT NULL,
    title text NOT NULL,
    owner_kind text NOT NULL,
    owner_agent_id uuid,
    owner_name text NOT NULL,
    next_action text NOT NULL,
    due_at timestamp with time zone,
    status text DEFAULT 'open'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT responsibilities_owner_kind_check CHECK ((owner_kind = ANY (ARRAY['human'::text, 'agent'::text]))),
    CONSTRAINT responsibilities_status_check CHECK ((status = ANY (ARRAY['open'::text, 'waiting_approval'::text, 'done'::text])))
);

--
-- Name: lead_step_json(public.responsibilities); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.lead_step_json(r public.responsibilities) RETURNS jsonb
    LANGUAGE sql IMMUTABLE
    SET search_path TO 'public'
    AS $$
  select jsonb_build_object(
    'id', r.id, 'leadId', r.lead_id, 'title', r.title, 'ownerKind', r.owner_kind, 'ownerAgentId', r.owner_agent_id,
    'ownerName', r.owner_name, 'nextAction', r.next_action,
    'dueAt', to_char(r.due_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'), 'status', r.status
  );
$$;

--
-- Name: lead_step_owner(uuid, text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.lead_step_owner(p_workspace uuid, p_owner text, p_actor text, OUT o_kind text, OUT o_agent uuid, OUT o_name text) RETURNS record
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $_$
begin
  if p_owner = 'human' then
    o_kind := 'human';
    o_agent := null;
    o_name := p_actor;
    return;
  end if;
  if p_owner !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    raise exception 'RESPONSIBILITIES_AGENT_NOT_FOUND' using errcode = 'P0002';
  end if;
  select a.id, a.name into o_agent, o_name from public.agents a where a.workspace_id = p_workspace and a.id = p_owner::uuid;
  if not found then
    raise exception 'RESPONSIBILITIES_AGENT_NOT_FOUND' using errcode = 'P0002';
  end if;
  o_kind := 'agent';
end;
$_$;

--
-- Name: loyalty_ledger_immutable(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.loyalty_ledger_immutable() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
begin
  raise exception 'loyalty_ledger is append-only (add an adjust row instead)';
end $$;

--
-- Name: loyalty_post(uuid, uuid, text, integer, text, text, bigint, uuid, uuid, uuid, uuid, text, timestamp with time zone, timestamp with time zone); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.loyalty_post(p_workspace uuid, p_customer uuid, p_kind text, p_points integer, p_ref text, p_by text, p_amount_vnd bigint DEFAULT NULL::bigint, p_order_id uuid DEFAULT NULL::uuid, p_invoice_id uuid DEFAULT NULL::uuid, p_reward_id uuid DEFAULT NULL::uuid, p_work_item_id uuid DEFAULT NULL::uuid, p_evidence text DEFAULT NULL::text, p_expires_at timestamp with time zone DEFAULT NULL::timestamp with time zone, p_occurred_at timestamp with time zone DEFAULT NULL::timestamp with time zone) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_id uuid;
  v_balance int;
  v_reward public.loyalty_rewards%rowtype;
begin
  perform 1 from public.loyalty_customers where id = p_customer and workspace_id = p_workspace for update;
  if not found then raise exception 'customer_not_found'; end if;
  if exists (select 1 from public.loyalty_ledger where workspace_id = p_workspace and ref = p_ref) then return null; end if;
  if p_points < 0 then
    select coalesce(sum(points), 0) into v_balance from public.loyalty_ledger where customer_id = p_customer;
    if v_balance + p_points < 0 then raise exception 'insufficient_points'; end if;
  end if;
  if p_kind = 'redeem' and p_reward_id is not null then
    select * into v_reward from public.loyalty_rewards where id = p_reward_id and workspace_id = p_workspace for update;
    if not found then raise exception 'reward_not_found'; end if;
    if not v_reward.active then raise exception 'reward_inactive'; end if;
    if v_reward.stock is not null and v_reward.stock <= 0 then raise exception 'out_of_stock'; end if;
    if v_reward.per_customer_limit is not null
       and (select count(*) from public.loyalty_ledger where customer_id = p_customer and reward_id = p_reward_id and kind = 'redeem') >= v_reward.per_customer_limit then
      raise exception 'limit_reached';
    end if;
    if v_reward.stock is not null then update public.loyalty_rewards set stock = stock - 1 where id = p_reward_id; end if;
  end if;
  insert into public.loyalty_ledger (workspace_id, customer_id, kind, points, amount_vnd, order_id, invoice_id, reward_id, work_item_id, ref, by_name, evidence, expires_at, occurred_at)
  values (p_workspace, p_customer, p_kind, p_points, p_amount_vnd, p_order_id, p_invoice_id, p_reward_id, p_work_item_id, p_ref, coalesce(nullif(p_by, ''), 'NIVO'), p_evidence, p_expires_at, coalesce(p_occurred_at, now()))
  returning id into v_id;
  return v_id;
end $$;

--
-- Name: match_knowledge(uuid, text, extensions.vector, text, integer, text, text, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.match_knowledge(p_workspace uuid, p_module text, p_query_embedding extensions.vector DEFAULT NULL::extensions.vector, p_query text DEFAULT ''::text, p_limit integer DEFAULT 8, p_audience text DEFAULT 'internal'::text, p_query_model text DEFAULT NULL::text, p_installation uuid DEFAULT NULL::uuid) RETURNS TABLE(layer text, id uuid, source_id uuid, module text, kind text, title text, content text, score real, visibility text, topic text)
    LANGUAGE plpgsql STABLE
    SET search_path TO 'public', 'extensions'
    AS $$
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

--
-- Name: member_role(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.member_role(ws uuid) RETURNS text
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select m.role from public.workspace_members m
  where m.workspace_id = ws and m.user_id = auth.uid() and m.status = 'active';
$$;

--
-- Name: module_context_versions_immutable(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.module_context_versions_immutable() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
begin
  if tg_op = 'UPDATE' then raise exception 'context_version_immutable' using errcode = 'P0001'; end if;
  return old;
end;
$$;

--
-- Name: module_installations_fill(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.module_installations_fill() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
begin
  new.is_multi := coalesce((select m.multi_instance from public.modules m where m.key = new.module_key), false);
  if new.name is null or trim(new.name) = '' then
    new.name := public.module_type_name(new.module_key);
  end if;
  new.name := left(trim(new.name), 80);
  return new;
end;
$$;

--
-- Name: module_type_name(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.module_type_name(p_key text) RETURNS text
    LANGUAGE sql STABLE
    SET search_path TO 'public'
    AS $$
  select coalesce(nullif(trim(m.definition #>> '{name,vi}'), ''), initcap(replace(p_key, '_', ' ')))
  from (select p_key as key) k left join public.modules m on m.key = k.key;
$$;

--
-- Name: my_sessions(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.my_sessions() RETURNS TABLE(id uuid, created_at timestamp with time zone, last_active_at timestamp with time zone, user_agent text, ip text)
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO ''
    AS $$
  select s.id,
         s.created_at,
         coalesce(s.refreshed_at at time zone 'utc', s.updated_at, s.created_at) as last_active_at,
         s.user_agent,
         host(s.ip) as ip
    from auth.sessions s
   where s.user_id = auth.uid()
     and (s.not_after is null or s.not_after > now())
   order by 3 desc nulls last;
$$;

--
-- Name: my_staff_id(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.my_staff_id(ws uuid) RETURNS uuid
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select m.staff_id from public.workspace_members m
  where m.workspace_id = ws and m.user_id = auth.uid() and m.status = 'active';
$$;

--
-- Name: n8n_runs_mirror(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.n8n_runs_mirror() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare v_pipeline uuid;
begin
  select id into v_pipeline from public.automation_pipelines where workspace_id = new.workspace_id and template_key = new.template_key;
  if v_pipeline is null then return new; end if;
  insert into public.automation_runs (pipeline_id, workspace_id, trigger_ref, dedupe_key, payload, status, steps, evidence, error, attempts, run_at, created_at, finished_at)
  values (
    v_pipeline, new.workspace_id, new.template_key, 'n8n:' || new.id, jsonb_build_object('n8n_run_id', new.id, 'dedupe', new.dedupe_key), new.status,
    jsonb_build_array(jsonb_build_object(
      'label', case new.status when 'queued' then 'Đã xếp lượt chạy cho n8n' when 'running' then 'n8n đang chạy' when 'done' then 'n8n đã chạy xong' when 'skipped' then 'Bỏ qua' else 'Lỗi' end,
      'status', case new.status when 'done' then 'done' when 'skipped' then 'skipped' when 'failed' then 'failed' else 'waiting' end,
      'detail', new.summary)),
    new.summary, case when new.status = 'failed' then new.summary end, 1, new.created_at, new.created_at, new.finished_at)
  on conflict (pipeline_id, dedupe_key) do update
    set status = excluded.status, steps = excluded.steps, evidence = excluded.evidence, error = excluded.error, finished_at = excluded.finished_at;
  return new;
end $$;

--
-- Name: office_data(uuid, timestamp with time zone); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.office_data(ws uuid, since7 timestamp with time zone) RETURNS jsonb
    LANGUAGE sql STABLE
    SET search_path TO 'public'
    AS $$
  with exec_json as (
    select x.status as st, x.created_at as c_at, x.decided_at as d_at,
           to_jsonb(x) || jsonb_build_object(
             'responsibility', (select to_jsonb(r) || jsonb_build_object('lead', (select jsonb_build_object('id', l.id, 'contact_name', l.contact_name, 'company', l.company, 'channel', l.channel)
                                                                                 from leads l where l.id = r.lead_id))
                                from responsibilities r where r.id = x.responsibility_id),
             'work_item', (select jsonb_build_object('id', w.id, 'assigned_staff_id', w.assigned_staff_id) from work_items w where w.id = x.work_item_id),
             'agent', (select jsonb_build_object('id', a.id, 'name', a.name) from agents a where a.id = x.agent_id)) as j
    from executions x where x.workspace_id = ws and x.status in ('pending_approval', 'approved', 'rejected')
  )
  select jsonb_build_object(
    'messages', coalesce((select jsonb_agg(to_jsonb(m) order by m.created_at desc)
                          from (select * from messages where workspace_id = ws order by created_at desc limit 100) m), '[]'::jsonb),
    'agents', coalesce((select jsonb_agg(to_jsonb(a) order by a.created_at) from agents a where a.workspace_id = ws), '[]'::jsonb),
    'responsibilities', public.responsibility_rows(ws),
    'pending', coalesce((select jsonb_agg(j order by c_at desc) from exec_json where st = 'pending_approval'), '[]'::jsonb),
    'decided', coalesce((select jsonb_agg(z.j order by z.d_at desc nulls last)
                         from (select j, d_at from exec_json where st in ('approved', 'rejected') order by d_at desc nulls last limit 8) z), '[]'::jsonb),
    'leads', coalesce((select jsonb_agg(to_jsonb(l) order by l.created_at desc) from leads l where l.workspace_id = ws), '[]'::jsonb),
    'open_responsibilities', coalesce((select jsonb_agg(jsonb_build_object('lead_id', r.lead_id, 'owner_name', r.owner_name, 'next_action', r.next_action, 'status', r.status))
                                       from responsibilities r where r.workspace_id = ws and r.status <> 'done'), '[]'::jsonb),
    'exceptions', public.exception_rows(ws),
    'recent_items', coalesce((select jsonb_agg(to_jsonb(w) || jsonb_build_object(
                                'lead', (select jsonb_build_object('id', l.id, 'contact_name', l.contact_name, 'company', l.company, 'channel', l.channel) from leads l where l.id = w.lead_id),
                                'staff', (select jsonb_build_object('name', s.name) from staff s where s.id = w.assigned_staff_id),
                                'decisions', coalesce((select jsonb_agg(jsonb_build_object('decided_by', d.decided_by, 'created_at', d.created_at)) from decisions d where d.work_item_id = w.id), '[]'::jsonb))
                              order by w.created_at desc)
                              from (select * from work_items where workspace_id = ws and status in ('done', 'rejected') order by created_at desc limit 40) w), '[]'::jsonb),
    'governance', public.governance_rows(ws, since7),
    'staff', coalesce((select jsonb_agg(to_jsonb(s) order by s.active desc, s.created_at) from staff s where s.workspace_id = ws), '[]'::jsonb),
    'members', coalesce((select jsonb_agg(to_jsonb(m)) from public.workspace_members_directory(ws) m), '[]'::jsonb)
  );
$$;

--
-- Name: owns_workspace(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.owns_workspace(ws uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select coalesce(public.member_role(ws) = 'owner', false);
$$;

--
-- Name: payment_order_request(uuid, text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.payment_order_request(p_workspace uuid, p_kind text, p_target text) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $_$
declare
    v_id uuid;
begin
    if auth.uid() is null or not public.is_manager(p_workspace) then
        raise exception 'not allowed' using errcode = '42501';
    end if;
    if p_kind not in ('plan', 'renew', 'topup', 'upgrade') then
        raise exception 'unknown kind %', p_kind using errcode = '22023';
    end if;
    if p_kind <> 'renew' and (p_target is null or p_target !~ '^[a-z0-9_-]{1,40}$') then
        raise exception 'a target is required' using errcode = '22023';
    end if;
    insert into public.payment_order_requests (workspace_id, requested_by, kind, target)
    values (p_workspace, auth.uid(), p_kind, case when p_kind = 'renew' then null else p_target end)
    returning id into v_id;
    perform public.job_enqueue(
        p_workspace,
        'payment_order_requested',
        'payment_order_requested',
        jsonb_build_object('workspaceId', p_workspace, 'requestId', v_id),
        'payment-order-request:' || v_id::text
    );
    return v_id;
end;
$_$;

--
-- Name: post_ai_usage_notice(uuid, date, text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.post_ai_usage_notice(p_workspace uuid, p_period date, p_level text, p_body text) RETURNS boolean
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_claimed int;
begin
  insert into public.ai_usage_notices (workspace_id, period, level) values (p_workspace, p_period, p_level)
  on conflict do nothing;
  get diagnostics v_claimed = row_count;
  if v_claimed = 0 then
    return false;
  end if;
  insert into public.messages (workspace_id, author_kind, author_name, body) values (p_workspace, 'system', 'NIVO', p_body);
  return true;
end;
$$;

--
-- Name: post_office_notice(uuid, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.post_office_notice(p_workspace uuid, p_body text) RETURNS void
    LANGUAGE sql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
    insert into public.messages (workspace_id, author_kind, author_name, body)
    values (p_workspace, 'system', 'NIVO', p_body)
$$;

--
-- Name: promo_state(uuid, timestamp with time zone, timestamp with time zone); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.promo_state(ws uuid, founding_from timestamp with time zone, founding_to timestamp with time zone) RETURNS jsonb
    LANGUAGE sql STABLE
    SET search_path TO 'public'
    AS $$
  with website as (select l.id, l.created_at from leads l where l.workspace_id = ws and l.channel ilike '%website%'),
       approved as (select x.responsibility_id from executions x where x.workspace_id = ws and x.status = 'approved')
  select jsonb_build_object(
    'chatbot', (select jsonb_build_object('id', a.id, 'knowledge', a.knowledge) from agents a
                where a.workspace_id = ws and a.module = 'chatbot' order by a.created_at limit 1),
    'is_founding_member', exists (select 1 from events e where e.workspace_id = ws and e.kind = 'module.purchased'
                                  and e.created_at >= founding_from and e.created_at <= founding_to),
    'website_leads', coalesce((select jsonb_agg(jsonb_build_object('id', id, 'created_at', created_at)) from website), '[]'::jsonb),
    -- first response per website lead: earliest approval or assignment event
    'first_events', coalesce((select jsonb_agg(jsonb_build_object('lead_id', e.lead_id, 'at', e.first_at))
                              from (select lead_id, min(created_at) as first_at from events
                                    where workspace_id = ws and kind in ('execution.approved', 'responsibility.assigned')
                                      and lead_id in (select id from website) group by lead_id) e), '[]'::jsonb),
    'has_customer_conversation', exists (select 1 from agent_conversations c where c.workspace_id = ws and c.kind = 'customer'),
    'has_lead_conversation', exists (select 1 from agent_conversations c where c.workspace_id = ws and c.lead_id is not null),
    'approved_count', (select count(*) from approved),
    'has_won', exists (select 1 from events e where e.workspace_id = ws and e.kind = 'outcome.recorded'
                       and e.lead_id in (select id from leads where workspace_id = ws and stage = 'won')),
    'invoice_approved', exists (select 1 from responsibilities r where r.workspace_id = ws
                                and (r.title ilike 'Prepare invoice%' or r.title ilike 'Chuẩn bị hóa đơn%')
                                and r.id in (select responsibility_id from approved))
  );
$$;

--
-- Name: read_app_command(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.read_app_command(p_id uuid) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  c public.app_commands;
  v_result jsonb;
begin
  select * into c from public.app_commands where id = p_id and requested_by = auth.uid();
  if not found then
    raise exception 'COMMAND_NOT_FOUND' using errcode = 'P0002';
  end if;
  v_result := c.result;
  if c.state = 'done' and c.result ? 'link' then
    update public.app_commands set result = c.result - 'link' where id = c.id;
  end if;
  return jsonb_build_object('state', c.state, 'result', v_result, 'errorCode', c.error_code);
end;
$$;

--
-- Name: record_ai_usage(uuid, text, text, text, integer, integer, numeric, boolean); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.record_ai_usage(p_workspace uuid, p_kind text, p_module text, p_model text, p_prompt integer, p_completion integer, p_cost numeric, p_estimated boolean) RETURNS void
    LANGUAGE sql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  insert into public.ai_usage_events (workspace_id, kind, module, model, prompt_tokens, completion_tokens, cost_usd, estimated)
  values (p_workspace, p_kind, p_module, p_model, greatest(p_prompt, 0), greatest(p_completion, 0), greatest(p_cost, 0), p_estimated);
$$;

--
-- Name: record_lead_outcome(uuid, uuid, text, text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.record_lead_outcome(p_workspace uuid, p_lead uuid, p_stage text, p_evidence text, p_locale text DEFAULT 'vi'::text) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_actor text := public.lead_actor_name(p_workspace);
  v_en boolean := coalesce(p_locale, 'vi') = 'en';
  v_lead record;
  v_label text;
  v_agent record;
  v_handed boolean := false;
begin
  if p_stage not in ('new', 'qualified', 'proposal', 'won', 'lost') then
    raise exception 'stage_invalid' using errcode = '22023';
  end if;
  update public.leads set stage = p_stage where workspace_id = p_workspace and id = p_lead
  returning id, contact_name, company, channel, need, stage into v_lead;
  if not found then
    raise exception 'LEADS_NOT_FOUND' using errcode = 'P0002';
  end if;
  v_label := case p_stage
    when 'new' then case when v_en then 'new' else 'mới' end
    when 'qualified' then case when v_en then 'qualified' else 'đủ điều kiện' end
    when 'proposal' then case when v_en then 'proposal' else 'đề xuất' end
    when 'won' then case when v_en then 'won' else 'chốt được' end
    else case when v_en then 'lost' else 'không chốt' end
  end;
  insert into public.events (workspace_id, lead_id, kind, actor, summary, evidence)
  values (p_workspace, p_lead, 'outcome.recorded', v_actor,
          case when v_en then 'Stage → ' else 'Giai đoạn → ' end || v_label, nullif(p_evidence, ''));
  insert into public.messages (workspace_id, lead_id, author_kind, author_name, body)
  values (p_workspace, p_lead, 'system', 'NIVO',
          case when v_en then v_lead.contact_name || ' moved to ' || v_label || '.' else v_lead.contact_name || ' chuyển sang ' || v_label || '.' end);
  if p_stage = 'won' then
    select a.id, a.name into v_agent from public.agents a
     where a.workspace_id = p_workspace and a.module = 'accounting' and a.status = 'active'
     order by a.created_at limit 1;
    if found then
      insert into public.responsibilities (workspace_id, lead_id, title, owner_kind, owner_agent_id, owner_name, next_action, due_at)
      values (p_workspace, p_lead,
              case when v_en then 'Prepare invoice for ' || v_lead.contact_name else 'Chuẩn bị hóa đơn cho ' || v_lead.contact_name end,
              'agent', v_agent.id, v_agent.name,
              case when v_en then 'Draft the invoice from the agreed scope for owner approval'
                   else 'Soạn hóa đơn theo phạm vi đã thống nhất để chủ doanh nghiệp duyệt' end,
              now() + interval '1 day');
      insert into public.events (workspace_id, lead_id, kind, actor, summary)
      values (p_workspace, p_lead, 'responsibility.assigned', 'Sales Agent',
              case when v_en then 'Handed to ' || v_agent.name || ' · Next action: Draft the invoice from the agreed scope'
                   else 'Đã bàn giao cho ' || v_agent.name || ' · Bước tiếp theo: Soạn hóa đơn theo phạm vi đã thống nhất' end);
      v_handed := true;
    end if;
  end if;
  return jsonb_build_object(
    'leadId', v_lead.id, 'stage', v_lead.stage, 'contactName', v_lead.contact_name, 'company', v_lead.company,
    'channel', v_lead.channel, 'need', v_lead.need,
    'origin', (select l.origin from public.leads l where l.id = p_lead), 'handedToAccounting', v_handed
  );
end;
$$;

--
-- Name: request_admin_invite_resend(uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.request_admin_invite_resend(p_workspace uuid, p_invite uuid) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_id uuid;
begin
  if not public.is_platform_admin() then
    raise exception 'not_platform_admin' using errcode = '42501';
  end if;
  insert into public.app_commands (workspace_id, requested_by, kind, input)
  values (
    p_workspace, auth.uid(), 'admin.invite.resend',
    jsonb_build_object('inviteId', p_invite, 'actorEmail', lower(btrim(auth.jwt() ->> 'email')))
  )
  returning id into v_id;
  perform public.job_enqueue(p_workspace, 'invite_command', 'invite_command', jsonb_build_object('workspaceId', p_workspace, 'commandId', v_id), 'invite_command:' || v_id::text);
  return v_id;
end;
$$;

--
-- Name: request_agent_sync(uuid, uuid, boolean); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.request_agent_sync(p_workspace uuid, p_installation uuid DEFAULT NULL::uuid, p_force boolean DEFAULT false) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_subject text := coalesce(p_installation::text, 'ws:' || p_workspace::text);
begin
  if auth.uid() is null or not public.is_manager(p_workspace) then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  if p_installation is not null and not exists (
    select 1 from public.module_installations i where i.id = p_installation and i.workspace_id = p_workspace
  ) then
    raise exception 'installation not found' using errcode = 'P0002';
  end if;
  return public.job_enqueue(
    p_workspace, 'agents', 'agents.sync',
    jsonb_strip_nulls(jsonb_build_object(
      'workspaceId', p_workspace, 'installationId', p_installation, 'force', coalesce(p_force, false),
      'requestedAt', (extract(epoch from now()) * 1000)::bigint)),
    'agents.sync:' || v_subject || ':' || floor(extract(epoch from now()) / 60)::bigint::text);
end $$;

--
-- Name: request_execution_decision(uuid, uuid, text, text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.request_execution_decision(p_workspace uuid, p_execution uuid, p_decision text, p_edited_draft text DEFAULT NULL::text, p_locale text DEFAULT 'vi'::text) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
begin
  if auth.uid() is null or not public.is_member(p_workspace) then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  if p_decision not in ('approved', 'rejected') then
    raise exception 'unknown decision %', p_decision using errcode = '22023';
  end if;
  if not exists (
    select 1 from public.executions e where e.id = p_execution and e.workspace_id = p_workspace and e.status = 'pending_approval'
  ) then
    raise exception 'approval card is not pending' using errcode = 'P0002';
  end if;
  return public.job_enqueue(
    p_workspace, 'decisions', 'decisions.decide-execution',
    jsonb_build_object(
      'workspaceId', p_workspace, 'userId', auth.uid(), 'locale', case when p_locale = 'en' then 'en' else 'vi' end,
      'executionId', p_execution, 'decision', p_decision, 'editedDraft', left(p_edited_draft, 10000)),
    'decisions.decide-execution:' || p_execution::text);
end $$;

--
-- Name: request_invite_command(uuid, text, uuid, text, text, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.request_invite_command(p_workspace uuid, p_action text, p_invite uuid DEFAULT NULL::uuid, p_email text DEFAULT NULL::text, p_role text DEFAULT NULL::text, p_staff uuid DEFAULT NULL::uuid) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_uid uuid := auth.uid();
  v_id uuid;
begin
  if v_uid is null then
    raise exception 'not_signed_in' using errcode = '42501';
  end if;
  if not public.is_manager(p_workspace) then
    raise exception 'WORKSPACE_MEMBERS_ROLE_FORBIDDEN' using errcode = '42501';
  end if;
  if p_action not in ('create', 'resend', 'link') then
    raise exception 'action_invalid' using errcode = '22023';
  end if;
  if p_action = 'create' and (p_email is null or btrim(p_email) = '' or p_role not in ('manager', 'staff')) then
    raise exception 'invite_input_invalid' using errcode = '22023';
  end if;
  if p_action <> 'create' and p_invite is null then
    raise exception 'invite_input_invalid' using errcode = '22023';
  end if;
  insert into public.app_commands (workspace_id, requested_by, kind, input)
  values (
    p_workspace, v_uid, 'invite.' || p_action,
    jsonb_strip_nulls(jsonb_build_object('inviteId', p_invite, 'email', btrim(p_email), 'role', p_role, 'staffId', p_staff))
  )
  returning id into v_id;
  perform public.job_enqueue(p_workspace, 'invite_command', 'invite_command', jsonb_build_object('workspaceId', p_workspace, 'commandId', v_id), 'invite_command:' || v_id::text);
  return v_id;
end;
$$;

--
-- Name: request_office_confirm(uuid, uuid, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.request_office_confirm(p_workspace uuid, p_candidate uuid, p_locale text DEFAULT 'vi'::text) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
begin
  if auth.uid() is null or not public.is_manager(p_workspace) then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  if not exists (
    select 1 from public.office_command_candidates c where c.id = p_candidate and c.workspace_id = p_workspace and c.status = 'pending'
  ) then
    raise exception 'command card is not pending' using errcode = 'P0002';
  end if;
  return public.job_enqueue(
    p_workspace, 'decisions', 'office.confirm-command',
    jsonb_build_object(
      'workspaceId', p_workspace, 'userId', auth.uid(), 'locale', case when p_locale = 'en' then 'en' else 'vi' end,
      'candidateId', p_candidate),
    'office.confirm-command:' || p_candidate::text);
end $$;

--
-- Name: request_office_propose(uuid, uuid, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.request_office_propose(p_workspace uuid, p_message uuid, p_locale text DEFAULT 'vi'::text) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
begin
  if auth.uid() is null or not public.is_manager(p_workspace) then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  if not exists (
    select 1 from public.messages m where m.id = p_message and m.workspace_id = p_workspace and m.author_kind = 'human'
  ) then
    raise exception 'message not found' using errcode = 'P0002';
  end if;
  return public.job_enqueue(
    p_workspace, 'decisions', 'office.propose-command',
    jsonb_build_object(
      'workspaceId', p_workspace, 'userId', auth.uid(), 'locale', case when p_locale = 'en' then 'en' else 'vi' end,
      'messageId', p_message),
    'office.propose-command:' || p_message::text);
end $$;

--
-- Name: request_video_render(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.request_video_render(p_project uuid) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_uid uuid := auth.uid();
  v_workspace uuid;
  v_id uuid;
begin
  if v_uid is null then
    raise exception 'not_signed_in' using errcode = '42501';
  end if;
  select p.workspace_id into v_workspace from public.video_projects p where p.id = p_project;
  if not found then
    raise exception 'VIDEO_PROJECT_NOT_FOUND' using errcode = 'P0002';
  end if;
  if not public.is_manager(v_workspace) then
    raise exception 'WORKSPACE_MEMBERS_ROLE_FORBIDDEN' using errcode = '42501';
  end if;
  insert into public.app_commands (workspace_id, requested_by, kind, input)
  values (v_workspace, v_uid, 'video.render', jsonb_build_object('projectId', p_project))
  returning id into v_id;
  perform public.job_enqueue(v_workspace, 'render_request', 'render_request', jsonb_build_object('workspaceId', v_workspace, 'commandId', v_id), 'render_request:' || v_id::text);
  return v_id;
end;
$$;

--
-- Name: request_work_decision(uuid, uuid, text, jsonb, text, text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.request_work_decision(p_workspace uuid, p_work_item uuid, p_decision text, p_edits jsonb DEFAULT NULL::jsonb, p_note text DEFAULT NULL::text, p_basis text DEFAULT NULL::text, p_locale text DEFAULT 'vi'::text) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
begin
  if auth.uid() is null or not public.is_member(p_workspace) then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  if p_decision not in ('approved', 'rejected') then
    raise exception 'unknown decision %', p_decision using errcode = '22023';
  end if;
  if not exists (
    select 1 from public.work_items w where w.id = p_work_item and w.workspace_id = p_workspace and w.status = 'waiting_decision'
  ) then
    raise exception 'work item is not waiting for a decision' using errcode = 'P0002';
  end if;
  return public.job_enqueue(
    p_workspace, 'decisions', 'decisions.decide-work',
    jsonb_build_object(
      'workspaceId', p_workspace, 'userId', auth.uid(), 'locale', case when p_locale = 'en' then 'en' else 'vi' end,
      'workItemId', p_work_item, 'decision', p_decision, 'edits', p_edits, 'note', left(p_note, 1000), 'basis', left(p_basis, 1000)),
    'decisions.decide-work:' || p_work_item::text);
end $$;

--
-- Name: resolve_installation(uuid, text, uuid, uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.resolve_installation(p_ws uuid, p_module text, p_conversation uuid DEFAULT NULL::uuid, p_lead uuid DEFAULT NULL::uuid, p_chain uuid DEFAULT NULL::uuid) RETURNS TABLE(installation_id uuid, via text)
    LANGUAGE plpgsql STABLE
    SET search_path TO 'public'
    AS $$
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

--
-- Name: responsibility_rows(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.responsibility_rows(ws uuid) RETURNS jsonb
    LANGUAGE sql STABLE
    SET search_path TO 'public'
    AS $$
  select coalesce(jsonb_agg(to_jsonb(r) || jsonb_build_object(
           'lead', (select jsonb_build_object('id', l.id, 'contact_name', l.contact_name, 'company', l.company, 'stage', l.stage) from leads l where l.id = r.lead_id))
         order by r.due_at asc nulls last), '[]'::jsonb)
  from responsibilities r where r.workspace_id = ws;
$$;

--
-- Name: revoke_my_session(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.revoke_my_session(session_id uuid) RETURNS boolean
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
declare removed int;
begin
  if auth.uid() is null then
    return false;
  end if;
  delete from auth.sessions s where s.id = session_id and s.user_id = auth.uid();
  get diagnostics removed = row_count;
  return removed > 0;
end;
$$;

--
-- Name: revoke_workspace_invite(uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.revoke_workspace_invite(p_workspace uuid, p_invite uuid) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_actor text;
  v_email text;
begin
  if auth.uid() is null or not public.is_manager(p_workspace) then
    raise exception 'WORKSPACE_MEMBERS_ROLE_FORBIDDEN' using errcode = '42501';
  end if;
  update public.workspace_invites
     set revoked_at = now()
   where id = p_invite and workspace_id = p_workspace and accepted_at is null and revoked_at is null
  returning email into v_email;
  if not found then
    raise exception 'WORKSPACE_INVITES_NOT_FOUND' using errcode = 'P0002';
  end if;
  select m.display_name into v_actor from public.workspace_members m
   where m.workspace_id = p_workspace and m.user_id = auth.uid() and m.status = 'active';
  insert into public.events (workspace_id, kind, actor, summary)
  values (p_workspace, 'member.invite_revoked', coalesce(v_actor, ''), v_email);
end;
$$;

--
-- Name: session_bootstrap(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.session_bootstrap() RETURNS jsonb
    LANGUAGE sql STABLE
    SET search_path TO 'public'
    AS $$
  select coalesce(jsonb_agg(jsonb_build_object(
           'member', to_jsonb(m),
           'workspace', to_jsonb(w),
           'demo_seeded', (a.demo_seeded_at is not null)
         ) order by m.created_at), '[]'::jsonb)
  from public.workspace_members m
  left join public.workspaces w on w.id = m.workspace_id
  left join public.authority a on a.workspace_id = m.workspace_id
  where m.user_id = auth.uid();
$$;

--
-- Name: settle_credit_topups(uuid, boolean); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.settle_credit_topups(p_workspace uuid, p_force boolean DEFAULT false) RETURNS bigint
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  cur date := date_trunc('month', now() at time zone 'Asia/Ho_Chi_Minh')::date;
  per date;
  r record;
  lot record;
  ovr bigint;
  already bigint;
  need bigint;
  take bigint;
  total bigint := 0;
begin
  perform pg_advisory_xact_lock(hashtextextended('credit_topups:' || p_workspace::text, 0));
  -- Nothing to draw from: skip (a purchase passes p_force to also write the older overage off before its lot exists).
  if not p_force and not exists (
    select 1 from public.credit_topups where workspace_id = p_workspace and credits_remaining > 0 and expires_at > now()
  ) then
    return 0;
  end if;
  -- Last month too, so an event that landed just before midnight is not left behind. Oldest month first.
  foreach per in array array[(cur - interval '1 month')::date, cur] loop
    select * into r from public.ai_credit_period(p_workspace, per);
    if r.credits_limit is null then continue; end if;                     -- unlimited allowance: nothing is ever over
    ovr := ceil(greatest(0, r.used - r.credits_limit))::bigint;
    select coalesce((select d.drawn from public.credit_topup_draws d where d.workspace_id = p_workspace and d.period = per), 0) into already;
    need := ovr - already;
    if need <= 0 then continue; end if;
    for lot in
      select id, credits_remaining from public.credit_topups
      where workspace_id = p_workspace and credits_remaining > 0 and expires_at > now()
      order by expires_at, purchased_at, id
      for update
    loop
      exit when need <= 0;
      take := least(need, lot.credits_remaining);
      update public.credit_topups set credits_remaining = credits_remaining - take where id = lot.id;
      need := need - take;
      total := total + take;
    end loop;
    insert into public.credit_topup_draws (workspace_id, period, drawn, unfunded)
      values (p_workspace, per, ovr, need)
      on conflict (workspace_id, period) do update
        set drawn = excluded.drawn, unfunded = public.credit_topup_draws.unfunded + excluded.unfunded, updated_at = now();
  end loop;
  return total;
end;
$$;

--
-- Name: settle_payment_order(text, bigint, bigint); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.settle_payment_order(p_order_code text, p_amount bigint, p_sepay_id bigint) RETURNS text
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  o public.payment_orders;
  p public.plans;
  w public.workspaces;
  base timestamptz;
  ts timestamptz := now();
  lot_credits bigint;
  cycle text;
begin
  select * into o from public.payment_orders where order_code = upper(p_order_code) for update;
  if not found then return 'unmatched'; end if;
  update public.sepay_transactions set matched_order_id = o.id where sepay_id = p_sepay_id;
  if o.status = 'paid' then return 'ignored'; end if;
  if o.status <> 'pending' or o.expires_at < ts then
    insert into public.billing_events (workspace_id, kind, data)
      values (o.workspace_id, 'expired_payment', jsonb_build_object('order_code', o.order_code, 'amount', p_amount, 'sepay_id', p_sepay_id));
    return 'expired';
  end if;
  if p_amount < o.amount_vnd then
    insert into public.billing_events (workspace_id, kind, data)
      values (o.workspace_id, 'underpaid', jsonb_build_object('order_code', o.order_code, 'amount', p_amount, 'expected', o.amount_vnd, 'sepay_id', p_sepay_id));
    return 'underpaid';
  end if;

  if o.kind = 'credit_pack' then
    lot_credits := (o.detail ->> 'credits')::bigint;
    if lot_credits is null or lot_credits <= 0 then
      insert into public.billing_events (workspace_id, kind, data)
        values (o.workspace_id, 'credit_pack_invalid', jsonb_build_object('order_code', o.order_code, 'amount', p_amount, 'sepay_id', p_sepay_id));
      return 'unmatched';
    end if;
    update public.payment_orders set status = 'paid', paid_at = ts, sepay_transaction_id = p_sepay_id where id = o.id;
    insert into public.credit_pack_purchases (workspace_id, order_id, credits, price_vnd, period, purchased_at)
      values (o.workspace_id, o.id, lot_credits, o.amount_vnd, date_trunc('month', ts at time zone 'Asia/Ho_Chi_Minh')::date, ts)
      on conflict (order_id) do nothing;
    insert into public.billing_events (workspace_id, kind, data)
      values (o.workspace_id, 'paid', jsonb_build_object('order_code', o.order_code, 'amount', p_amount, 'kind', 'credit_pack', 'credits', lot_credits, 'sepay_id', p_sepay_id));
    return 'paid';
  end if;

  if o.kind = 'topup' then
    lot_credits := coalesce((o.detail ->> 'credits')::bigint, (select k.credits from public.credit_packs k where k.code = o.pack_code));
    if lot_credits is null or lot_credits <= 0 then
      insert into public.billing_events (workspace_id, kind, data)
        values (o.workspace_id, 'topup_invalid', jsonb_build_object('order_code', o.order_code, 'amount', p_amount, 'sepay_id', p_sepay_id));
      return 'unmatched';
    end if;
    update public.payment_orders set status = 'paid', paid_at = ts, sepay_transaction_id = p_sepay_id where id = o.id;
    perform public.settle_credit_topups(o.workspace_id, true);
    insert into public.credit_topups (workspace_id, credits, credits_remaining, price_vnd, order_id, pack_code, purchased_at, expires_at)
      values (o.workspace_id, lot_credits, lot_credits, o.amount_vnd, o.id, o.pack_code, ts, ts + interval '12 months')
      on conflict (order_id) do nothing;
    insert into public.billing_events (workspace_id, kind, data)
      values (o.workspace_id, 'paid', jsonb_build_object('order_code', o.order_code, 'amount', p_amount, 'kind', 'topup', 'credits', lot_credits, 'sepay_id', p_sepay_id));
    return 'paid';
  end if;

  select * into p from public.plans where code = o.plan_code;
  select * into w from public.workspaces where id = o.workspace_id for update;
  update public.payment_orders set status = 'paid', paid_at = ts, sepay_transaction_id = p_sepay_id where id = o.id;
  if o.kind = 'upgrade' then
    update public.workspaces
      set plan_code = o.plan_code, tier_credits = null, seat_count = null,
          billed_monthly_vnd = coalesce((o.detail ->> 'toPrice')::bigint, p.price_vnd)
      where id = o.workspace_id;
  else
    cycle := coalesce(o.detail ->> 'cycle', case p.period when 'year' then 'annual' else 'monthly' end);
    base := case when w.status = 'active' and w.paid_until is not null and w.paid_until > ts then w.paid_until else ts end;
    update public.workspaces
      set status = 'active', plan_code = o.plan_code,
          paid_until = base + case cycle when 'annual' then interval '1 year' else interval '1 month' end,
          tier_credits = case when p.per_seat then nullif((o.detail ->> 'tierCredits')::bigint, 0) else null end,
          seat_count = case when p.per_seat then nullif((o.detail ->> 'seats')::int, 0) else null end,
          billing_cycle = cycle,
          billed_monthly_vnd = coalesce((o.detail ->> 'listMonthlyVnd')::bigint, p.price_vnd)
      where id = o.workspace_id;
  end if;
  insert into public.billing_events (workspace_id, kind, data)
    values (o.workspace_id, 'paid', jsonb_build_object('order_code', o.order_code, 'amount', p_amount, 'plan', o.plan_code, 'kind', o.kind, 'sepay_id', p_sepay_id));
  return 'paid';
end;
$$;

--
-- Name: shell_data(uuid, timestamp with time zone, timestamp with time zone); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.shell_data(ws uuid, founding_from timestamp with time zone, founding_to timestamp with time zone) RETURNS jsonb
    LANGUAGE sql STABLE
    SET search_path TO 'public'
    AS $$
  select jsonb_build_object(
    'lead_count', (select count(*) from leads where workspace_id = ws),
    'open_responsibility_count', (select count(*) from responsibilities where workspace_id = ws and status <> 'done'),
    'agents', coalesce((select jsonb_agg(jsonb_build_object('id', a.id, 'name', a.name, 'module', a.module, 'status', a.status) order by a.created_at)
                        from agents a where a.workspace_id = ws), '[]'::jsonb),
    'has_chatbot', exists (select 1 from agents a where a.workspace_id = ws and a.module = 'chatbot'),
    'is_founding_member', exists (select 1 from events e where e.workspace_id = ws and e.kind = 'module.purchased'
                                  and e.created_at >= founding_from and e.created_at <= founding_to),
    -- approval cards waiting for a decision, newest first, with the customer they belong to
    'pending', coalesce((select jsonb_agg(jsonb_build_object('id', x.id, 'draft', x.draft, 'next_action', r.next_action,
                                                             'lead_id', l.id, 'contact_name', l.contact_name) order by x.created_at desc)
                         from executions x
                         left join responsibilities r on r.id = x.responsibility_id
                         left join leads l on l.id = r.lead_id
                         where x.workspace_id = ws and x.status = 'pending_approval'), '[]'::jsonb),
    -- work items waiting / failed that have no approval card of their own
    'exceptions', coalesce((select jsonb_agg(jsonb_build_object('id', w.id, 'lead_id', w.lead_id, 'contact_name', l.contact_name,
                                                                'summary', w.proposal ->> 'summary', 'error', w.error) order by w.created_at)
                            from (select * from work_items w0 where w0.workspace_id = ws and w0.status in ('waiting_decision', 'failed')
                                  and w0.execution_id is null order by w0.created_at limit 100) w
                            left join leads l on l.id = w.lead_id), '[]'::jsonb),
    -- decisions waiting on a person: waiting work items (test runs excluded) + legacy pending approvals without a work item
    'pending_decisions',
      (select count(*) from work_items w
        where w.workspace_id = ws and w.status = 'waiting_decision'
          and not exists (select 1 from leads l where l.id = w.lead_id and (l.contact_name ~ 'UAT|DBG' or l.company ~ 'UAT|DBG'))
          and coalesce(w.proposal ->> 'summary', '') !~ 'UAT|DBG'
          and coalesce(w.proposal -> 'fields' ->> 'contact_name', '') !~ 'UAT|DBG'
          and coalesce(w.proposal -> 'fields' ->> 'customer', '') !~ 'UAT|DBG')
      + (select count(*) from executions x where x.workspace_id = ws and x.status = 'pending_approval' and x.work_item_id is null)
  );
$$;

--
-- Name: shifts_add_availability(uuid, uuid, smallint, date, time without time zone, time without time zone, boolean, text, text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.shifts_add_availability(p_ws uuid, p_staff uuid, p_weekday smallint, p_date date, p_start time without time zone, p_end time without time zone, p_available boolean, p_note text, p_status text, p_decider text) RETURNS uuid
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
declare
  v_id uuid;
begin
  insert into public.shifts_availability (workspace_id, staff_id, weekday, shift_date, start_time, end_time, available, note, status, decided_by)
  values (p_ws, p_staff, p_weekday, p_date, p_start, p_end, p_available, coalesce(p_note, ''), p_status, p_decider)
  returning id into v_id;
  return v_id;
end
$$;

--
-- Name: shifts_add_shifts(uuid, uuid, date[], time without time zone[], time without time zone[], uuid[], uuid[], text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.shifts_add_shifts(p_ws uuid, p_schedule uuid, p_dates date[], p_starts time without time zone[], p_ends time without time zone[], p_positions uuid[], p_staff uuid[], p_source text) RETURNS integer
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
declare
  v_count int;
begin
  insert into public.shifts_shifts (workspace_id, schedule_id, shift_date, start_time, end_time, position_id, staff_id, status, source)
  select p_ws, p_schedule, d, s, e, pos, st, 'draft', p_source
  from unnest(p_dates, p_starts, p_ends, p_positions, p_staff) as t(d, s, e, pos, st);
  get diagnostics v_count = row_count;
  return v_count;
end
$$;

--
-- Name: shifts_check_in(uuid, uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.shifts_check_in(p_ws uuid, p_shift uuid, p_staff uuid) RETURNS timestamp with time zone
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
declare
  v_at timestamptz;
begin
  insert into public.shifts_attendance (workspace_id, shift_id, staff_id)
  values (p_ws, p_shift, p_staff)
  on conflict (shift_id, staff_id) do nothing
  returning checked_in_at into v_at;
  if v_at is null then
    select checked_in_at into v_at from public.shifts_attendance where shift_id = p_shift and staff_id = p_staff;
  end if;
  return v_at;
end
$$;

--
-- Name: shifts_create_leave(uuid, uuid, date, date, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.shifts_create_leave(p_ws uuid, p_staff uuid, p_from date, p_to date, p_reason text) RETURNS uuid
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
declare v_id uuid;
begin
  insert into public.shifts_leave_requests (workspace_id, staff_id, from_date, to_date, reason) values (p_ws, p_staff, p_from, p_to, p_reason) returning id into v_id;
  return v_id;
end
$$;

--
-- Name: shifts_create_swap(uuid, text, uuid, uuid, uuid, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.shifts_create_swap(p_ws uuid, p_kind text, p_shift uuid, p_from uuid, p_to uuid, p_reason text) RETURNS uuid
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
declare v_id uuid;
begin
  insert into public.shifts_swap_requests (workspace_id, kind, shift_id, from_staff_id, to_staff_id, reason) values (p_ws, p_kind, p_shift, p_from, p_to, p_reason) returning id into v_id;
  return v_id;
end
$$;

--
-- Name: shifts_decide_availability(uuid, uuid, text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.shifts_decide_availability(p_ws uuid, p_id uuid, p_status text, p_decider text) RETURNS void
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
begin
  update public.shifts_availability set status = p_status, decided_by = p_decider
  where workspace_id = p_ws and id = p_id and status = 'pending';
end
$$;

--
-- Name: shifts_decide_leave(uuid, uuid, text, text, uuid, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.shifts_decide_leave(p_ws uuid, p_leave uuid, p_status text, p_by text, p_work uuid, p_note text) RETURNS uuid[]
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
declare
  v_staff uuid;
  v_from date;
  v_to date;
  v_moved int;
  v_ids uuid[] := '{}';
begin
  update public.shifts_leave_requests
  set status = p_status, decided_by = p_by, decided_at = now(), work_item_id = coalesce(p_work, work_item_id)
  where id = p_leave and workspace_id = p_ws and status = 'pending'
  returning staff_id, from_date, to_date into v_staff, v_from, v_to;
  get diagnostics v_moved = row_count;
  if v_moved = 0 or p_status <> 'approved' then return v_ids; end if;
  select coalesce(array_agg(id), '{}') into v_ids from public.shifts_shifts
  where workspace_id = p_ws and staff_id = v_staff and shift_date between v_from and v_to and status in ('draft', 'published', 'swapped');
  update public.shifts_shifts set staff_id = null, source = 'manual', note = p_note where id = any(v_ids);
  return v_ids;
end
$$;

--
-- Name: shifts_decide_swap(uuid, uuid, text, text, jsonb, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.shifts_decide_swap(p_ws uuid, p_swap uuid, p_status text, p_by text, p_checks jsonb, p_work uuid) RETURNS boolean
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
declare
  v_shift uuid;
  v_to uuid;
  v_moved int;
begin
  update public.shifts_swap_requests
  set status = p_status, decided_by = p_by, decided_at = now(), checks = coalesce(p_checks, checks), work_item_id = coalesce(p_work, work_item_id)
  where id = p_swap and workspace_id = p_ws and status = 'pending'
  returning shift_id, to_staff_id into v_shift, v_to;
  get diagnostics v_moved = row_count;
  if v_moved = 0 then return false; end if;
  if p_status = 'approved' then
    update public.shifts_shifts set staff_id = v_to, status = 'swapped', source = 'swap' where id = v_shift and workspace_id = p_ws;
  end if;
  return true;
end
$$;

--
-- Name: shifts_import_apply(uuid, jsonb, jsonb, jsonb); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.shifts_import_apply(p_ws uuid, p_positions jsonb, p_staff jsonb, p_blocks jsonb) RETURNS jsonb
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
declare
  r jsonb;
  v_staff uuid;
  v_positions int := 0;
  v_people int := 0;
  v_blocks int := 0;
  v_ids uuid[];
begin
  for r in select * from jsonb_array_elements(coalesce(p_positions, '[]'::jsonb)) loop
    insert into public.shifts_positions (workspace_id, name, color) values (p_ws, r->>'name', coalesce(r->>'color', '#2f6fed')) on conflict (workspace_id, name) do nothing;
    if found then v_positions := v_positions + 1; end if;
  end loop;
  for r in select * from jsonb_array_elements(coalesce(p_staff, '[]'::jsonb)) loop
    select coalesce(array_agg(id), '{}') into v_ids from public.shifts_positions
    where workspace_id = p_ws and name in (select jsonb_array_elements_text(r->'positions'));
    insert into public.shifts_staff (workspace_id, name, position_ids, max_hours_week)
    values (p_ws, r->>'name', v_ids, coalesce((r->>'maxWeek')::numeric, 48)) returning id into v_staff;
    insert into public.shifts_staff_pay (staff_id, workspace_id, hourly_wage_vnd) values (v_staff, p_ws, coalesce((r->>'wage')::int, 0));
    v_people := v_people + 1;
  end loop;
  for r in select * from jsonb_array_elements(coalesce(p_blocks, '[]'::jsonb)) loop
    insert into public.shifts_coverage (workspace_id, weekday, start_time, end_time, position_id, min_staff, ideal_staff, is_peak)
    select p_ws, (r->>'weekday')::smallint, (r->>'start')::time, (r->>'end')::time, id, (r->>'min')::int, (r->>'ideal')::int, coalesce((r->>'peak')::boolean, false)
    from public.shifts_positions where workspace_id = p_ws and name = r->>'position';
    if found then v_blocks := v_blocks + 1; end if;
  end loop;
  return jsonb_build_object('positions', v_positions, 'staff', v_people, 'blocks', v_blocks);
end
$$;

--
-- Name: shifts_link_leave(uuid, uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.shifts_link_leave(p_ws uuid, p_leave uuid, p_work uuid) RETURNS void
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
begin
  update public.shifts_leave_requests set work_item_id = p_work where id = p_leave and workspace_id = p_ws;
end
$$;

--
-- Name: shifts_link_schedule(uuid, uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.shifts_link_schedule(p_ws uuid, p_schedule uuid, p_work uuid) RETURNS void
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
begin
  update public.shifts_schedules set work_item_id = p_work where id = p_schedule and workspace_id = p_ws;
end
$$;

--
-- Name: shifts_link_swap(uuid, uuid, jsonb, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.shifts_link_swap(p_ws uuid, p_swap uuid, p_checks jsonb, p_work uuid) RETURNS void
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
begin
  update public.shifts_swap_requests set checks = coalesce(p_checks, '[]'::jsonb), work_item_id = p_work where id = p_swap and workspace_id = p_ws;
end
$$;

--
-- Name: shifts_my_profile(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.shifts_my_profile(ws uuid) RETURNS uuid
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select s.id from public.shifts_staff s
  where s.workspace_id = ws and s.active
    and (s.user_id = auth.uid() or (s.staff_id is not null and s.staff_id = public.my_staff_id(ws)))
  order by s.created_at limit 1;
$$;

--
-- Name: shifts_publish(uuid, uuid, jsonb, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.shifts_publish(p_ws uuid, p_schedule uuid, p_evidence jsonb, p_work uuid) RETURNS integer
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
declare
  v_week date;
  v_count int;
begin
  select week_start into v_week from public.shifts_schedules where id = p_schedule and workspace_id = p_ws;
  update public.shifts_shifts set status = 'cancelled'
  where workspace_id = p_ws and status in ('published', 'swapped')
    and schedule_id in (select id from public.shifts_schedules where workspace_id = p_ws and week_start = v_week and status = 'published');
  update public.shifts_schedules set status = 'superseded' where workspace_id = p_ws and week_start = v_week and status = 'published';
  update public.shifts_shifts set status = 'published' where schedule_id = p_schedule and workspace_id = p_ws and status = 'draft';
  update public.shifts_schedules set status = 'published', published_at = now(), work_item_id = p_work, evidence = p_evidence where id = p_schedule and workspace_id = p_ws;
  select count(*) into v_count from public.shifts_shifts where schedule_id = p_schedule and status = 'published';
  return v_count;
end
$$;

--
-- Name: shifts_reassign(uuid, uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.shifts_reassign(p_ws uuid, p_shift uuid, p_staff uuid) RETURNS void
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
begin
  update public.shifts_shifts set staff_id = p_staff, source = 'manual' where id = p_shift and workspace_id = p_ws;
end
$$;

--
-- Name: shifts_record_notice(uuid, uuid, uuid, uuid, text, text, text, text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.shifts_record_notice(p_ws uuid, p_staff uuid, p_schedule uuid, p_shift uuid, p_kind text, p_channel text, p_status text, p_body text, p_error text) RETURNS void
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
begin
  insert into public.shifts_notifications (workspace_id, staff_id, schedule_id, shift_id, kind, channel, status, body, error)
  values (p_ws, p_staff, p_schedule, p_shift, p_kind, p_channel, p_status, left(coalesce(p_body, ''), 4000), left(p_error, 500));
end
$$;

--
-- Name: shifts_record_notification(uuid, uuid, uuid, uuid, text, text, text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.shifts_record_notification(p_ws uuid, p_staff uuid, p_schedule uuid, p_shift uuid, p_kind text, p_channel text, p_status text, p_body text) RETURNS void
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
begin
  insert into public.shifts_notifications (workspace_id, staff_id, schedule_id, shift_id, kind, channel, status, body)
  values (p_ws, p_staff, p_schedule, p_shift, p_kind, p_channel, p_status, left(coalesce(p_body, ''), 4000));
end
$$;

--
-- Name: shifts_remove_availability(uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.shifts_remove_availability(p_ws uuid, p_id uuid) RETURNS void
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
begin
  delete from public.shifts_availability where workspace_id = p_ws and id = p_id;
end
$$;

--
-- Name: shifts_remove_coverage(uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.shifts_remove_coverage(p_ws uuid, p_id uuid) RETURNS void
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
begin
  delete from public.shifts_coverage where workspace_id = p_ws and id = p_id;
end
$$;

--
-- Name: shifts_remove_position(uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.shifts_remove_position(p_ws uuid, p_id uuid) RETURNS void
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
begin
  update public.shifts_positions set active = false where workspace_id = p_ws and id = p_id;
end
$$;

--
-- Name: shifts_remove_shift(uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.shifts_remove_shift(p_ws uuid, p_shift uuid) RETURNS void
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
begin
  delete from public.shifts_shifts where id = p_shift and workspace_id = p_ws and status = 'draft';
end
$$;

--
-- Name: shifts_save_coverage(uuid, uuid, smallint[], time without time zone, time without time zone, uuid, integer, integer, boolean); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.shifts_save_coverage(p_ws uuid, p_id uuid, p_weekdays smallint[], p_start time without time zone, p_end time without time zone, p_position uuid, p_min integer, p_ideal integer, p_peak boolean) RETURNS void
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
begin
  if p_id is null then
    insert into public.shifts_coverage (workspace_id, weekday, start_time, end_time, position_id, min_staff, ideal_staff, is_peak)
    select p_ws, day, p_start, p_end, p_position, p_min, p_ideal, p_peak
    from unnest(p_weekdays) as day;
  else
    update public.shifts_coverage
    set weekday = p_weekdays[1], start_time = p_start, end_time = p_end, position_id = p_position,
        min_staff = p_min, ideal_staff = p_ideal, is_peak = p_peak
    where workspace_id = p_ws and id = p_id;
  end if;
end
$$;

--
-- Name: shifts_save_pay(uuid, uuid, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.shifts_save_pay(p_ws uuid, p_staff uuid, p_wage integer) RETURNS void
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
begin
  insert into public.shifts_staff_pay (staff_id, workspace_id, hourly_wage_vnd, updated_at)
  values (p_staff, p_ws, p_wage, now())
  on conflict (staff_id) do update set hourly_wage_vnd = excluded.hourly_wage_vnd, updated_at = excluded.updated_at;
end
$$;

--
-- Name: shifts_save_position(uuid, uuid, text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.shifts_save_position(p_ws uuid, p_id uuid, p_name text, p_color text) RETURNS uuid
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
declare
  v_id uuid;
begin
  if p_id is null then
    insert into public.shifts_positions (workspace_id, name, color)
    values (p_ws, p_name, coalesce(p_color, '#2f6fed'))
    on conflict (workspace_id, name) do update set color = excluded.color
    returning id into v_id;
  else
    update public.shifts_positions set name = p_name, color = coalesce(p_color, color)
    where workspace_id = p_ws and id = p_id
    returning id into v_id;
  end if;
  return v_id;
end
$$;

--
-- Name: shifts_save_schedule(uuid, date, bigint, jsonb, jsonb, integer, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.shifts_save_schedule(p_ws uuid, p_week date, p_cost bigint, p_summary jsonb, p_evidence jsonb, p_ms integer, p_by text) RETURNS uuid
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
declare
  v_version int;
  v_id uuid;
begin
  select coalesce(max(version), 0) into v_version from public.shifts_schedules where workspace_id = p_ws and week_start = p_week;
  update public.shifts_schedules set status = 'superseded' where workspace_id = p_ws and week_start = p_week and status = 'draft';
  insert into public.shifts_schedules (workspace_id, week_start, version, status, source, cost_vnd, summary, evidence, solver_ms, created_by)
  values (p_ws, p_week, v_version + 1, 'draft', 'solver', p_cost, coalesce(p_summary, '{}'::jsonb), coalesce(p_evidence, '{}'::jsonb), p_ms, p_by)
  returning id into v_id;
  return v_id;
end
$$;

--
-- Name: shifts_save_settings(uuid, jsonb, integer, integer, integer, integer, numeric); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.shifts_save_settings(p_ws uuid, p_opening jsonb, p_swap integer, p_leave integer, p_remind integer, p_noshow integer, p_overtime numeric) RETURNS void
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
begin
  insert into public.shifts_settings (workspace_id, opening_hours, swap_notice_hours, leave_notice_days, remind_minutes, noshow_minutes, overtime_hours_week, updated_at)
  values (p_ws, p_opening, p_swap, p_leave, p_remind, p_noshow, p_overtime, now())
  on conflict (workspace_id) do update set
    opening_hours = excluded.opening_hours,
    swap_notice_hours = excluded.swap_notice_hours,
    leave_notice_days = excluded.leave_notice_days,
    remind_minutes = excluded.remind_minutes,
    noshow_minutes = excluded.noshow_minutes,
    overtime_hours_week = excluded.overtime_hours_week,
    updated_at = excluded.updated_at;
end
$$;

--
-- Name: shifts_save_staff(uuid, uuid, jsonb); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.shifts_save_staff(p_ws uuid, p_id uuid, p_row jsonb) RETURNS uuid
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
declare
  v_id uuid;
begin
  if p_id is null then
    insert into public.shifts_staff (workspace_id, name, staff_id, phone, telegram_chat_id, zalo_user_id, position_ids, max_hours_week, max_hours_day, min_rest_hours, active)
    values (p_ws,
      p_row->>'name',
      nullif(p_row->>'staffRowId', '')::uuid,
      nullif(p_row->>'phone', ''),
      nullif(p_row->>'telegramChatId', ''),
      nullif(p_row->>'zaloUserId', ''),
      coalesce((select array_agg(x::uuid) from jsonb_array_elements_text(p_row->'positionIds') x), '{}'::uuid[]),
      coalesce(nullif(p_row->>'maxWeek', '')::numeric, 48),
      coalesce(nullif(p_row->>'maxDay', '')::numeric, 10),
      coalesce(nullif(p_row->>'minRest', '')::numeric, 10),
      coalesce((p_row->>'active')::boolean, true))
    returning id into v_id;
  else
    update public.shifts_staff
    set name = p_row->>'name',
        staff_id = nullif(p_row->>'staffRowId', '')::uuid,
        phone = nullif(p_row->>'phone', ''),
        telegram_chat_id = nullif(p_row->>'telegramChatId', ''),
        zalo_user_id = nullif(p_row->>'zaloUserId', ''),
        position_ids = coalesce((select array_agg(x::uuid) from jsonb_array_elements_text(p_row->'positionIds') x), '{}'::uuid[]),
        max_hours_week = coalesce(nullif(p_row->>'maxWeek', '')::numeric, max_hours_week),
        max_hours_day = coalesce(nullif(p_row->>'maxDay', '')::numeric, max_hours_day),
        min_rest_hours = coalesce(nullif(p_row->>'minRest', '')::numeric, min_rest_hours),
        active = coalesce((p_row->>'active')::boolean, true)
    where workspace_id = p_ws and id = p_id
    returning id into v_id;
  end if;
  return v_id;
end
$$;

--
-- Name: shifts_set_explanation(uuid, uuid, text, jsonb); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.shifts_set_explanation(p_ws uuid, p_schedule uuid, p_text text, p_evidence jsonb) RETURNS void
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
begin
  update public.shifts_schedules set explanation = p_text, evidence = p_evidence where id = p_schedule and workspace_id = p_ws;
end
$$;

--
-- Name: storage_ws_manager(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.storage_ws_manager(p_name text) RETURNS boolean
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
begin
  return public.is_manager(split_part(p_name, '/', 1)::uuid);
exception when others then
  return false;
end $$;

--
-- Name: storage_ws_member(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.storage_ws_member(p_name text) RETURNS boolean
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
begin
  return public.is_member(split_part(p_name, '/', 1)::uuid);
exception when others then
  return false;
end $$;

--
-- Name: update_my_profile(uuid, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_my_profile(ws uuid, new_display_name text) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
begin
  if length(trim(coalesce(new_display_name, ''))) < 2 then raise exception 'display_name_required' using errcode = 'P0001'; end if;
  update public.workspace_members set display_name = trim(new_display_name)
    where workspace_id = ws and user_id = auth.uid() and status = 'active';
end;
$$;

--
-- Name: usage_notice_post(uuid, date, text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.usage_notice_post(p_workspace uuid, p_period date, p_level text, p_body text) RETURNS boolean
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
begin
    insert into public.ai_usage_notices (workspace_id, period, level)
    values (p_workspace, p_period, p_level)
    on conflict (workspace_id, period, level) do nothing;
    if not found then
        return false;
    end if;
    insert into public.messages (workspace_id, author_kind, author_name, body)
    values (p_workspace, 'system', 'NIVO', p_body);
    return true;
end;
$$;

--
-- Name: usage_quota_status(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.usage_quota_status(p_workspace uuid) RETURNS TABLE(period_start date, messages_used bigint, tokens_used bigint, cost_usd numeric, messages_limit integer, tokens_limit bigint, fallback_reply text, credits_used numeric, credits_limit bigint, credits_carried numeric, topup_balance bigint)
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
    select q.* from public.ai_quota_status(p_workspace) q where public.is_member(p_workspace);
$$;

--
-- Name: video_renders_reap(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.video_renders_reap() RETURNS integer
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare v_n int;
begin
  with r as (
    update public.video_renders set status = 'failed', error = coalesce(error, 'timed out'), finished_at = now()
     where status in ('queued', 'rendering') and created_at < now() - interval '30 minutes'
    returning 1)
  select count(*) into v_n from r;
  return v_n;
end $$;

--
-- Name: video_renders_touch(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.video_renders_touch() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
begin new.updated_at := now(); return new; end $$;

--
-- Name: video_touch(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.video_touch() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
begin new.updated_at := now(); return new; end $$;

--
-- Name: work_items_fill_installation(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.work_items_fill_installation() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
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

--
-- Name: workspace_member_contacts(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.workspace_member_contacts(p_workspace uuid) RETURNS TABLE(user_id uuid, email text, last_sign_in_at timestamp with time zone)
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
begin
  if auth.uid() is null or not public.is_manager(p_workspace) then
    return;
  end if;
  return query
    select m.user_id, u.email::text, u.last_sign_in_at
      from public.workspace_members m
      join auth.users u on u.id = m.user_id
     where m.workspace_id = p_workspace;
end;
$$;

--
-- Name: workspace_members_directory(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.workspace_members_directory(ws uuid) RETURNS TABLE(user_id uuid, role text, staff_id uuid, display_name text, status text, created_at timestamp with time zone, email text, last_sign_in_at timestamp with time zone)
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public', 'auth'
    AS $$
  select m.user_id, m.role, m.staff_id, m.display_name, m.status, m.created_at,
         case when public.is_manager(ws) then u.email::text else null end,
         u.last_sign_in_at
  from public.workspace_members m join auth.users u on u.id = m.user_id
  where m.workspace_id = ws and public.is_member(ws)
  order by case m.role when 'owner' then 0 when 'manager' then 1 else 2 end, m.created_at;
$$;

--
-- Name: workspace_members_guard(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.workspace_members_guard() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare remaining int;
begin
  if tg_op in ('UPDATE', 'DELETE') and old.role = 'owner' and old.status = 'active'
     and (tg_op = 'DELETE' or new.role <> 'owner' or new.status <> 'active') then
    select count(*) into remaining from public.workspace_members m
      where m.workspace_id = old.workspace_id and m.role = 'owner' and m.status = 'active' and m.id <> old.id;
    if remaining = 0 and exists (select 1 from public.workspaces w where w.id = old.workspace_id) then
      raise exception 'last_owner' using errcode = 'P0001', hint = 'A workspace needs at least one active owner.';
    end if;
  end if;
  if tg_op in ('INSERT', 'UPDATE') and new.staff_id is not null
     and not exists (select 1 from public.staff s where s.id = new.staff_id and s.workspace_id = new.workspace_id) then
    raise exception 'staff_other_workspace' using errcode = 'P0001';
  end if;
  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

--
-- Name: workspace_storage_bytes(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.workspace_storage_bytes(p_workspace uuid) RETURNS bigint
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public', 'storage'
    AS $$
  select coalesce(sum(coalesce((o.metadata ->> 'size')::bigint, 0)), 0)::bigint
  from storage.objects o
  where o.bucket_id in ('knowledge-uploads', 'media', 'videos')
    and split_part(o.name, '/', 1) = p_workspace::text;
$$;

--
-- Name: workspaces_add_owner_member(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.workspaces_add_owner_member() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
begin
  insert into public.workspace_members (workspace_id, user_id, role, display_name)
  values (new.id, new.owner_id, 'owner', public.display_name_of(new.owner_id))
  on conflict (workspace_id, user_id) do nothing;
  return new;
end;
$$;

--
-- Name: workspaces_billing_guard(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.workspaces_billing_guard() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
begin
  if auth.uid() is not null and (
       new.status is distinct from old.status or new.plan_code is distinct from old.plan_code or new.paid_until is distinct from old.paid_until
    or new.tier_credits is distinct from old.tier_credits or new.seat_count is distinct from old.seat_count
    or new.billing_cycle is distinct from old.billing_cycle or new.billed_monthly_vnd is distinct from old.billed_monthly_vnd) then
    raise exception 'billing_columns_server_only' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

--
-- Name: zalo_authorization_return(text, text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.zalo_authorization_return(p_state text, p_code text, p_oa_id text DEFAULT NULL::text) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
    v_connection uuid;
    v_workspace uuid;
begin
    begin
        v_connection := split_part(p_state, '.', 1)::uuid;
    exception when invalid_text_representation then
        raise exception 'the Zalo authorization state is not valid' using errcode = '23514';
    end;
    select workspace_id into v_workspace from public.connections where id = v_connection and provider = 'zalo_oa';
    if v_workspace is null or not public.is_manager(v_workspace) then
        raise exception 'only an owner or manager of the workspace connects a channel' using errcode = '42501';
    end if;
    perform public.job_enqueue(
        v_workspace,
        'zalo_authorization',
        'complete-zalo-authorization',
        jsonb_build_object('workspaceId', v_workspace, 'state', p_state, 'code', p_code, 'oaId', p_oa_id),
        'zalo-authorization:' || v_connection || ':' || md5(p_state)
    );
    return v_connection;
end $$;

--
-- Name: zalo_wizard_begin(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.zalo_wizard_begin(p_connection uuid) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
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

--
-- Name: zalo_wizard_oa_secret(uuid, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.zalo_wizard_oa_secret(p_connection uuid, p_oa_secret text) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
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

--
-- Name: zalo_wizard_start(uuid, text, text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.zalo_wizard_start(p_workspace uuid, p_name text, p_app_id text, p_app_secret text) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $_$
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
end $_$;

--
-- Name: accounting_adjustments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.accounting_adjustments (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    workspace_id uuid NOT NULL,
    target_type text NOT NULL,
    target_id uuid NOT NULL,
    note text NOT NULL,
    corrected_amount_vnd bigint,
    created_by text NOT NULL,
    created_by_user uuid DEFAULT auth.uid(),
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT accounting_adjustments_corrected_amount_vnd_check CHECK (((corrected_amount_vnd IS NULL) OR (corrected_amount_vnd >= 0))),
    CONSTRAINT accounting_adjustments_note_check CHECK ((char_length(btrim(note)) >= 5)),
    CONSTRAINT accounting_adjustments_target_type_check CHECK ((target_type = ANY (ARRAY['invoice'::text, 'transaction'::text])))
);

--
-- Name: agent_access_log; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.agent_access_log (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    workspace_id uuid NOT NULL,
    connection_id uuid,
    agent_id uuid,
    connection_name text DEFAULT ''::text NOT NULL,
    agent_name text DEFAULT ''::text NOT NULL,
    before_access text,
    after_access text,
    changed_by uuid,
    changed_by_name text DEFAULT ''::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT agent_access_log_after_access_check CHECK (((after_access IS NULL) OR (after_access = ANY (ARRAY['read'::text, 'ask'::text, 'auto'::text])))),
    CONSTRAINT agent_access_log_before_access_check CHECK (((before_access IS NULL) OR (before_access = ANY (ARRAY['read'::text, 'ask'::text, 'auto'::text]))))
);

--
-- Name: agent_connections; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.agent_connections (
    agent_id uuid NOT NULL,
    connection_id uuid NOT NULL,
    workspace_id uuid NOT NULL,
    purpose text DEFAULT 'inbound_chat'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    access text DEFAULT 'ask'::text NOT NULL,
    CONSTRAINT agent_connections_access_check CHECK ((access = ANY (ARRAY['read'::text, 'ask'::text, 'auto'::text]))),
    CONSTRAINT agent_connections_purpose_check CHECK ((purpose = ANY (ARRAY['inbound_chat'::text, 'outbound_chat'::text, 'bank_feed'::text, 'data_source'::text, 'tool'::text, 'lead_source'::text])))
);

--
-- Name: agent_conversations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.agent_conversations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    workspace_id uuid NOT NULL,
    agent_id uuid NOT NULL,
    kind text NOT NULL,
    visitor_name text,
    lead_id uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    handled_by text,
    handled_at timestamp with time zone,
    channel text DEFAULT 'website'::text NOT NULL,
    external_id text,
    connection_id uuid,
    installation_id uuid,
    CONSTRAINT agent_conversations_kind_check CHECK ((kind = ANY (ARRAY['test'::text, 'customer'::text])))
);

--
-- Name: agent_messages; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.agent_messages (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    workspace_id uuid NOT NULL,
    conversation_id uuid NOT NULL,
    role text NOT NULL,
    body text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    author_kind text,
    author_name text,
    delivery_status text,
    delivery_error text,
    in_reply_to uuid,
    CONSTRAINT agent_messages_author_kind_check CHECK ((author_kind = ANY (ARRAY['ai'::text, 'human'::text]))),
    CONSTRAINT agent_messages_delivery_status_check CHECK ((delivery_status = ANY (ARRAY['sent'::text, 'failed'::text]))),
    CONSTRAINT agent_messages_role_check CHECK ((role = ANY (ARRAY['user'::text, 'agent'::text, 'system'::text])))
);

--
-- Name: agents; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.agents (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    workspace_id uuid NOT NULL,
    module text DEFAULT 'chatbot'::text NOT NULL,
    name text NOT NULL,
    handle text NOT NULL,
    role text NOT NULL,
    instructions text NOT NULL,
    knowledge text DEFAULT ''::text NOT NULL,
    greeting text DEFAULT ''::text NOT NULL,
    approval_rule text DEFAULT 'Anything that commits price, schedule or scope needs human approval.'::text NOT NULL,
    status text DEFAULT 'active'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT agents_status_check CHECK ((status = ANY (ARRAY['active'::text, 'paused'::text])))
);

--
-- Name: ai_generations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ai_generations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    workspace_id uuid NOT NULL,
    purpose text NOT NULL,
    module text DEFAULT 'other'::text NOT NULL,
    usage_kind text DEFAULT 'engine'::text NOT NULL,
    status text DEFAULT 'queued'::text NOT NULL,
    input jsonb DEFAULT '{}'::jsonb NOT NULL,
    output jsonb,
    error text,
    timings jsonb DEFAULT '{}'::jsonb NOT NULL,
    usage jsonb,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    finished_at timestamp with time zone,
    CONSTRAINT ai_generations_status_check CHECK ((status = ANY (ARRAY['queued'::text, 'running'::text, 'done'::text, 'error'::text, 'cancelled'::text])))
);

--
-- Name: ai_quota_overrides; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ai_quota_overrides (
    workspace_id uuid NOT NULL,
    messages_limit integer,
    tokens_limit bigint,
    fallback_reply text,
    note text,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    credits_limit bigint,
    CONSTRAINT ai_quota_overrides_credits_limit_check CHECK (((credits_limit IS NULL) OR (credits_limit >= 0))),
    CONSTRAINT ai_quota_overrides_messages_limit_check CHECK (((messages_limit IS NULL) OR (messages_limit >= 0))),
    CONSTRAINT ai_quota_overrides_tokens_limit_check CHECK (((tokens_limit IS NULL) OR (tokens_limit >= 0)))
);

--
-- Name: ai_usage_events; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ai_usage_events (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    workspace_id uuid NOT NULL,
    kind text NOT NULL,
    module text DEFAULT 'other'::text NOT NULL,
    model text DEFAULT ''::text NOT NULL,
    prompt_tokens integer DEFAULT 0 NOT NULL,
    completion_tokens integer DEFAULT 0 NOT NULL,
    cost_usd numeric(14,8) DEFAULT 0 NOT NULL,
    estimated boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT ai_usage_events_completion_tokens_check CHECK ((completion_tokens >= 0)),
    CONSTRAINT ai_usage_events_cost_usd_check CHECK ((cost_usd >= (0)::numeric)),
    CONSTRAINT ai_usage_events_kind_check CHECK ((kind = ANY (ARRAY['chat_reply'::text, 'setup'::text, 'owner_chat'::text, 'relay'::text, 'embedding'::text, 'engine'::text, 'guide'::text, 'brain'::text, 'office_command'::text]))),
    CONSTRAINT ai_usage_events_prompt_tokens_check CHECK ((prompt_tokens >= 0))
);

--
-- Name: ai_usage_daily; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.ai_usage_daily WITH (security_invoker='true') AS
 SELECT workspace_id,
    ((created_at AT TIME ZONE 'Asia/Ho_Chi_Minh'::text))::date AS day,
    kind,
    module,
    (count(*))::integer AS calls,
    sum(prompt_tokens) AS prompt_tokens,
    sum(completion_tokens) AS completion_tokens,
    (sum(cost_usd))::numeric(16,8) AS cost_usd
   FROM public.ai_usage_events
  GROUP BY workspace_id, (((created_at AT TIME ZONE 'Asia/Ho_Chi_Minh'::text))::date), kind, module;

--
-- Name: ai_usage_notices; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ai_usage_notices (
    workspace_id uuid NOT NULL,
    period date NOT NULL,
    level text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT ai_usage_notices_level_check CHECK ((level = ANY (ARRAY['warn'::text, 'exceeded'::text])))
);

--
-- Name: api_keys; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.api_keys (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    workspace_id uuid NOT NULL,
    name text NOT NULL,
    key_prefix text NOT NULL,
    key_hash text NOT NULL,
    scopes text[] DEFAULT '{leads:read,leads:write,messages:write,knowledge:write,events:read,loyalty:read,loyalty:write}'::text[] NOT NULL,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    last_used_at timestamp with time zone,
    revoked_at timestamp with time zone,
    CONSTRAINT workspace_api_keys_name_check CHECK (((char_length(name) >= 2) AND (char_length(name) <= 60)))
);

--
-- Name: api_rate_limits; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.api_rate_limits (
    key_id uuid NOT NULL,
    window_start timestamp with time zone NOT NULL,
    hits integer DEFAULT 0 NOT NULL
);

--
-- Name: app_commands; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.app_commands (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    workspace_id uuid,
    requested_by uuid NOT NULL,
    kind text NOT NULL,
    input jsonb DEFAULT '{}'::jsonb NOT NULL,
    state text DEFAULT 'queued'::text NOT NULL,
    result jsonb,
    error_code text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    finished_at timestamp with time zone,
    CONSTRAINT app_commands_kind_check CHECK ((kind = ANY (ARRAY['invite.create'::text, 'invite.resend'::text, 'invite.link'::text, 'admin.invite.resend'::text, 'video.render'::text]))),
    CONSTRAINT app_commands_state_check CHECK ((state = ANY (ARRAY['queued'::text, 'running'::text, 'done'::text, 'failed'::text])))
);

--
-- Name: app_errors; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.app_errors (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    scope text NOT NULL,
    message text NOT NULL,
    stack text,
    workspace_id uuid,
    ctx jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

--
-- Name: authority; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.authority (
    workspace_id uuid NOT NULL,
    goal_revenue_vnd bigint,
    goal_new_customers integer,
    goal_first_reply_minutes integer,
    goal_note text DEFAULT ''::text NOT NULL,
    policies text DEFAULT ''::text NOT NULL,
    reply_style text DEFAULT ''::text NOT NULL,
    brand_voice text DEFAULT ''::text NOT NULL,
    limits_note text DEFAULT ''::text NOT NULL,
    demo_seeded_at timestamp with time zone,
    updated_by text,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT authority_goal_first_reply_minutes_check CHECK (((goal_first_reply_minutes IS NULL) OR (goal_first_reply_minutes > 0))),
    CONSTRAINT authority_goal_new_customers_check CHECK (((goal_new_customers IS NULL) OR (goal_new_customers >= 0))),
    CONSTRAINT authority_goal_revenue_vnd_check CHECK (((goal_revenue_vnd IS NULL) OR (goal_revenue_vnd >= 0)))
);

--
-- Name: authority_actions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.authority_actions (
    action text NOT NULL,
    module_key text NOT NULL,
    sort_order integer DEFAULT 0 NOT NULL,
    default_mode text DEFAULT 'ask'::text NOT NULL,
    default_limit_vnd bigint,
    default_required_fields text[] DEFAULT '{}'::text[] NOT NULL,
    amount_limit boolean DEFAULT false NOT NULL,
    max_mode text,
    label jsonb DEFAULT '{}'::jsonb NOT NULL,
    CONSTRAINT authority_actions_action_check CHECK ((action ~ '^[a-z][a-z0-9_]{2,40}$'::text)),
    CONSTRAINT authority_actions_default_limit_vnd_check CHECK (((default_limit_vnd IS NULL) OR (default_limit_vnd >= 0))),
    CONSTRAINT authority_actions_default_mode_check CHECK ((default_mode = ANY (ARRAY['auto'::text, 'ask'::text, 'never'::text]))),
    CONSTRAINT authority_actions_max_mode_check CHECK ((max_mode = ANY (ARRAY['ask'::text, 'never'::text])))
);

--
-- Name: authority_rules; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.authority_rules (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    workspace_id uuid NOT NULL,
    department text NOT NULL,
    action text NOT NULL,
    mode text DEFAULT 'ask'::text NOT NULL,
    limit_vnd bigint,
    required_fields text[] DEFAULT '{}'::text[] NOT NULL,
    note text DEFAULT ''::text NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT authority_rules_limit_vnd_check CHECK (((limit_vnd IS NULL) OR (limit_vnd >= 0))),
    CONSTRAINT authority_rules_mode_check CHECK ((mode = ANY (ARRAY['auto'::text, 'ask'::text, 'never'::text])))
);

--
-- Name: automation_commands; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.automation_commands (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    workspace_id uuid NOT NULL,
    kind text NOT NULL,
    template_key text NOT NULL,
    status text DEFAULT 'queued'::text NOT NULL,
    result jsonb,
    fault_code text,
    created_by uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    finished_at timestamp with time zone,
    CONSTRAINT automation_commands_kind_check CHECK ((kind = ANY (ARRAY['propose_body'::text, 'run_now'::text]))),
    CONSTRAINT automation_commands_status_check CHECK ((status = ANY (ARRAY['queued'::text, 'done'::text, 'failed'::text]))),
    CONSTRAINT automation_commands_template_key_check CHECK ((template_key ~ '^[a-z][a-z0-9_-]{2,60}$'::text))
);

--
-- Name: automation_pipelines; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.automation_pipelines (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    workspace_id uuid NOT NULL,
    template_key text NOT NULL,
    name text NOT NULL,
    module_key text,
    enabled boolean DEFAULT false NOT NULL,
    dismissed boolean DEFAULT false NOT NULL,
    config jsonb DEFAULT '{}'::jsonb NOT NULL,
    body text,
    body_version integer DEFAULT 0 NOT NULL,
    template_version integer DEFAULT 1 NOT NULL,
    based_on_context integer,
    approval_streak integer DEFAULT 0 NOT NULL,
    trust_offered_at timestamp with time zone,
    auto_send boolean DEFAULT false NOT NULL,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);

--
-- Name: automation_runs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.automation_runs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    pipeline_id uuid NOT NULL,
    workspace_id uuid NOT NULL,
    trigger_ref text DEFAULT ''::text NOT NULL,
    dedupe_key text NOT NULL,
    payload jsonb DEFAULT '{}'::jsonb NOT NULL,
    status text DEFAULT 'queued'::text NOT NULL,
    steps jsonb DEFAULT '[]'::jsonb NOT NULL,
    evidence text,
    error text,
    attempts integer DEFAULT 0 NOT NULL,
    run_at timestamp with time zone DEFAULT now() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    finished_at timestamp with time zone,
    CONSTRAINT automation_runs_status_check CHECK ((status = ANY (ARRAY['queued'::text, 'running'::text, 'done'::text, 'skipped'::text, 'waiting_approval'::text, 'failed'::text])))
);

--
-- Name: automation_templates; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.automation_templates (
    key text NOT NULL,
    version integer DEFAULT 1 NOT NULL,
    module_key text,
    pack text DEFAULT 'core'::text NOT NULL,
    executor text DEFAULT 'implemented'::text NOT NULL,
    definition jsonb NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    "position" integer DEFAULT 0 NOT NULL
);

--
-- Name: billing_config; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.billing_config (
    key text NOT NULL,
    value numeric NOT NULL,
    note text DEFAULT ''::text NOT NULL
);

--
-- Name: billing_events; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.billing_events (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    workspace_id uuid,
    kind text NOT NULL,
    data jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

--
-- Name: booking_exceptions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.booking_exceptions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    workspace_id uuid NOT NULL,
    resource_id uuid,
    on_date date NOT NULL,
    closed boolean DEFAULT true NOT NULL,
    start_time time without time zone,
    end_time time without time zone,
    note text DEFAULT ''::text NOT NULL,
    CONSTRAINT booking_exceptions_check CHECK ((closed OR ((start_time IS NOT NULL) AND (end_time IS NOT NULL) AND (end_time > start_time))))
);

--
-- Name: booking_hours; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.booking_hours (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    workspace_id uuid NOT NULL,
    resource_id uuid NOT NULL,
    weekday smallint NOT NULL,
    start_time time without time zone NOT NULL,
    end_time time without time zone NOT NULL,
    CONSTRAINT booking_hours_check CHECK ((end_time > start_time)),
    CONSTRAINT booking_hours_weekday_check CHECK (((weekday >= 1) AND (weekday <= 7)))
);

--
-- Name: booking_rate; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.booking_rate (
    key text NOT NULL,
    window_start timestamp with time zone NOT NULL,
    hits integer DEFAULT 0 NOT NULL
);

--
-- Name: booking_reminders; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.booking_reminders (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    workspace_id uuid NOT NULL,
    booking_id uuid NOT NULL,
    kind text NOT NULL,
    due_at timestamp with time zone NOT NULL,
    status text DEFAULT 'scheduled'::text NOT NULL,
    work_item_id uuid,
    note text DEFAULT ''::text NOT NULL,
    sent_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT booking_reminders_kind_check CHECK ((kind ~ '^h[0-9]{1,3}$'::text)),
    CONSTRAINT booking_reminders_status_check CHECK ((status = ANY (ARRAY['scheduled'::text, 'sent'::text, 'waiting'::text, 'skipped'::text, 'cancelled'::text, 'failed'::text])))
);

--
-- Name: booking_resources; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.booking_resources (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    workspace_id uuid NOT NULL,
    name text NOT NULL,
    kind text DEFAULT 'staff'::text NOT NULL,
    capacity integer DEFAULT 1 NOT NULL,
    color text DEFAULT ''::text NOT NULL,
    active boolean DEFAULT true NOT NULL,
    staff_id uuid,
    sort_order integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT booking_resources_capacity_check CHECK (((capacity >= 1) AND (capacity <= 200))),
    CONSTRAINT booking_resources_kind_check CHECK (((length(kind) >= 1) AND (length(kind) <= 40))),
    CONSTRAINT booking_resources_name_check CHECK (((length(name) >= 1) AND (length(name) <= 120)))
);

--
-- Name: booking_services; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.booking_services (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    workspace_id uuid NOT NULL,
    name text NOT NULL,
    description text DEFAULT ''::text NOT NULL,
    duration_min integer NOT NULL,
    buffer_min integer DEFAULT 0 NOT NULL,
    price_vnd bigint,
    resource_kind text,
    followup_days integer,
    active boolean DEFAULT true NOT NULL,
    sort_order integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT booking_services_buffer_min_check CHECK (((buffer_min >= 0) AND (buffer_min <= 480))),
    CONSTRAINT booking_services_duration_min_check CHECK (((duration_min >= 5) AND (duration_min <= 1440))),
    CONSTRAINT booking_services_followup_days_check CHECK (((followup_days IS NULL) OR ((followup_days >= 1) AND (followup_days <= 730)))),
    CONSTRAINT booking_services_name_check CHECK (((length(name) >= 1) AND (length(name) <= 160))),
    CONSTRAINT booking_services_price_vnd_check CHECK (((price_vnd IS NULL) OR (price_vnd >= 0)))
);

--
-- Name: booking_settings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.booking_settings (
    workspace_id uuid NOT NULL,
    timezone text DEFAULT 'Asia/Ho_Chi_Minh'::text NOT NULL,
    slot_step_min integer DEFAULT 15 NOT NULL,
    min_lead_min integer DEFAULT 60 NOT NULL,
    max_advance_days integer DEFAULT 60 NOT NULL,
    cancel_window_hours integer DEFAULT 24 NOT NULL,
    deposit_pct integer DEFAULT 0 NOT NULL,
    late_cancel_fee_pct integer DEFAULT 0 NOT NULL,
    no_show_fee_vnd bigint DEFAULT 0 NOT NULL,
    auto_confirm boolean DEFAULT true NOT NULL,
    handoff_order boolean DEFAULT false NOT NULL,
    reminder_hours integer[] DEFAULT '{24,2}'::integer[] NOT NULL,
    public_enabled boolean DEFAULT false NOT NULL,
    public_slug text,
    public_note text DEFAULT ''::text NOT NULL,
    address text DEFAULT ''::text NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT booking_settings_cancel_window_hours_check CHECK ((cancel_window_hours >= 0)),
    CONSTRAINT booking_settings_deposit_pct_check CHECK (((deposit_pct >= 0) AND (deposit_pct <= 100))),
    CONSTRAINT booking_settings_late_cancel_fee_pct_check CHECK (((late_cancel_fee_pct >= 0) AND (late_cancel_fee_pct <= 100))),
    CONSTRAINT booking_settings_max_advance_days_check CHECK (((max_advance_days >= 1) AND (max_advance_days <= 365))),
    CONSTRAINT booking_settings_min_lead_min_check CHECK ((min_lead_min >= 0)),
    CONSTRAINT booking_settings_no_show_fee_vnd_check CHECK ((no_show_fee_vnd >= 0)),
    CONSTRAINT booking_settings_public_slug_check CHECK ((public_slug ~ '^[a-z0-9][a-z0-9-]{2,40}$'::text)),
    CONSTRAINT booking_settings_slot_step_min_check CHECK (((slot_step_min >= 5) AND (slot_step_min <= 240)))
);

--
-- Name: booking_waitlist; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.booking_waitlist (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    workspace_id uuid NOT NULL,
    lead_id uuid,
    conversation_id uuid,
    customer_name text DEFAULT ''::text NOT NULL,
    customer_phone text,
    service_id uuid NOT NULL,
    resource_id uuid,
    window_start timestamp with time zone NOT NULL,
    window_end timestamp with time zone NOT NULL,
    party_size integer DEFAULT 1 NOT NULL,
    status text DEFAULT 'waiting'::text NOT NULL,
    notified_at timestamp with time zone,
    note text DEFAULT ''::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT booking_waitlist_check CHECK ((window_end > window_start)),
    CONSTRAINT booking_waitlist_party_size_check CHECK (((party_size >= 1) AND (party_size <= 200))),
    CONSTRAINT booking_waitlist_status_check CHECK ((status = ANY (ARRAY['waiting'::text, 'notified'::text, 'booked'::text, 'expired'::text, 'cancelled'::text])))
);

--
-- Name: bookings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.bookings (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    workspace_id uuid NOT NULL,
    lead_id uuid,
    conversation_id uuid,
    customer_name text DEFAULT ''::text NOT NULL,
    customer_phone text,
    customer_email text,
    service_id uuid NOT NULL,
    resource_id uuid NOT NULL,
    start_at timestamp with time zone NOT NULL,
    end_at timestamp with time zone NOT NULL,
    block_end_at timestamp with time zone NOT NULL,
    party_size integer DEFAULT 1 NOT NULL,
    status text DEFAULT 'requested'::text NOT NULL,
    holds_slot boolean DEFAULT true NOT NULL,
    source_channel text DEFAULT 'manual'::text NOT NULL,
    price_vnd bigint,
    deposit_vnd bigint DEFAULT 0 NOT NULL,
    deposit_status text DEFAULT 'none'::text NOT NULL,
    cancel_fee_vnd bigint DEFAULT 0 NOT NULL,
    note text DEFAULT ''::text NOT NULL,
    conflict_note text DEFAULT ''::text NOT NULL,
    checked_in_at timestamp with time zone,
    done_at timestamp with time zone,
    rescheduled_from timestamp with time zone,
    reschedule_count integer DEFAULT 0 NOT NULL,
    cancelled_at timestamp with time zone,
    cancel_reason text,
    work_item_id uuid,
    order_id uuid,
    idempotency_key text,
    origin text DEFAULT 'live'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    installation_id uuid,
    effects jsonb DEFAULT '{}'::jsonb NOT NULL,
    CONSTRAINT bookings_check CHECK (((end_at > start_at) AND (block_end_at >= end_at))),
    CONSTRAINT bookings_deposit_status_check CHECK ((deposit_status = ANY (ARRAY['none'::text, 'due'::text, 'paid'::text, 'waived'::text]))),
    CONSTRAINT bookings_origin_check CHECK ((origin = ANY (ARRAY['live'::text, 'simulated'::text]))),
    CONSTRAINT bookings_party_size_check CHECK (((party_size >= 1) AND (party_size <= 200))),
    CONSTRAINT bookings_status_check CHECK ((status = ANY (ARRAY['requested'::text, 'confirmed'::text, 'rescheduled'::text, 'cancelled'::text, 'no_show'::text, 'done'::text])))
);

--
-- Name: brain_commands; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.brain_commands (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    workspace_id uuid NOT NULL,
    requested_by uuid NOT NULL,
    kind text NOT NULL,
    payload jsonb DEFAULT '{}'::jsonb NOT NULL,
    status text DEFAULT 'queued'::text NOT NULL,
    result jsonb,
    error_code text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    finished_at timestamp with time zone,
    CONSTRAINT brain_commands_kind_check CHECK ((kind = ANY (ARRAY['fact.save'::text, 'fact.decide'::text, 'fact.keep'::text, 'lesson.save'::text, 'lesson.decide'::text, 'gap.dismiss'::text, 'brain.maintain'::text, 'lessons.mine'::text, 'source.delete'::text, 'source.reindex'::text, 'source.update'::text, 'knowledge.reembed'::text, 'knowledge.ask'::text, 'drive.linked'::text, 'drive.picked'::text]))),
    CONSTRAINT brain_commands_status_check CHECK ((status = ANY (ARRAY['queued'::text, 'running'::text, 'done'::text, 'failed'::text])))
);

--
-- Name: brain_eval_cases; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.brain_eval_cases (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    workspace_id uuid NOT NULL,
    module text,
    kind text NOT NULL,
    input jsonb NOT NULL,
    expected jsonb NOT NULL,
    origin_ref text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT brain_eval_cases_kind_check CHECK ((kind = ANY (ARRAY['qa'::text, 'extract'::text, 'draft'::text])))
);

--
-- Name: brain_extractions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.brain_extractions (
    source_id uuid NOT NULL,
    workspace_id uuid NOT NULL,
    status text DEFAULT 'queued'::text NOT NULL,
    facts_proposed integer DEFAULT 0 NOT NULL,
    error text,
    model text,
    prompt_version integer NOT NULL,
    content_hash text,
    windows_total integer DEFAULT 0 NOT NULL,
    windows_done integer DEFAULT 0 NOT NULL,
    attempts integer DEFAULT 0 NOT NULL,
    orphan_fact_ids uuid[] DEFAULT '{}'::uuid[] NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT brain_extractions_status_check CHECK ((status = ANY (ARRAY['queued'::text, 'running'::text, 'done'::text, 'failed'::text, 'blocked_credits'::text])))
);

--
-- Name: brain_facts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.brain_facts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    workspace_id uuid NOT NULL,
    subject_type text DEFAULT 'business'::text NOT NULL,
    subject_key text NOT NULL,
    subject_label text NOT NULL,
    attribute text NOT NULL,
    attribute_label text NOT NULL,
    value text NOT NULL,
    value_number numeric,
    unit text,
    scope text DEFAULT 'internal'::text NOT NULL,
    modules text[] DEFAULT '{}'::text[] NOT NULL,
    status text DEFAULT 'proposed'::text NOT NULL,
    source_kind text NOT NULL,
    trust smallint NOT NULL,
    valid_from timestamp with time zone,
    valid_to timestamp with time zone,
    supersedes_id uuid,
    conflict_with uuid,
    evidence jsonb DEFAULT '[]'::jsonb NOT NULL,
    proposed_by text NOT NULL,
    proposed_at timestamp with time zone DEFAULT now() NOT NULL,
    decided_by text,
    decided_at timestamp with time zone,
    decision_note text,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    proposal_kind text DEFAULT 'set'::text NOT NULL,
    installation_id uuid,
    CONSTRAINT brain_facts_check CHECK (((valid_to IS NULL) OR (valid_from IS NULL) OR (valid_to > valid_from))),
    CONSTRAINT brain_facts_proposal_kind_check CHECK ((proposal_kind = ANY (ARRAY['set'::text, 'retire'::text]))),
    CONSTRAINT brain_facts_scope_check CHECK ((scope = ANY (ARRAY['public'::text, 'internal'::text, 'restricted'::text]))),
    CONSTRAINT brain_facts_source_kind_check CHECK ((source_kind = ANY (ARRAY['owner'::text, 'manager'::text, 'document'::text, 'system'::text, 'staff'::text, 'customer'::text, 'ai'::text]))),
    CONSTRAINT brain_facts_status_check CHECK ((status = ANY (ARRAY['proposed'::text, 'scheduled'::text, 'active'::text, 'superseded'::text, 'rejected'::text, 'expired'::text]))),
    CONSTRAINT brain_facts_subject_type_check CHECK ((subject_type = ANY (ARRAY['business'::text, 'product'::text, 'service'::text, 'policy'::text, 'customer'::text, 'person'::text, 'supplier'::text, 'place'::text, 'other'::text]))),
    CONSTRAINT brain_facts_trust_check CHECK (((trust >= 0) AND (trust <= 100)))
);

--
-- Name: brain_lessons; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.brain_lessons (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    workspace_id uuid NOT NULL,
    module text,
    title text NOT NULL,
    body text NOT NULL,
    applies_when text DEFAULT ''::text NOT NULL,
    status text DEFAULT 'proposed'::text NOT NULL,
    origin text DEFAULT 'manual'::text NOT NULL,
    evidence jsonb DEFAULT '[]'::jsonb NOT NULL,
    version integer DEFAULT 1 NOT NULL,
    supersedes_id uuid,
    proposed_by text NOT NULL,
    proposed_at timestamp with time zone DEFAULT now() NOT NULL,
    decided_by text,
    decided_at timestamp with time zone,
    CONSTRAINT brain_lessons_origin_check CHECK ((origin = ANY (ARRAY['edits'::text, 'note'::text, 'outcome'::text, 'manual'::text]))),
    CONSTRAINT brain_lessons_status_check CHECK ((status = ANY (ARRAY['proposed'::text, 'active'::text, 'retired'::text, 'rejected'::text])))
);

--
-- Name: brain_source_profiles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.brain_source_profiles (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    workspace_id uuid NOT NULL,
    connection_id uuid NOT NULL,
    entity text NOT NULL,
    field_map jsonb DEFAULT '{}'::jsonb NOT NULL,
    trust smallint DEFAULT 60 NOT NULL,
    status text DEFAULT 'draft'::text NOT NULL,
    sample jsonb DEFAULT '[]'::jsonb NOT NULL,
    notes text DEFAULT ''::text NOT NULL,
    confirmed_by text,
    confirmed_at timestamp with time zone,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT brain_source_profiles_status_check CHECK ((status = ANY (ARRAY['draft'::text, 'confirmed'::text]))),
    CONSTRAINT brain_source_profiles_trust_check CHECK (((trust >= 0) AND (trust <= 100)))
);

--
-- Name: channel_receipts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.channel_receipts (
    workspace_id uuid NOT NULL,
    channel text NOT NULL,
    receipt_id text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

--
-- Name: connection_commands; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.connection_commands (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    workspace_id uuid NOT NULL,
    user_id uuid NOT NULL,
    kind text NOT NULL,
    input jsonb DEFAULT '{}'::jsonb NOT NULL,
    status text DEFAULT 'pending'::text NOT NULL,
    outcome jsonb,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    finished_at timestamp with time zone,
    CONSTRAINT connection_commands_kind_check CHECK (((char_length(kind) >= 1) AND (char_length(kind) <= 64))),
    CONSTRAINT connection_commands_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'done'::text])))
);

--
-- Name: connection_secrets; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.connection_secrets (
    connection_id uuid NOT NULL,
    ciphertext text NOT NULL,
    webhook_secret text NOT NULL,
    token_expires_at timestamp with time zone,
    refresh_lock_until timestamp with time zone
);

--
-- Name: connections; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.connections (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    workspace_id uuid NOT NULL,
    provider text NOT NULL,
    name text NOT NULL,
    public_meta jsonb DEFAULT '{}'::jsonb NOT NULL,
    status text DEFAULT 'connected'::text NOT NULL,
    last_error text,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    environment text DEFAULT 'live'::text NOT NULL,
    last_event_at timestamp with time zone,
    first_event jsonb,
    is_default boolean DEFAULT false NOT NULL,
    sync_every_minutes integer,
    last_sync_at timestamp with time zone,
    next_sync_at timestamp with time zone,
    CONSTRAINT connections_environment_check CHECK ((environment = ANY (ARRAY['test'::text, 'live'::text]))),
    CONSTRAINT connections_provider_check CHECK ((provider = ANY (ARRAY['telegram'::text, 'sepay'::text, 'zalo_oa'::text, 'payos'::text, 'casso'::text, 'webhook'::text, 'google'::text, 'smtp'::text, 'openapi'::text, 'database'::text, 'csv_import'::text, 'imap'::text, 'telegram_user'::text, 'google_drive'::text, 'meta'::text]))),
    CONSTRAINT connections_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'connected'::text, 'error'::text, 'disconnected'::text]))),
    CONSTRAINT connections_sync_every_minutes_check CHECK (((sync_every_minutes IS NULL) OR ((sync_every_minutes >= 5) AND (sync_every_minutes <= 10080))))
);

--
-- Name: connector_interest; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.connector_interest (
    workspace_id uuid NOT NULL,
    connector_id text NOT NULL,
    user_id uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT connector_interest_connector_id_check CHECK (((char_length(connector_id) >= 1) AND (char_length(connector_id) <= 60)))
);

--
-- Name: content_cadence; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.content_cadence (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    workspace_id uuid NOT NULL,
    channel text NOT NULL,
    posts_per_week integer DEFAULT 3 NOT NULL,
    days integer[] DEFAULT '{}'::integer[] NOT NULL,
    post_time text DEFAULT '19:30'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT content_cadence_channel_check CHECK ((channel = ANY (ARRAY['facebook'::text, 'zalo'::text, 'tiktok'::text, 'instagram'::text]))),
    CONSTRAINT content_cadence_post_time_check CHECK ((post_time ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'::text)),
    CONSTRAINT content_cadence_posts_per_week_check CHECK (((posts_per_week >= 0) AND (posts_per_week <= 21)))
);

--
-- Name: content_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.content_items (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    workspace_id uuid NOT NULL,
    plan_id uuid,
    title text NOT NULL,
    brief text DEFAULT ''::text NOT NULL,
    pillar_id uuid,
    channels text[] DEFAULT '{facebook}'::text[] NOT NULL,
    scheduled_at timestamp with time zone,
    status text DEFAULT 'idea'::text NOT NULL,
    variants jsonb DEFAULT '{}'::jsonb NOT NULL,
    hashtags text[] DEFAULT '{}'::text[] NOT NULL,
    media jsonb DEFAULT '[]'::jsonb NOT NULL,
    links jsonb DEFAULT '[]'::jsonb NOT NULL,
    holiday_key text,
    evidence jsonb DEFAULT '[]'::jsonb NOT NULL,
    published jsonb DEFAULT '{}'::jsonb NOT NULL,
    work_item_id uuid,
    drafted_at timestamp with time zone,
    approved_by text,
    approved_at timestamp with time zone,
    published_at timestamp with time zone,
    source text DEFAULT 'manual'::text NOT NULL,
    created_by text DEFAULT ''::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT content_items_source_check CHECK ((source = ANY (ARRAY['manual'::text, 'plan'::text, 'quick'::text, 'offer'::text, 'automation'::text]))),
    CONSTRAINT content_items_status_check CHECK ((status = ANY (ARRAY['idea'::text, 'draft'::text, 'waiting_approval'::text, 'approved'::text, 'published'::text, 'skipped'::text]))),
    CONSTRAINT content_items_title_check CHECK (((length(btrim(title)) >= 1) AND (length(btrim(title)) <= 200)))
);

--
-- Name: content_pillars; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.content_pillars (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    workspace_id uuid NOT NULL,
    name text NOT NULL,
    description text DEFAULT ''::text NOT NULL,
    weight integer DEFAULT 1 NOT NULL,
    sort integer DEFAULT 0 NOT NULL,
    active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT content_pillars_name_check CHECK (((length(btrim(name)) >= 1) AND (length(btrim(name)) <= 80))),
    CONSTRAINT content_pillars_weight_check CHECK (((weight >= 0) AND (weight <= 20)))
);

--
-- Name: content_plans; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.content_plans (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    workspace_id uuid NOT NULL,
    month date NOT NULL,
    status text DEFAULT 'done'::text NOT NULL,
    idea_count integer DEFAULT 0 NOT NULL,
    ai_ms integer,
    note text,
    meta jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_by text DEFAULT ''::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT content_plans_status_check CHECK ((status = ANY (ARRAY['done'::text, 'failed'::text])))
);

--
-- Name: content_settings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.content_settings (
    workspace_id uuid NOT NULL,
    brand_voice text DEFAULT ''::text NOT NULL,
    avoid text DEFAULT ''::text NOT NULL,
    cta text DEFAULT ''::text NOT NULL,
    hashtags text[] DEFAULT '{}'::text[] NOT NULL,
    automations jsonb DEFAULT '{"offer_draft": false, "today_reminder": false, "weekly_summary": false}'::jsonb NOT NULL,
    marks jsonb DEFAULT '{}'::jsonb NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);

--
-- Name: contracts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.contracts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    workspace_id uuid NOT NULL,
    lead_id uuid,
    customer_name text NOT NULL,
    plan text DEFAULT ''::text NOT NULL,
    starts_on date NOT NULL,
    ends_on date NOT NULL,
    amount_vnd bigint,
    status text DEFAULT 'active'::text NOT NULL,
    note text DEFAULT ''::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT contracts_amount_vnd_check CHECK (((amount_vnd IS NULL) OR (amount_vnd >= 0))),
    CONSTRAINT contracts_check CHECK ((ends_on >= starts_on)),
    CONSTRAINT contracts_status_check CHECK ((status = ANY (ARRAY['active'::text, 'ended'::text, 'cancelled'::text])))
);

--
-- Name: credit_pack_purchases; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.credit_pack_purchases (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    workspace_id uuid NOT NULL,
    order_id uuid NOT NULL,
    credits bigint NOT NULL,
    price_vnd bigint NOT NULL,
    period date NOT NULL,
    purchased_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT credit_pack_purchases_credits_check CHECK ((credits > 0)),
    CONSTRAINT credit_pack_purchases_price_vnd_check CHECK ((price_vnd >= 0))
);

--
-- Name: credit_packs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.credit_packs (
    code text NOT NULL,
    credits bigint NOT NULL,
    price_vnd bigint NOT NULL,
    sort integer DEFAULT 0 NOT NULL,
    active boolean DEFAULT true NOT NULL,
    CONSTRAINT credit_packs_credits_check CHECK ((credits > 0)),
    CONSTRAINT credit_packs_price_vnd_check CHECK ((price_vnd > 0))
);

--
-- Name: credit_topup_draws; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.credit_topup_draws (
    workspace_id uuid NOT NULL,
    period date NOT NULL,
    drawn bigint DEFAULT 0 NOT NULL,
    unfunded bigint DEFAULT 0 NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT credit_topup_draws_drawn_check CHECK ((drawn >= 0)),
    CONSTRAINT credit_topup_draws_unfunded_check CHECK ((unfunded >= 0))
);

--
-- Name: credit_topups; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.credit_topups (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    workspace_id uuid NOT NULL,
    credits bigint NOT NULL,
    credits_remaining bigint NOT NULL,
    price_vnd bigint NOT NULL,
    order_id uuid NOT NULL,
    pack_code text,
    purchased_at timestamp with time zone DEFAULT now() NOT NULL,
    expires_at timestamp with time zone NOT NULL,
    CONSTRAINT credit_topups_check CHECK (((credits_remaining >= 0) AND (credits_remaining <= credits))),
    CONSTRAINT credit_topups_check1 CHECK ((expires_at > purchased_at)),
    CONSTRAINT credit_topups_credits_check CHECK ((credits > 0)),
    CONSTRAINT credit_topups_price_vnd_check CHECK ((price_vnd >= 0))
);

--
-- Name: data_records; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.data_records (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    workspace_id uuid NOT NULL,
    connection_id uuid NOT NULL,
    entity text NOT NULL,
    external_id text NOT NULL,
    title text DEFAULT ''::text NOT NULL,
    occurred_at timestamp with time zone,
    data jsonb DEFAULT '{}'::jsonb NOT NULL,
    synced_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT data_records_entity_check CHECK ((entity = ANY (ARRAY['customer'::text, 'order'::text, 'product'::text, 'transaction'::text, 'message'::text, 'document'::text, 'other'::text])))
);

--
-- Name: data_sync_runs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.data_sync_runs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    workspace_id uuid NOT NULL,
    connection_id uuid NOT NULL,
    started_at timestamp with time zone DEFAULT now() NOT NULL,
    finished_at timestamp with time zone,
    status text DEFAULT 'running'::text NOT NULL,
    rows_upserted integer DEFAULT 0 NOT NULL,
    error text,
    trigger text DEFAULT 'schedule'::text NOT NULL,
    CONSTRAINT data_sync_runs_status_check CHECK ((status = ANY (ARRAY['running'::text, 'ok'::text, 'failed'::text]))),
    CONSTRAINT data_sync_runs_trigger_check CHECK ((trigger = ANY (ARRAY['schedule'::text, 'manual'::text, 'upload'::text, 'push'::text])))
);

--
-- Name: decisions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.decisions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    workspace_id uuid NOT NULL,
    work_item_id uuid,
    lead_id uuid,
    department text NOT NULL,
    action text NOT NULL,
    decided_by text NOT NULL,
    decider_kind text NOT NULL,
    outcome text NOT NULL,
    reason text,
    note text,
    before jsonb,
    after jsonb,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT decisions_decider_kind_check CHECK ((decider_kind = ANY (ARRAY['policy'::text, 'owner'::text, 'staff'::text]))),
    CONSTRAINT decisions_outcome_check CHECK ((outcome = ANY (ARRAY['auto_done'::text, 'approved'::text, 'edited'::text, 'rejected'::text])))
);

--
-- Name: email_messages; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.email_messages (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    workspace_id uuid NOT NULL,
    connection_id uuid,
    to_address text NOT NULL,
    subject text DEFAULT ''::text NOT NULL,
    purpose text DEFAULT ''::text NOT NULL,
    status text NOT NULL,
    via text DEFAULT 'workspace'::text NOT NULL,
    provider_message_id text,
    error text,
    refs jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT email_messages_status_check CHECK ((status = ANY (ARRAY['sent'::text, 'failed'::text, 'no_smtp'::text, 'blocked'::text, 'rate_limited'::text, 'waiting_decision'::text]))),
    CONSTRAINT email_messages_via_check CHECK ((via = ANY (ARRAY['workspace'::text, 'platform'::text, 'none'::text])))
);

--
-- Name: events; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.events (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    workspace_id uuid NOT NULL,
    lead_id uuid,
    kind text NOT NULL,
    actor text NOT NULL,
    summary text NOT NULL,
    evidence text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    work_item_id uuid
);

--
-- Name: executions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.executions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    workspace_id uuid NOT NULL,
    responsibility_id uuid NOT NULL,
    agent_id uuid,
    kind text DEFAULT 'follow_up'::text NOT NULL,
    draft text NOT NULL,
    status text DEFAULT 'pending_approval'::text NOT NULL,
    decided_by text,
    decided_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    work_item_id uuid,
    CONSTRAINT executions_status_check CHECK ((status = ANY (ARRAY['pending_approval'::text, 'approved'::text, 'rejected'::text])))
);

--
-- Name: hiring_apply_hits; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.hiring_apply_hits (
    id bigint NOT NULL,
    ip_hash text NOT NULL,
    workspace_id uuid,
    kind text DEFAULT 'apply'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

--
-- Name: hiring_apply_hits_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.hiring_apply_hits ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.hiring_apply_hits_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);

--
-- Name: hiring_availability; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.hiring_availability (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    workspace_id uuid NOT NULL,
    member_user_id uuid NOT NULL,
    weekday smallint NOT NULL,
    start_min integer NOT NULL,
    end_min integer NOT NULL,
    CONSTRAINT hiring_availability_check CHECK ((end_min > start_min)),
    CONSTRAINT hiring_availability_end_min_check CHECK (((end_min >= 1) AND (end_min <= 1440))),
    CONSTRAINT hiring_availability_start_min_check CHECK (((start_min >= 0) AND (start_min <= 1439))),
    CONSTRAINT hiring_availability_weekday_check CHECK (((weekday >= 0) AND (weekday <= 6)))
);

--
-- Name: hiring_candidates; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.hiring_candidates (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    workspace_id uuid NOT NULL,
    job_id uuid NOT NULL,
    name text NOT NULL,
    phone text DEFAULT ''::text NOT NULL,
    email text DEFAULT ''::text NOT NULL,
    source text DEFAULT 'page'::text NOT NULL,
    conversation_id uuid,
    cv_path text,
    cv_name text,
    cv_mime text,
    cv_size integer,
    answers jsonb DEFAULT '[]'::jsonb NOT NULL,
    availability text DEFAULT ''::text NOT NULL,
    score integer,
    score_label text,
    score_reasons jsonb DEFAULT '[]'::jsonb NOT NULL,
    score_summary text,
    screened_at timestamp with time zone,
    stage text DEFAULT 'applied'::text NOT NULL,
    stage_changed_at timestamp with time zone DEFAULT now() NOT NULL,
    rejected_reason text,
    notes text DEFAULT ''::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    staff_id uuid,
    CONSTRAINT hiring_candidates_name_check CHECK (((char_length(name) >= 2) AND (char_length(name) <= 120))),
    CONSTRAINT hiring_candidates_score_check CHECK (((score IS NULL) OR ((score >= 0) AND (score <= 100)))),
    CONSTRAINT hiring_candidates_score_label_check CHECK (((score_label IS NULL) OR (score_label = ANY (ARRAY['fit'::text, 'consider'::text, 'not_fit'::text])))),
    CONSTRAINT hiring_candidates_source_check CHECK ((source = ANY (ARRAY['page'::text, 'chat'::text, 'manual'::text]))),
    CONSTRAINT hiring_candidates_stage_check CHECK ((stage = ANY (ARRAY['applied'::text, 'screening'::text, 'shortlisted'::text, 'interview'::text, 'offer'::text, 'hired'::text, 'rejected'::text, 'withdrawn'::text])))
);

--
-- Name: hiring_consents; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.hiring_consents (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    workspace_id uuid NOT NULL,
    candidate_id uuid NOT NULL,
    channel text NOT NULL,
    consent_text text NOT NULL,
    ip_hash text,
    given_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT hiring_consents_channel_check CHECK ((channel = ANY (ARRAY['page'::text, 'chat'::text, 'manual'::text])))
);

--
-- Name: hiring_events; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.hiring_events (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    workspace_id uuid NOT NULL,
    candidate_id uuid NOT NULL,
    kind text NOT NULL,
    actor text NOT NULL,
    summary text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

--
-- Name: hiring_interviews; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.hiring_interviews (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    workspace_id uuid NOT NULL,
    candidate_id uuid NOT NULL,
    job_id uuid NOT NULL,
    interviewer_user_id uuid,
    interviewer_name text DEFAULT ''::text NOT NULL,
    mode text DEFAULT 'in_person'::text NOT NULL,
    location text DEFAULT ''::text NOT NULL,
    duration_min integer DEFAULT 30 NOT NULL,
    proposed_slots jsonb DEFAULT '[]'::jsonb NOT NULL,
    slot_start timestamp with time zone,
    slot_end timestamp with time zone,
    status text DEFAULT 'proposed'::text NOT NULL,
    token text NOT NULL,
    work_item_id uuid,
    reminder_sent_at timestamp with time zone,
    note text DEFAULT ''::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT hiring_interviews_duration_min_check CHECK (((duration_min >= 10) AND (duration_min <= 240))),
    CONSTRAINT hiring_interviews_mode_check CHECK ((mode = ANY (ARRAY['in_person'::text, 'online'::text]))),
    CONSTRAINT hiring_interviews_status_check CHECK ((status = ANY (ARRAY['proposed'::text, 'confirmed'::text, 'done'::text, 'cancelled'::text, 'no_show'::text])))
);

--
-- Name: hiring_jobs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.hiring_jobs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    workspace_id uuid NOT NULL,
    slug text NOT NULL,
    title text NOT NULL,
    "position" text DEFAULT ''::text NOT NULL,
    employment_type text DEFAULT 'full_time'::text NOT NULL,
    schedule text DEFAULT ''::text NOT NULL,
    pay_min_vnd bigint,
    pay_max_vnd bigint,
    pay_unit text DEFAULT 'month'::text NOT NULL,
    location text DEFAULT ''::text NOT NULL,
    headcount integer DEFAULT 1 NOT NULL,
    description text DEFAULT ''::text NOT NULL,
    requirements jsonb DEFAULT '{}'::jsonb NOT NULL,
    questions jsonb DEFAULT '[]'::jsonb NOT NULL,
    status text DEFAULT 'draft'::text NOT NULL,
    channels text[] DEFAULT ARRAY['page'::text, 'chat'::text] NOT NULL,
    ad_variants jsonb,
    closes_at timestamp with time zone,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT hiring_jobs_employment_type_check CHECK ((employment_type = ANY (ARRAY['full_time'::text, 'part_time'::text]))),
    CONSTRAINT hiring_jobs_headcount_check CHECK (((headcount >= 1) AND (headcount <= 500))),
    CONSTRAINT hiring_jobs_pay_max_vnd_check CHECK (((pay_max_vnd IS NULL) OR (pay_max_vnd >= 0))),
    CONSTRAINT hiring_jobs_pay_min_vnd_check CHECK (((pay_min_vnd IS NULL) OR (pay_min_vnd >= 0))),
    CONSTRAINT hiring_jobs_pay_unit_check CHECK ((pay_unit = ANY (ARRAY['month'::text, 'hour'::text, 'shift'::text]))),
    CONSTRAINT hiring_jobs_slug_check CHECK (((slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'::text) AND ((char_length(slug) >= 2) AND (char_length(slug) <= 80)))),
    CONSTRAINT hiring_jobs_status_check CHECK ((status = ANY (ARRAY['draft'::text, 'open'::text, 'paused'::text, 'closed'::text]))),
    CONSTRAINT hiring_jobs_title_check CHECK (((char_length(title) >= 3) AND (char_length(title) <= 140)))
);

--
-- Name: hiring_offers; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.hiring_offers (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    workspace_id uuid NOT NULL,
    candidate_id uuid NOT NULL,
    job_id uuid NOT NULL,
    terms jsonb DEFAULT '{}'::jsonb NOT NULL,
    draft text DEFAULT ''::text NOT NULL,
    status text DEFAULT 'draft'::text NOT NULL,
    token text NOT NULL,
    work_item_id uuid,
    sent_via text,
    sent_at timestamp with time zone,
    expires_at timestamp with time zone,
    responded_at timestamp with time zone,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT hiring_offers_sent_via_check CHECK (((sent_via IS NULL) OR (sent_via = ANY (ARRAY['email'::text, 'chat'::text, 'manual'::text])))),
    CONSTRAINT hiring_offers_status_check CHECK ((status = ANY (ARRAY['draft'::text, 'waiting'::text, 'sent'::text, 'accepted'::text, 'declined'::text, 'expired'::text, 'cancelled'::text])))
);

--
-- Name: hiring_onboarding; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.hiring_onboarding (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    workspace_id uuid NOT NULL,
    candidate_id uuid NOT NULL,
    title text NOT NULL,
    done boolean DEFAULT false NOT NULL,
    done_at timestamp with time zone,
    sort integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

--
-- Name: hiring_retention_log; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.hiring_retention_log (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    workspace_id uuid NOT NULL,
    deleted_candidates integer DEFAULT 0 NOT NULL,
    deleted_files integer DEFAULT 0 NOT NULL,
    retention_days integer NOT NULL,
    ran_at timestamp with time zone DEFAULT now() NOT NULL
);

--
-- Name: hiring_settings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.hiring_settings (
    workspace_id uuid NOT NULL,
    public_slug text NOT NULL,
    retention_days integer DEFAULT 90 NOT NULL,
    notify_new_candidate boolean DEFAULT true NOT NULL,
    remind_interview boolean DEFAULT true NOT NULL,
    auto_close_when_filled boolean DEFAULT true NOT NULL,
    apply_consent_text text DEFAULT 'Tôi đồng ý để doanh nghiệp lưu hồ sơ và thông tin tôi cung cấp để xét tuyển. Hồ sơ chỉ dùng cho việc tuyển dụng và được xóa khi hết thời hạn lưu trữ hoặc khi tôi yêu cầu.'::text NOT NULL,
    ad_tone text DEFAULT 'thân thiện, rõ ràng, tôn trọng'::text NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT hiring_settings_public_slug_check CHECK (((public_slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'::text) AND ((char_length(public_slug) >= 3) AND (char_length(public_slug) <= 60)))),
    CONSTRAINT hiring_settings_retention_days_check CHECK (((retention_days >= 7) AND (retention_days <= 730)))
);

--
-- Name: inbound_events; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.inbound_events (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    workspace_id uuid NOT NULL,
    channel text NOT NULL,
    kind text NOT NULL,
    origin text NOT NULL,
    sender_name text,
    sender_contact text,
    body text DEFAULT ''::text NOT NULL,
    amount_vnd bigint,
    external_ref text,
    dedupe_key text NOT NULL,
    duplicate_count integer DEFAULT 0 NOT NULL,
    last_duplicate_at timestamp with time zone,
    lead_id uuid,
    status text DEFAULT 'received'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    event_id text,
    CONSTRAINT inbound_events_channel_check CHECK ((channel = ANY (ARRAY['website'::text, 'telegram'::text, 'facebook'::text, 'zalo'::text, 'email'::text, 'phone'::text, 'bank'::text, 'manual'::text, 'instagram'::text]))),
    CONSTRAINT inbound_events_kind_check CHECK ((kind = ANY (ARRAY['message'::text, 'lead'::text, 'order'::text, 'invoice'::text, 'payment'::text]))),
    CONSTRAINT inbound_events_origin_check CHECK ((origin = ANY (ARRAY['live'::text, 'simulated'::text]))),
    CONSTRAINT inbound_events_status_check CHECK ((status = ANY (ARRAY['received'::text, 'processed'::text, 'needs_decision'::text, 'failed'::text])))
);

--
-- Name: inventory_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.inventory_items (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    workspace_id uuid NOT NULL,
    sku text NOT NULL,
    name text NOT NULL,
    unit text DEFAULT 'cái'::text NOT NULL,
    units jsonb DEFAULT '[]'::jsonb NOT NULL,
    category text DEFAULT ''::text NOT NULL,
    cost_vnd numeric(14,2) DEFAULT 0 NOT NULL,
    sell_price_vnd numeric(14,2),
    reorder_point numeric(16,3) DEFAULT 0 NOT NULL,
    reorder_qty numeric(16,3) DEFAULT 0 NOT NULL,
    supplier_id uuid,
    aliases text[] DEFAULT '{}'::text[] NOT NULL,
    active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);

--
-- Name: inventory_locations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.inventory_locations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    workspace_id uuid NOT NULL,
    name text NOT NULL,
    is_default boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

--
-- Name: inventory_movements; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.inventory_movements (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    workspace_id uuid NOT NULL,
    item_id uuid NOT NULL,
    location_id uuid NOT NULL,
    kind text NOT NULL,
    qty numeric(16,3) NOT NULL,
    qty_after numeric(16,3) NOT NULL,
    unit_cost_vnd numeric(14,2),
    reason text DEFAULT ''::text NOT NULL,
    ref_type text DEFAULT 'manual'::text NOT NULL,
    ref_id text,
    ref_label text,
    by_name text DEFAULT 'NIVO'::text NOT NULL,
    evidence text,
    dedupe_key text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT inventory_movements_kind_check CHECK ((kind = ANY (ARRAY['in'::text, 'out'::text, 'adjust'::text, 'transfer'::text]))),
    CONSTRAINT inventory_movements_ref_type_check CHECK ((ref_type = ANY (ARRAY['manual'::text, 'order'::text, 'po'::text, 'count'::text, 'import'::text, 'transfer'::text])))
);

--
-- Name: inventory_po_lines; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.inventory_po_lines (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    workspace_id uuid NOT NULL,
    po_id uuid NOT NULL,
    item_id uuid NOT NULL,
    qty_ordered numeric(16,3) NOT NULL,
    qty_received numeric(16,3) DEFAULT 0 NOT NULL,
    unit_cost_vnd numeric(14,2) DEFAULT 0 NOT NULL,
    CONSTRAINT inventory_po_lines_qty_ordered_check CHECK ((qty_ordered > (0)::numeric))
);

--
-- Name: inventory_purchase_orders; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.inventory_purchase_orders (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    workspace_id uuid NOT NULL,
    po_no text NOT NULL,
    supplier_id uuid,
    status text DEFAULT 'draft'::text NOT NULL,
    total_vnd numeric(16,0) DEFAULT 0 NOT NULL,
    expected_at date,
    message text DEFAULT ''::text NOT NULL,
    sent_at timestamp with time zone,
    sent_via text,
    send_note text,
    work_item_id uuid,
    note text DEFAULT ''::text NOT NULL,
    source text DEFAULT 'manual'::text NOT NULL,
    created_by text DEFAULT 'NIVO'::text NOT NULL,
    reminders integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT inventory_purchase_orders_sent_via_check CHECK ((sent_via = ANY (ARRAY['email'::text, 'copy'::text]))),
    CONSTRAINT inventory_purchase_orders_source_check CHECK ((source = ANY (ARRAY['auto'::text, 'manual'::text]))),
    CONSTRAINT inventory_purchase_orders_status_check CHECK ((status = ANY (ARRAY['draft'::text, 'waiting_approval'::text, 'sent'::text, 'partially_received'::text, 'received'::text, 'cancelled'::text])))
);

--
-- Name: inventory_receipts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.inventory_receipts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    workspace_id uuid NOT NULL,
    po_id uuid NOT NULL,
    invoice_no text,
    total_vnd numeric(16,0) DEFAULT 0 NOT NULL,
    note text DEFAULT ''::text NOT NULL,
    received_by text DEFAULT ''::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

--
-- Name: inventory_recipe_lines; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.inventory_recipe_lines (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    workspace_id uuid NOT NULL,
    recipe_id uuid NOT NULL,
    item_id uuid NOT NULL,
    qty numeric(16,3) NOT NULL,
    CONSTRAINT inventory_recipe_lines_qty_check CHECK ((qty > (0)::numeric))
);

--
-- Name: inventory_recipes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.inventory_recipes (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    workspace_id uuid NOT NULL,
    name text NOT NULL,
    aliases text[] DEFAULT '{}'::text[] NOT NULL,
    active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

--
-- Name: inventory_stock_levels; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.inventory_stock_levels (
    workspace_id uuid NOT NULL,
    item_id uuid NOT NULL,
    location_id uuid NOT NULL,
    qty numeric(16,3) DEFAULT 0 NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);

--
-- Name: inventory_suppliers; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.inventory_suppliers (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    workspace_id uuid NOT NULL,
    name text NOT NULL,
    contact_name text DEFAULT ''::text NOT NULL,
    email text,
    phone text,
    zalo text,
    channel text DEFAULT 'email'::text NOT NULL,
    lead_time_days integer DEFAULT 2 NOT NULL,
    payment_terms text DEFAULT ''::text NOT NULL,
    note text DEFAULT ''::text NOT NULL,
    active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT inventory_suppliers_channel_check CHECK ((channel = ANY (ARRAY['email'::text, 'zalo'::text, 'phone'::text]))),
    CONSTRAINT inventory_suppliers_lead_time_days_check CHECK ((lead_time_days >= 0))
);

--
-- Name: invoices; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.invoices (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    workspace_id uuid NOT NULL,
    order_id uuid,
    lead_id uuid,
    invoice_no text NOT NULL,
    amount_vnd bigint NOT NULL,
    due_at timestamp with time zone,
    status text DEFAULT 'draft'::text NOT NULL,
    origin text DEFAULT 'live'::text NOT NULL,
    issued_by text,
    issued_at timestamp with time zone,
    paid_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT invoices_amount_vnd_check CHECK ((amount_vnd >= 0)),
    CONSTRAINT invoices_origin_check CHECK ((origin = ANY (ARRAY['live'::text, 'simulated'::text]))),
    CONSTRAINT invoices_status_check CHECK ((status = ANY (ARRAY['draft'::text, 'issued'::text, 'paid'::text, 'void'::text])))
);

--
-- Name: job_outbox; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.job_outbox (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    workspace_id uuid,
    queue text NOT NULL,
    name text NOT NULL,
    payload jsonb DEFAULT '{}'::jsonb NOT NULL,
    dedupe_key text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    sent_at timestamp with time zone,
    attempts integer DEFAULT 0 NOT NULL,
    last_error text,
    msg_id bigint,
    state text DEFAULT 'queued'::text NOT NULL,
    started_at timestamp with time zone,
    finished_at timestamp with time zone,
    CONSTRAINT job_outbox_dedupe_key_check CHECK ((((length(dedupe_key) >= 1) AND (length(dedupe_key) <= 300)) AND (POSITION((':'::text) IN (dedupe_key)) > 0))),
    CONSTRAINT job_outbox_name_check CHECK ((name ~ '^[a-z][a-z0-9_.-]{0,126}$'::text)),
    CONSTRAINT job_outbox_queue_check CHECK ((queue ~ '^[a-z][a-z0-9_-]{0,62}$'::text)),
    CONSTRAINT job_outbox_state_check CHECK ((state = ANY (ARRAY['queued'::text, 'running'::text, 'done'::text, 'failed'::text])))
);

--
-- Name: job_slots; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.job_slots (
    queue text NOT NULL,
    msg_id bigint NOT NULL,
    workspace_id uuid NOT NULL,
    lease_until timestamp with time zone NOT NULL
);

--
-- Name: jobs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.jobs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    kind character varying(200) NOT NULL,
    job_key character varying(200) NOT NULL,
    status character varying(16) NOT NULL,
    current_step character varying(200),
    fencing_token bigint NOT NULL,
    claimed_by character varying(200),
    lease_expires_at timestamp with time zone,
    payload jsonb NOT NULL,
    error text,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL,
    CONSTRAINT jobs_fencing_token_check CHECK ((fencing_token >= 1)),
    CONSTRAINT jobs_status_check CHECK (((status)::text = ANY ((ARRAY['running'::character varying, 'failed'::character varying, 'done'::character varying])::text[])))
);

--
-- Name: knowledge_chunks; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.knowledge_chunks (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    workspace_id uuid NOT NULL,
    source_id uuid NOT NULL,
    module text,
    ord integer NOT NULL,
    content text NOT NULL,
    embedding extensions.vector(1536),
    fts tsvector GENERATED ALWAYS AS (to_tsvector('simple'::regconfig, public.knowledge_fold(content))) STORED,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    visibility text DEFAULT 'internal'::text NOT NULL,
    embedding_model text,
    CONSTRAINT knowledge_chunks_embedding_model_check CHECK (((embedding IS NULL) OR (embedding_model IS NOT NULL))),
    CONSTRAINT knowledge_chunks_visibility_check CHECK ((visibility = ANY (ARRAY['public'::text, 'internal'::text])))
);

--
-- Name: knowledge_gaps; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.knowledge_gaps (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    workspace_id uuid NOT NULL,
    module text NOT NULL,
    question text NOT NULL,
    question_key text NOT NULL,
    keywords text[] DEFAULT '{}'::text[] NOT NULL,
    topic text,
    attribute_guess text,
    count integer DEFAULT 1 NOT NULL,
    first_seen_at timestamp with time zone DEFAULT now() NOT NULL,
    last_seen_at timestamp with time zone DEFAULT now() NOT NULL,
    example_conversation_id uuid,
    source text DEFAULT 'retrieval'::text NOT NULL,
    status text DEFAULT 'open'::text NOT NULL,
    answered_at timestamp with time zone,
    answered_by text,
    dismissed_at timestamp with time zone,
    dismissed_by text,
    reopened_count integer DEFAULT 0 NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT knowledge_gaps_count_check CHECK ((count >= 1)),
    CONSTRAINT knowledge_gaps_source_check CHECK ((source = ANY (ARRAY['model'::text, 'retrieval'::text]))),
    CONSTRAINT knowledge_gaps_status_check CHECK ((status = ANY (ARRAY['open'::text, 'answered'::text, 'dismissed'::text])))
);

--
-- Name: knowledge_sources; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.knowledge_sources (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    workspace_id uuid NOT NULL,
    module text,
    kind text NOT NULL,
    title text NOT NULL,
    content text DEFAULT ''::text NOT NULL,
    status text DEFAULT 'pending'::text NOT NULL,
    error text,
    chunk_count integer DEFAULT 0 NOT NULL,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    topic text,
    tags text[] DEFAULT '{}'::text[] NOT NULL,
    visibility text DEFAULT 'internal'::text NOT NULL,
    installation_id uuid,
    storage_path text,
    source_url text,
    origin text,
    progress integer DEFAULT 0 NOT NULL,
    CONSTRAINT knowledge_sources_kind_check CHECK ((kind = ANY (ARRAY['text'::text, 'faq'::text, 'file'::text, 'url'::text]))),
    CONSTRAINT knowledge_sources_progress_check CHECK (((progress >= 0) AND (progress <= 100))),
    CONSTRAINT knowledge_sources_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'queued'::text, 'reading'::text, 'indexing'::text, 'extracting_facts'::text, 'ready'::text, 'failed'::text, 'blocked_credits'::text]))),
    CONSTRAINT knowledge_sources_visibility_check CHECK ((visibility = ANY (ARRAY['public'::text, 'internal'::text])))
);

--
-- Name: knowledge_suggestion_state; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.knowledge_suggestion_state (
    workspace_id uuid NOT NULL,
    suggestion_key text NOT NULL,
    state text NOT NULL,
    decided_by uuid,
    decided_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT knowledge_suggestion_state_state_check CHECK ((state = ANY (ARRAY['dismissed'::text, 'not_applicable'::text])))
);

--
-- Name: lead_actions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.lead_actions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    workspace_id uuid NOT NULL,
    requested_by uuid NOT NULL,
    action text NOT NULL,
    input jsonb NOT NULL,
    locale text NOT NULL,
    status text DEFAULT 'queued'::text NOT NULL,
    job_id uuid,
    fencing_token bigint,
    result jsonb,
    error_code text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT lead_actions_action_check CHECK ((action = ANY (ARRAY['create'::text, 'refresh-context'::text, 'suggest-owner'::text, 'draft-execution'::text, 'settle-won'::text]))),
    CONSTRAINT lead_actions_locale_check CHECK ((locale = ANY (ARRAY['vi'::text, 'en'::text]))),
    CONSTRAINT lead_actions_status_check CHECK ((status = ANY (ARRAY['queued'::text, 'running'::text, 'succeeded'::text, 'failed'::text])))
);

--
-- Name: lead_flows; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.lead_flows (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    workspace_id uuid NOT NULL,
    lead_id uuid,
    connection_id uuid,
    conversation_id uuid,
    platform text,
    psid text,
    igsid text,
    phone text,
    email text,
    name text,
    state text DEFAULT 'new'::text NOT NULL,
    resume_state text,
    source jsonb DEFAULT '{}'::jsonb NOT NULL,
    touches jsonb DEFAULT '[]'::jsonb NOT NULL,
    answers jsonb DEFAULT '[]'::jsonb NOT NULL,
    asked integer DEFAULT 0 NOT NULL,
    pending_question integer,
    contact_asked_at timestamp with time zone,
    signals jsonb DEFAULT '{}'::jsonb NOT NULL,
    score text,
    score_reasons jsonb DEFAULT '[]'::jsonb NOT NULL,
    scored_at timestamp with time zone,
    analysis jsonb,
    last_user_at timestamp with time zone,
    last_user_text text,
    greeted_at timestamp with time zone,
    handed_off_at timestamp with time zone,
    followed_up_at timestamp with time zone,
    closed_at timestamp with time zone,
    escalated_at timestamp with time zone,
    escalation_reason text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    installation_id uuid,
    CONSTRAINT lead_flows_asked_check CHECK (((asked >= 0) AND (asked <= 4))),
    CONSTRAINT lead_flows_platform_check CHECK ((platform = ANY (ARRAY['facebook'::text, 'instagram'::text]))),
    CONSTRAINT lead_flows_score_check CHECK ((score = ANY (ARRAY['hot'::text, 'warm'::text, 'cold'::text]))),
    CONSTRAINT lead_flows_state_check CHECK ((state = ANY (ARRAY['new'::text, 'greeted'::text, 'qualifying'::text, 'scored'::text, 'handed_off'::text, 'nurturing'::text, 'closed'::text, 'escalated'::text])))
);

--
-- Name: leads; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.leads (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    workspace_id uuid NOT NULL,
    contact_name text NOT NULL,
    company text NOT NULL,
    channel text NOT NULL,
    need text NOT NULL,
    stage text DEFAULT 'new'::text NOT NULL,
    context_summary text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    phone text,
    email text,
    origin text,
    installation_id uuid,
    CONSTRAINT leads_origin_check CHECK ((origin = ANY (ARRAY['live'::text, 'simulated'::text]))),
    CONSTRAINT leads_stage_check CHECK ((stage = ANY (ARRAY['new'::text, 'qualified'::text, 'proposal'::text, 'won'::text, 'lost'::text])))
);

--
-- Name: loyalty_customers; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.loyalty_customers (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    workspace_id uuid NOT NULL,
    name text DEFAULT ''::text NOT NULL,
    phone text,
    email text,
    birthday date,
    tier_key text,
    tier_since timestamp with time zone,
    joined_at timestamp with time zone DEFAULT now() NOT NULL,
    note text DEFAULT ''::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);

--
-- Name: loyalty_ledger; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.loyalty_ledger (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    workspace_id uuid NOT NULL,
    customer_id uuid NOT NULL,
    kind text NOT NULL,
    points integer NOT NULL,
    amount_vnd bigint,
    order_id uuid,
    invoice_id uuid,
    reward_id uuid,
    work_item_id uuid,
    ref text NOT NULL,
    by_name text DEFAULT 'NIVO'::text NOT NULL,
    evidence text,
    expires_at timestamp with time zone,
    occurred_at timestamp with time zone DEFAULT now() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT loyalty_ledger_check CHECK ((((kind = 'earn'::text) AND (points > 0)) OR ((kind = ANY (ARRAY['redeem'::text, 'expire'::text])) AND (points < 0)) OR (kind = 'adjust'::text))),
    CONSTRAINT loyalty_ledger_kind_check CHECK ((kind = ANY (ARRAY['earn'::text, 'redeem'::text, 'expire'::text, 'adjust'::text]))),
    CONSTRAINT loyalty_ledger_points_check CHECK ((points <> 0))
);

--
-- Name: loyalty_balances; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.loyalty_balances WITH (security_invoker='true') AS
 SELECT c.workspace_id,
    c.id AS customer_id,
    (COALESCE(sum(l.points), (0)::bigint))::integer AS points,
    (COALESCE(sum(l.amount_vnd) FILTER (WHERE (l.kind = 'earn'::text)), (0)::numeric))::bigint AS lifetime_spend_vnd,
    (COALESCE(sum(l.points) FILTER (WHERE (l.kind = 'earn'::text)), (0)::bigint))::integer AS lifetime_earned,
    (count(*) FILTER (WHERE ((l.kind = 'earn'::text) AND (l.order_id IS NOT NULL))))::integer AS visits,
    max(l.occurred_at) FILTER (WHERE (l.kind = 'earn'::text)) AS last_visit_at
   FROM (public.loyalty_customers c
     LEFT JOIN public.loyalty_ledger l ON ((l.customer_id = c.id)))
  GROUP BY c.workspace_id, c.id;

--
-- Name: loyalty_campaigns; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.loyalty_campaigns (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    workspace_id uuid NOT NULL,
    name text NOT NULL,
    segment jsonb DEFAULT '{}'::jsonb NOT NULL,
    draft text DEFAULT ''::text NOT NULL,
    status text DEFAULT 'draft'::text NOT NULL,
    work_item_id uuid,
    recipients integer DEFAULT 0 NOT NULL,
    draft_ms integer,
    created_by text DEFAULT ''::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    finished_at timestamp with time zone,
    CONSTRAINT loyalty_campaigns_status_check CHECK ((status = ANY (ARRAY['draft'::text, 'waiting'::text, 'waiting_decision'::text, 'sending'::text, 'done'::text, 'rejected'::text, 'failed'::text])))
);

--
-- Name: loyalty_customer_links; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.loyalty_customer_links (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    workspace_id uuid NOT NULL,
    customer_id uuid NOT NULL,
    kind text NOT NULL,
    ref text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT loyalty_customer_links_kind_check CHECK ((kind = ANY (ARRAY['lead'::text, 'conversation'::text, 'channel'::text])))
);

--
-- Name: loyalty_otps; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.loyalty_otps (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    workspace_id uuid NOT NULL,
    customer_id uuid NOT NULL,
    code_hash text NOT NULL,
    attempts integer DEFAULT 0 NOT NULL,
    expires_at timestamp with time zone NOT NULL,
    used_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

--
-- Name: loyalty_programs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.loyalty_programs (
    workspace_id uuid NOT NULL,
    slug text NOT NULL,
    name text DEFAULT ''::text NOT NULL,
    enabled boolean DEFAULT true NOT NULL,
    config jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT loyalty_programs_slug_check CHECK ((slug ~ '^[a-z0-9][a-z0-9-]{1,38}[a-z0-9]$'::text))
);

--
-- Name: loyalty_rewards; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.loyalty_rewards (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    workspace_id uuid NOT NULL,
    key text NOT NULL,
    name text NOT NULL,
    kind text DEFAULT 'voucher'::text NOT NULL,
    value_vnd bigint DEFAULT 0 NOT NULL,
    percent integer,
    points_cost integer NOT NULL,
    stock integer,
    per_customer_limit integer,
    min_tier_key text,
    note text DEFAULT ''::text NOT NULL,
    active boolean DEFAULT true NOT NULL,
    sort_order integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT loyalty_rewards_key_check CHECK ((key ~ '^[a-z0-9][a-z0-9_-]{0,38}$'::text)),
    CONSTRAINT loyalty_rewards_kind_check CHECK ((kind = ANY (ARRAY['voucher'::text, 'item'::text, 'percent'::text]))),
    CONSTRAINT loyalty_rewards_per_customer_limit_check CHECK (((per_customer_limit IS NULL) OR (per_customer_limit > 0))),
    CONSTRAINT loyalty_rewards_percent_check CHECK (((percent IS NULL) OR ((percent >= 1) AND (percent <= 100)))),
    CONSTRAINT loyalty_rewards_points_cost_check CHECK ((points_cost > 0)),
    CONSTRAINT loyalty_rewards_stock_check CHECK (((stock IS NULL) OR (stock >= 0))),
    CONSTRAINT loyalty_rewards_value_vnd_check CHECK ((value_vnd >= 0))
);

--
-- Name: loyalty_sends; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.loyalty_sends (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    workspace_id uuid NOT NULL,
    campaign_id uuid NOT NULL,
    customer_id uuid NOT NULL,
    lead_id uuid,
    conversation_id uuid,
    status text DEFAULT 'queued'::text NOT NULL,
    body text,
    error text,
    sent_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT loyalty_sends_status_check CHECK ((status = ANY (ARRAY['queued'::text, 'sent'::text, 'failed'::text, 'skipped'::text])))
);

--
-- Name: messages; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.messages (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    workspace_id uuid NOT NULL,
    author_kind text NOT NULL,
    author_name text NOT NULL,
    agent_id uuid,
    body text NOT NULL,
    lead_id uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    work_item_id uuid,
    staff_id uuid,
    CONSTRAINT messages_author_kind_check CHECK ((author_kind = ANY (ARRAY['human'::text, 'agent'::text, 'system'::text])))
);

--
-- Name: meta_comments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.meta_comments (
    connection_id uuid NOT NULL,
    comment_id text NOT NULL,
    platform text NOT NULL,
    comment_at timestamp with time zone,
    private_replied_at timestamp with time zone,
    CONSTRAINT meta_comments_platform_check CHECK ((platform = ANY (ARRAY['facebook'::text, 'instagram'::text])))
);

--
-- Name: meta_inbox; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.meta_inbox (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    provider text NOT NULL,
    delivery_id text NOT NULL,
    received_at timestamp with time zone DEFAULT now() NOT NULL,
    payload jsonb NOT NULL,
    processed_at timestamp with time zone,
    CONSTRAINT meta_inbox_provider_check CHECK ((provider = 'meta'::text))
);

--
-- Name: meta_threads; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.meta_threads (
    connection_id uuid NOT NULL,
    platform text NOT NULL,
    user_id text NOT NULL,
    last_user_at timestamp with time zone NOT NULL,
    CONSTRAINT meta_threads_platform_check CHECK ((platform = ANY (ARRAY['facebook'::text, 'instagram'::text])))
);

--
-- Name: module_context_notes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.module_context_notes (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    workspace_id uuid NOT NULL,
    installation_id uuid NOT NULL,
    fact_key text NOT NULL,
    body text NOT NULL,
    source text DEFAULT 'office'::text NOT NULL,
    author_name text NOT NULL,
    author_role text DEFAULT 'staff'::text NOT NULL,
    author_user_id uuid,
    status text DEFAULT 'pending'::text NOT NULL,
    applied_version integer,
    decided_by text,
    decided_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT module_context_notes_author_role_check CHECK ((author_role = ANY (ARRAY['owner'::text, 'manager'::text, 'staff'::text]))),
    CONSTRAINT module_context_notes_source_check CHECK ((source = ANY (ARRAY['office'::text, 'setup'::text]))),
    CONSTRAINT module_context_notes_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'applied'::text, 'dismissed'::text])))
);

--
-- Name: module_context_versions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.module_context_versions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    workspace_id uuid NOT NULL,
    installation_id uuid NOT NULL,
    version integer NOT NULL,
    snapshot jsonb NOT NULL,
    applied_by text DEFAULT ''::text NOT NULL,
    applied_at timestamp with time zone DEFAULT now() NOT NULL
);

--
-- Name: module_installations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.module_installations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    workspace_id uuid NOT NULL,
    module_key text NOT NULL,
    agent_id uuid,
    status text DEFAULT 'installing'::text NOT NULL,
    operating_mode text DEFAULT 'assist'::text NOT NULL,
    live_enabled boolean DEFAULT false NOT NULL,
    active_context_version_id uuid,
    settings jsonb DEFAULT '{"processor": "openclaw"}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    name text NOT NULL,
    is_multi boolean DEFAULT false NOT NULL,
    CONSTRAINT module_installations_name_length CHECK (((char_length(name) >= 1) AND (char_length(name) <= 80))),
    CONSTRAINT module_installations_operating_mode_check CHECK ((operating_mode = ANY (ARRAY['assist'::text, 'autopilot'::text]))),
    CONSTRAINT module_installations_status_check CHECK ((status = ANY (ARRAY['installing'::text, 'setup'::text, 'ready'::text, 'live'::text, 'paused'::text])))
);

--
-- Name: module_setup_messages; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.module_setup_messages (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    workspace_id uuid NOT NULL,
    setup_session_id uuid NOT NULL,
    role text NOT NULL,
    author text DEFAULT ''::text NOT NULL,
    body text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT module_setup_messages_role_check CHECK ((role = ANY (ARRAY['user'::text, 'assistant'::text])))
);

--
-- Name: module_setup_sessions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.module_setup_sessions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    workspace_id uuid NOT NULL,
    installation_id uuid NOT NULL,
    revision integer DEFAULT 1 NOT NULL,
    status text DEFAULT 'draft'::text NOT NULL,
    draft_snapshot jsonb DEFAULT '{"facts": [], "summary": ""}'::jsonb NOT NULL,
    gate_evidence jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT module_setup_sessions_status_check CHECK ((status = ANY (ARRAY['draft'::text, 'applied'::text, 'discarded'::text])))
);

--
-- Name: module_setup_writes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.module_setup_writes (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    workspace_id uuid NOT NULL,
    setup_session_id uuid NOT NULL,
    source_message_id uuid,
    gate_key text NOT NULL,
    kind text NOT NULL,
    target_key text NOT NULL,
    payload jsonb NOT NULL,
    status text DEFAULT 'proposed'::text NOT NULL,
    result jsonb,
    decided_by text,
    decided_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT module_setup_writes_kind_check CHECK ((kind = ANY (ARRAY['fact'::text, 'rule'::text]))),
    CONSTRAINT module_setup_writes_status_check CHECK ((status = ANY (ARRAY['proposed'::text, 'applied'::text, 'rejected'::text, 'superseded'::text])))
);

--
-- Name: modules; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.modules (
    key text NOT NULL,
    sort_order integer DEFAULT 0 NOT NULL,
    status text DEFAULT 'early'::text NOT NULL,
    category text NOT NULL,
    audience text DEFAULT 'internal'::text NOT NULL,
    knowledge_folder text NOT NULL,
    workbench text,
    default_operating_mode text DEFAULT 'assist'::text NOT NULL,
    definition jsonb DEFAULT '{}'::jsonb NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    multi_instance boolean DEFAULT false NOT NULL,
    CONSTRAINT modules_audience_check CHECK ((audience = ANY (ARRAY['customer'::text, 'internal'::text]))),
    CONSTRAINT modules_default_operating_mode_check CHECK ((default_operating_mode = ANY (ARRAY['assist'::text, 'autopilot'::text]))),
    CONSTRAINT modules_key_format CHECK ((key ~ '^[a-z][a-z0-9_]{1,23}$'::text)),
    CONSTRAINT modules_status_check CHECK ((status = ANY (ARRAY['stable'::text, 'early'::text])))
);

--
-- Name: n8n_pipelines; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.n8n_pipelines (
    workspace_id uuid NOT NULL,
    template_key text NOT NULL,
    enabled boolean DEFAULT false NOT NULL,
    config jsonb DEFAULT '{}'::jsonb NOT NULL,
    updated_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);

--
-- Name: n8n_platform_config; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.n8n_platform_config (
    key text NOT NULL,
    value text NOT NULL
);

--
-- Name: n8n_runs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.n8n_runs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    workspace_id uuid NOT NULL,
    template_key text NOT NULL,
    dedupe_key text NOT NULL,
    token_hash text NOT NULL,
    expires_at timestamp with time zone NOT NULL,
    status text DEFAULT 'queued'::text NOT NULL,
    summary text,
    result jsonb,
    engine_job_id uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    finished_at timestamp with time zone,
    CONSTRAINT n8n_runs_status_check CHECK ((status = ANY (ARRAY['queued'::text, 'running'::text, 'done'::text, 'failed'::text, 'skipped'::text])))
);

--
-- Name: nivo_knowledge; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.nivo_knowledge (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    module text NOT NULL,
    slug text NOT NULL,
    title text NOT NULL,
    body text NOT NULL,
    kind text NOT NULL,
    version integer DEFAULT 1 NOT NULL,
    embedding extensions.vector(1536),
    fts tsvector GENERATED ALWAYS AS (to_tsvector('simple'::regconfig, public.knowledge_fold(((title || ' '::text) || body)))) STORED,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    embedding_model text,
    CONSTRAINT nivo_knowledge_embedding_model_check CHECK (((embedding IS NULL) OR (embedding_model IS NOT NULL))),
    CONSTRAINT nivo_knowledge_kind_check CHECK ((kind = ANY (ARRAY['playbook'::text, 'authority'::text, 'escalation'::text, 'setup_checklist'::text, 'tone'::text]))),
    CONSTRAINT nivo_knowledge_module_format CHECK (((module = 'core'::text) OR (module ~ '^[a-z][a-z0-9_]{1,23}$'::text)))
);

--
-- Name: office_command_candidates; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.office_command_candidates (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    workspace_id uuid NOT NULL,
    message_id uuid NOT NULL,
    module text NOT NULL,
    command text NOT NULL,
    payload jsonb DEFAULT '{}'::jsonb NOT NULL,
    summary text DEFAULT ''::text NOT NULL,
    shown jsonb DEFAULT '[]'::jsonb NOT NULL,
    status text DEFAULT 'pending'::text NOT NULL,
    work_item_id uuid,
    refusal_detail text,
    created_by text DEFAULT ''::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    decided_at timestamp with time zone,
    CONSTRAINT office_command_candidates_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'sent'::text, 'cancelled'::text])))
);

--
-- Name: openclaw_agent_sync; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.openclaw_agent_sync (
    installation_id uuid NOT NULL,
    workspace_id uuid NOT NULL,
    agent_id text NOT NULL,
    context_version integer,
    content_hash text,
    synced_at timestamp with time zone,
    checked_at timestamp with time zone DEFAULT now() NOT NULL,
    status text DEFAULT 'ok'::text NOT NULL,
    error text,
    files jsonb DEFAULT '[]'::jsonb NOT NULL,
    CONSTRAINT openclaw_agent_sync_status_check CHECK ((status = ANY (ARRAY['ok'::text, 'error'::text])))
);

--
-- Name: orders; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.orders (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    workspace_id uuid NOT NULL,
    lead_id uuid,
    inbound_event_id uuid,
    order_no text NOT NULL,
    items text DEFAULT ''::text NOT NULL,
    amount_vnd bigint,
    status text DEFAULT 'draft'::text NOT NULL,
    origin text DEFAULT 'live'::text NOT NULL,
    confirmed_by text,
    confirmed_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    shipped_at timestamp with time zone,
    carrier text,
    tracking_code text,
    CONSTRAINT orders_amount_vnd_check CHECK (((amount_vnd IS NULL) OR (amount_vnd >= 0))),
    CONSTRAINT orders_origin_check CHECK ((origin = ANY (ARRAY['live'::text, 'simulated'::text]))),
    CONSTRAINT orders_status_check CHECK ((status = ANY (ARRAY['draft'::text, 'confirmed'::text, 'invoiced'::text, 'paid'::text, 'cancelled'::text])))
);

--
-- Name: payment_order_requests; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.payment_order_requests (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    workspace_id uuid NOT NULL,
    requested_by uuid NOT NULL,
    kind text NOT NULL,
    target text,
    status text DEFAULT 'pending'::text NOT NULL,
    order_id uuid,
    fault text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    answered_at timestamp with time zone,
    cycle text,
    tier_credits bigint,
    seats integer,
    CONSTRAINT payment_order_requests_cycle_check CHECK (((cycle IS NULL) OR (cycle = ANY (ARRAY['monthly'::text, 'annual'::text])))),
    CONSTRAINT payment_order_requests_kind_check CHECK ((kind = ANY (ARRAY['plan'::text, 'renew'::text, 'topup'::text, 'upgrade'::text, 'credit_pack'::text]))),
    CONSTRAINT payment_order_requests_seats_check CHECK (((seats IS NULL) OR ((seats >= 1) AND (seats <= 1000)))),
    CONSTRAINT payment_order_requests_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'done'::text, 'failed'::text]))),
    CONSTRAINT payment_order_requests_target_check CHECK (((target IS NULL) OR (target ~ '^[a-z0-9_-]{1,40}$'::text))),
    CONSTRAINT payment_order_requests_tier_credits_check CHECK (((tier_credits IS NULL) OR (tier_credits > 0)))
);

--
-- Name: payment_orders; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.payment_orders (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    workspace_id uuid NOT NULL,
    created_by uuid,
    plan_code text NOT NULL,
    amount_vnd bigint NOT NULL,
    order_code text NOT NULL,
    status text DEFAULT 'pending'::text NOT NULL,
    expires_at timestamp with time zone DEFAULT (now() + '00:30:00'::interval) NOT NULL,
    paid_at timestamp with time zone,
    sepay_transaction_id bigint,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    kind text DEFAULT 'plan'::text NOT NULL,
    pack_code text,
    detail jsonb DEFAULT '{}'::jsonb NOT NULL,
    CONSTRAINT payment_orders_amount_vnd_check CHECK ((amount_vnd >= 0)),
    CONSTRAINT payment_orders_kind_check CHECK ((kind = ANY (ARRAY['plan'::text, 'upgrade'::text, 'topup'::text, 'credit_pack'::text]))),
    CONSTRAINT payment_orders_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'paid'::text, 'expired'::text, 'cancelled'::text])))
);

--
-- Name: plan_usage_tiers; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.plan_usage_tiers (
    plan_code text NOT NULL,
    credits_per_month bigint NOT NULL,
    price_vnd bigint NOT NULL,
    per_seat boolean DEFAULT false NOT NULL,
    sort integer DEFAULT 0 NOT NULL,
    CONSTRAINT plan_usage_tiers_credits_per_month_check CHECK ((credits_per_month > 0)),
    CONSTRAINT plan_usage_tiers_price_vnd_check CHECK ((price_vnd >= 0))
);

--
-- Name: plans; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.plans (
    code text NOT NULL,
    name_vi text NOT NULL,
    name_en text NOT NULL,
    price_vnd bigint NOT NULL,
    period text NOT NULL,
    seats integer NOT NULL,
    features jsonb DEFAULT '{"en": [], "vi": []}'::jsonb NOT NULL,
    sort integer DEFAULT 0 NOT NULL,
    active boolean DEFAULT true NOT NULL,
    ai_messages_per_month integer,
    ai_tokens_per_month bigint,
    ai_credits_per_month bigint,
    is_custom boolean DEFAULT false NOT NULL,
    credits_rollover boolean DEFAULT false NOT NULL,
    price_annual_vnd bigint,
    annual_discount_pct integer,
    promo_price_vnd bigint,
    promo_months integer,
    storage_gb integer,
    listed boolean DEFAULT true NOT NULL,
    individual boolean DEFAULT false NOT NULL,
    per_seat boolean DEFAULT false NOT NULL,
    CONSTRAINT plans_ai_credits_per_month_check CHECK (((ai_credits_per_month IS NULL) OR (ai_credits_per_month >= 0))),
    CONSTRAINT plans_ai_messages_per_month_check CHECK (((ai_messages_per_month IS NULL) OR (ai_messages_per_month >= 0))),
    CONSTRAINT plans_ai_tokens_per_month_check CHECK (((ai_tokens_per_month IS NULL) OR (ai_tokens_per_month >= 0))),
    CONSTRAINT plans_annual_discount_pct_check CHECK (((annual_discount_pct IS NULL) OR ((annual_discount_pct >= 0) AND (annual_discount_pct <= 90)))),
    CONSTRAINT plans_period_check CHECK ((period = ANY (ARRAY['month'::text, 'year'::text]))),
    CONSTRAINT plans_price_annual_vnd_check CHECK (((price_annual_vnd IS NULL) OR (price_annual_vnd >= 0))),
    CONSTRAINT plans_price_vnd_check CHECK ((price_vnd >= 0)),
    CONSTRAINT plans_promo_months_check CHECK (((promo_months IS NULL) OR (promo_months > 0))),
    CONSTRAINT plans_promo_price_vnd_check CHECK (((promo_price_vnd IS NULL) OR (promo_price_vnd >= 0))),
    CONSTRAINT plans_seats_check CHECK ((seats > 0)),
    CONSTRAINT plans_storage_gb_check CHECK (((storage_gb IS NULL) OR (storage_gb > 0)))
);

--
-- Name: platform_admins; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.platform_admins (
    email text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT platform_admins_email_check CHECK (((email = lower(btrim(email))) AND (email <> ''::text)))
);

--
-- Name: platform_audit; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.platform_audit (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    actor_email text NOT NULL,
    actor_id uuid,
    action text NOT NULL,
    workspace_id uuid,
    data jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

--
-- Name: platform_flags; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.platform_flags (
    key text NOT NULL,
    enabled boolean DEFAULT false NOT NULL
);

--
-- Name: public_api; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.public_api (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    workspace_id uuid NOT NULL,
    key_id uuid NOT NULL,
    kind text NOT NULL,
    dedupe_key text NOT NULL,
    payload jsonb NOT NULL,
    lead_id uuid,
    duplicates integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    processed_at timestamp with time zone,
    CONSTRAINT public_api_duplicates_check CHECK ((duplicates >= 0)),
    CONSTRAINT public_api_kind_check CHECK ((kind = ANY (ARRAY['lead'::text, 'message'::text, 'knowledge'::text])))
);

--
-- Name: queue; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.queue (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    queue character varying(200) NOT NULL,
    payload jsonb NOT NULL,
    created_at timestamp with time zone NOT NULL,
    sent_at timestamp with time zone
);

--
-- Name: sepay_transactions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.sepay_transactions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    sepay_id bigint NOT NULL,
    payload jsonb NOT NULL,
    transfer_amount bigint,
    content text,
    status text DEFAULT 'received'::text NOT NULL,
    matched_order_id uuid,
    received_at timestamp with time zone DEFAULT now() NOT NULL,
    processed_at timestamp with time zone,
    CONSTRAINT sepay_transactions_status_check CHECK ((status = ANY (ARRAY['received'::text, 'paid'::text, 'underpaid'::text, 'expired'::text, 'unmatched'::text, 'ignored'::text])))
);

--
-- Name: shifts_attendance; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.shifts_attendance (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    workspace_id uuid NOT NULL,
    shift_id uuid NOT NULL,
    staff_id uuid NOT NULL,
    checked_in_at timestamp with time zone DEFAULT now() NOT NULL
);

--
-- Name: shifts_availability; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.shifts_availability (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    workspace_id uuid NOT NULL,
    staff_id uuid NOT NULL,
    weekday smallint,
    shift_date date,
    start_time time without time zone DEFAULT '00:00:00'::time without time zone NOT NULL,
    end_time time without time zone DEFAULT '23:59:00'::time without time zone NOT NULL,
    available boolean DEFAULT true NOT NULL,
    note text DEFAULT ''::text NOT NULL,
    status text DEFAULT 'approved'::text NOT NULL,
    decided_by text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT shifts_availability_check CHECK (((weekday IS NOT NULL) <> (shift_date IS NOT NULL))),
    CONSTRAINT shifts_availability_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'approved'::text, 'declined'::text]))),
    CONSTRAINT shifts_availability_weekday_check CHECK (((weekday >= 0) AND (weekday <= 6)))
);

--
-- Name: shifts_coverage; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.shifts_coverage (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    workspace_id uuid NOT NULL,
    weekday smallint NOT NULL,
    start_time time without time zone NOT NULL,
    end_time time without time zone NOT NULL,
    position_id uuid NOT NULL,
    min_staff integer DEFAULT 1 NOT NULL,
    ideal_staff integer DEFAULT 1 NOT NULL,
    is_peak boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT shifts_coverage_check CHECK (((end_time > start_time) AND (ideal_staff >= min_staff))),
    CONSTRAINT shifts_coverage_ideal_staff_check CHECK (((ideal_staff >= 0) AND (ideal_staff <= 50))),
    CONSTRAINT shifts_coverage_min_staff_check CHECK (((min_staff >= 0) AND (min_staff <= 50))),
    CONSTRAINT shifts_coverage_weekday_check CHECK (((weekday >= 0) AND (weekday <= 6)))
);

--
-- Name: shifts_leave_requests; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.shifts_leave_requests (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    workspace_id uuid NOT NULL,
    staff_id uuid NOT NULL,
    from_date date NOT NULL,
    to_date date NOT NULL,
    reason text DEFAULT ''::text NOT NULL,
    status text DEFAULT 'pending'::text NOT NULL,
    work_item_id uuid,
    decided_by text,
    decided_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT shifts_leave_requests_check CHECK ((to_date >= from_date)),
    CONSTRAINT shifts_leave_requests_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'approved'::text, 'declined'::text])))
);

--
-- Name: shifts_notifications; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.shifts_notifications (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    workspace_id uuid NOT NULL,
    staff_id uuid,
    schedule_id uuid,
    shift_id uuid,
    kind text NOT NULL,
    channel text NOT NULL,
    status text DEFAULT 'sent'::text NOT NULL,
    body text DEFAULT ''::text NOT NULL,
    error text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT shifts_notifications_channel_check CHECK ((channel = ANY (ARRAY['office'::text, 'telegram'::text, 'zalo'::text]))),
    CONSTRAINT shifts_notifications_kind_check CHECK ((kind = ANY (ARRAY['publish'::text, 'reminder'::text, 'swap'::text, 'leave'::text, 'no_show'::text, 'gap'::text, 'payroll'::text]))),
    CONSTRAINT shifts_notifications_status_check CHECK ((status = ANY (ARRAY['sent'::text, 'failed'::text, 'skipped'::text])))
);

--
-- Name: shifts_positions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.shifts_positions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    workspace_id uuid NOT NULL,
    name text NOT NULL,
    color text DEFAULT '#2f6fed'::text NOT NULL,
    sort_order integer DEFAULT 0 NOT NULL,
    active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT shifts_positions_name_check CHECK (((length(btrim(name)) >= 1) AND (length(btrim(name)) <= 60)))
);

--
-- Name: shifts_schedules; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.shifts_schedules (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    workspace_id uuid NOT NULL,
    week_start date NOT NULL,
    version integer DEFAULT 1 NOT NULL,
    status text DEFAULT 'draft'::text NOT NULL,
    source text DEFAULT 'solver'::text NOT NULL,
    cost_vnd bigint DEFAULT 0 NOT NULL,
    summary jsonb DEFAULT '{}'::jsonb NOT NULL,
    evidence jsonb DEFAULT '{}'::jsonb NOT NULL,
    explanation text DEFAULT ''::text NOT NULL,
    solver_ms integer,
    work_item_id uuid,
    created_by text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    published_at timestamp with time zone,
    CONSTRAINT shifts_schedules_source_check CHECK ((source = ANY (ARRAY['solver'::text, 'manual'::text]))),
    CONSTRAINT shifts_schedules_status_check CHECK ((status = ANY (ARRAY['draft'::text, 'published'::text, 'superseded'::text])))
);

--
-- Name: shifts_settings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.shifts_settings (
    workspace_id uuid NOT NULL,
    opening_hours jsonb DEFAULT '{}'::jsonb NOT NULL,
    swap_notice_hours integer DEFAULT 24 NOT NULL,
    leave_notice_days integer DEFAULT 2 NOT NULL,
    remind_minutes integer DEFAULT 60 NOT NULL,
    noshow_minutes integer DEFAULT 10 NOT NULL,
    overtime_hours_week numeric(4,1) DEFAULT 48 NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT shifts_settings_leave_notice_days_check CHECK ((leave_notice_days >= 0)),
    CONSTRAINT shifts_settings_noshow_minutes_check CHECK (((noshow_minutes >= 1) AND (noshow_minutes <= 120))),
    CONSTRAINT shifts_settings_remind_minutes_check CHECK (((remind_minutes >= 5) AND (remind_minutes <= 1440))),
    CONSTRAINT shifts_settings_swap_notice_hours_check CHECK ((swap_notice_hours >= 0))
);

--
-- Name: shifts_shifts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.shifts_shifts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    workspace_id uuid NOT NULL,
    schedule_id uuid NOT NULL,
    shift_date date NOT NULL,
    start_time time without time zone NOT NULL,
    end_time time without time zone NOT NULL,
    position_id uuid NOT NULL,
    staff_id uuid,
    status text DEFAULT 'draft'::text NOT NULL,
    source text DEFAULT 'solver'::text NOT NULL,
    note text DEFAULT ''::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT shifts_shifts_check CHECK ((end_time > start_time)),
    CONSTRAINT shifts_shifts_source_check CHECK ((source = ANY (ARRAY['solver'::text, 'manual'::text, 'swap'::text]))),
    CONSTRAINT shifts_shifts_status_check CHECK ((status = ANY (ARRAY['draft'::text, 'published'::text, 'swapped'::text, 'cancelled'::text])))
);

--
-- Name: shifts_staff; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.shifts_staff (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    workspace_id uuid NOT NULL,
    name text NOT NULL,
    staff_id uuid,
    user_id uuid,
    phone text,
    telegram_chat_id text,
    zalo_user_id text,
    position_ids uuid[] DEFAULT '{}'::uuid[] NOT NULL,
    skills text[] DEFAULT '{}'::text[] NOT NULL,
    max_hours_week numeric(5,1) DEFAULT 48 NOT NULL,
    max_hours_day numeric(4,1) DEFAULT 10 NOT NULL,
    min_rest_hours numeric(4,1) DEFAULT 10 NOT NULL,
    active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT shifts_staff_max_hours_day_check CHECK (((max_hours_day > (0)::numeric) AND (max_hours_day <= (24)::numeric))),
    CONSTRAINT shifts_staff_max_hours_week_check CHECK (((max_hours_week > (0)::numeric) AND (max_hours_week <= (120)::numeric))),
    CONSTRAINT shifts_staff_min_rest_hours_check CHECK (((min_rest_hours >= (0)::numeric) AND (min_rest_hours <= (24)::numeric))),
    CONSTRAINT shifts_staff_name_check CHECK (((length(btrim(name)) >= 1) AND (length(btrim(name)) <= 80)))
);

--
-- Name: shifts_staff_pay; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.shifts_staff_pay (
    staff_id uuid NOT NULL,
    workspace_id uuid NOT NULL,
    hourly_wage_vnd integer DEFAULT 0 NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT shifts_staff_pay_hourly_wage_vnd_check CHECK ((hourly_wage_vnd >= 0))
);

--
-- Name: shifts_swap_requests; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.shifts_swap_requests (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    workspace_id uuid NOT NULL,
    kind text DEFAULT 'swap'::text NOT NULL,
    shift_id uuid NOT NULL,
    from_staff_id uuid,
    to_staff_id uuid NOT NULL,
    reason text DEFAULT ''::text NOT NULL,
    status text DEFAULT 'pending'::text NOT NULL,
    checks jsonb DEFAULT '[]'::jsonb NOT NULL,
    work_item_id uuid,
    decided_by text,
    decided_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT shifts_swap_requests_kind_check CHECK ((kind = ANY (ARRAY['swap'::text, 'claim'::text]))),
    CONSTRAINT shifts_swap_requests_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'approved'::text, 'declined'::text])))
);

--
-- Name: staff; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.staff (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    workspace_id uuid NOT NULL,
    name text NOT NULL,
    role text DEFAULT ''::text NOT NULL,
    email text,
    active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

--
-- Name: telegram_inbox; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.telegram_inbox (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    provider text NOT NULL,
    delivery_id text NOT NULL,
    received_at timestamp with time zone DEFAULT now() NOT NULL,
    payload jsonb NOT NULL,
    processed_at timestamp with time zone,
    CONSTRAINT telegram_inbox_provider_check CHECK ((provider = 'telegram'::text))
);

--
-- Name: transactions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.transactions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    workspace_id uuid NOT NULL,
    inbound_event_id uuid,
    channel text DEFAULT 'bank'::text NOT NULL,
    amount_vnd bigint NOT NULL,
    reference text,
    payer text,
    occurred_at timestamp with time zone DEFAULT now() NOT NULL,
    invoice_id uuid,
    status text DEFAULT 'unmatched'::text NOT NULL,
    origin text DEFAULT 'live'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT transactions_amount_vnd_check CHECK ((amount_vnd >= 0)),
    CONSTRAINT transactions_channel_check CHECK ((channel = ANY (ARRAY['bank'::text, 'cash'::text, 'card'::text, 'ewallet'::text]))),
    CONSTRAINT transactions_origin_check CHECK ((origin = ANY (ARRAY['live'::text, 'simulated'::text]))),
    CONSTRAINT transactions_status_check CHECK ((status = ANY (ARRAY['unmatched'::text, 'matched'::text, 'needs_review'::text])))
);

--
-- Name: video_brand_kits; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.video_brand_kits (
    workspace_id uuid NOT NULL,
    shop_name text DEFAULT ''::text NOT NULL,
    primary_color text DEFAULT '#16a34a'::text NOT NULL,
    secondary_color text DEFAULT '#0f172a'::text NOT NULL,
    logo_path text,
    music_track text,
    voice text DEFAULT 'vi-VN-HoaiMyNeural'::text NOT NULL,
    updated_by uuid,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT video_brand_kits_primary_color_check CHECK ((primary_color ~ '^#[0-9a-f]{6}$'::text)),
    CONSTRAINT video_brand_kits_secondary_color_check CHECK ((secondary_color ~ '^#[0-9a-f]{6}$'::text)),
    CONSTRAINT video_brand_kits_shop_name_check CHECK ((char_length(shop_name) <= 60))
);

--
-- Name: video_project_versions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.video_project_versions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    project_id uuid NOT NULL,
    workspace_id uuid NOT NULL,
    version integer NOT NULL,
    script jsonb NOT NULL,
    spec jsonb,
    render_id uuid,
    note text,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

--
-- Name: video_projects; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.video_projects (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    workspace_id uuid NOT NULL,
    title text NOT NULL,
    goal text DEFAULT 'service'::text NOT NULL,
    aspect text DEFAULT '9:16'::text NOT NULL,
    target_seconds integer DEFAULT 30 NOT NULL,
    status text DEFAULT 'draft'::text NOT NULL,
    inputs jsonb DEFAULT '{}'::jsonb NOT NULL,
    script jsonb DEFAULT '[]'::jsonb NOT NULL,
    current_spec jsonb,
    render_id uuid,
    render_ids uuid[] DEFAULT '{}'::uuid[] NOT NULL,
    version integer DEFAULT 1 NOT NULL,
    script_ms integer,
    script_meta jsonb DEFAULT '{}'::jsonb NOT NULL,
    last_error text,
    source_project_id uuid,
    approved_by_name text,
    approved_at timestamp with time zone,
    publish_work_item_id uuid,
    published_at timestamp with time zone,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT video_projects_aspect_check CHECK ((aspect = ANY (ARRAY['9:16'::text, '1:1'::text, '16:9'::text]))),
    CONSTRAINT video_projects_goal_check CHECK ((goal = ANY (ARRAY['service'::text, 'offer'::text, 'testimonial'::text, 'behind_scenes'::text, 'hiring'::text, 'custom'::text]))),
    CONSTRAINT video_projects_status_check CHECK ((status = ANY (ARRAY['draft'::text, 'scripting'::text, 'rendering'::text, 'ready'::text, 'approved'::text, 'published'::text, 'archived'::text]))),
    CONSTRAINT video_projects_target_seconds_check CHECK (((target_seconds >= 10) AND (target_seconds <= 90))),
    CONSTRAINT video_projects_title_check CHECK (((char_length(title) >= 1) AND (char_length(title) <= 120)))
);

--
-- Name: video_renders; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.video_renders (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    workspace_id uuid NOT NULL,
    spec jsonb NOT NULL,
    status text DEFAULT 'queued'::text NOT NULL,
    progress integer DEFAULT 0 NOT NULL,
    stage text,
    output_path text,
    poster_path text,
    duration_ms integer,
    size_bytes bigint,
    error text,
    meta jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    started_at timestamp with time zone,
    finished_at timestamp with time zone,
    CONSTRAINT video_renders_progress_check CHECK (((progress >= 0) AND (progress <= 100))),
    CONSTRAINT video_renders_status_check CHECK ((status = ANY (ARRAY['queued'::text, 'rendering'::text, 'done'::text, 'failed'::text])))
);

--
-- Name: work_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.work_items (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    workspace_id uuid NOT NULL,
    department text NOT NULL,
    action text NOT NULL,
    subject_type text NOT NULL,
    subject_id uuid,
    lead_id uuid,
    inbound_event_id uuid,
    parent_id uuid,
    dedupe_key text NOT NULL,
    status text DEFAULT 'queued'::text NOT NULL,
    decided_path text,
    reason text,
    reasons text[] DEFAULT '{}'::text[] NOT NULL,
    missing_fields text[] DEFAULT '{}'::text[] NOT NULL,
    proposal jsonb DEFAULT '{}'::jsonb NOT NULL,
    result jsonb,
    error text,
    evidence_state text DEFAULT 'pending'::text NOT NULL,
    assigned_staff_id uuid,
    execution_id uuid,
    origin text DEFAULT 'live'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    completed_at timestamp with time zone,
    chain_id uuid,
    depth integer DEFAULT 0 NOT NULL,
    installation_id uuid,
    CONSTRAINT work_items_decided_path_check CHECK ((decided_path = ANY (ARRAY['auto'::text, 'human'::text]))),
    CONSTRAINT work_items_depth_check CHECK ((depth >= 0)),
    CONSTRAINT work_items_evidence_state_check CHECK ((evidence_state = ANY (ARRAY['pending'::text, 'captured'::text, 'reviewed'::text, 'verified'::text, 'customer_confirmed'::text]))),
    CONSTRAINT work_items_origin_check CHECK ((origin = ANY (ARRAY['live'::text, 'simulated'::text]))),
    CONSTRAINT work_items_reason_check CHECK ((reason = ANY (ARRAY['routine'::text, 'missing_data'::text, 'over_authority'::text, 'unclear_outcome'::text, 'not_allowed'::text]))),
    CONSTRAINT work_items_status_check CHECK ((status = ANY (ARRAY['queued'::text, 'done'::text, 'waiting_decision'::text, 'rejected'::text, 'failed'::text])))
);

--
-- Name: workspace_invites; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.workspace_invites (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    workspace_id uuid NOT NULL,
    email text NOT NULL,
    role text NOT NULL,
    staff_id uuid,
    token_hash text NOT NULL,
    invited_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    expires_at timestamp with time zone DEFAULT (now() + '7 days'::interval) NOT NULL,
    accepted_at timestamp with time zone,
    accepted_by uuid,
    revoked_at timestamp with time zone,
    CONSTRAINT workspace_invites_role_check CHECK ((role = ANY (ARRAY['manager'::text, 'staff'::text])))
);

--
-- Name: workspace_members; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.workspace_members (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    workspace_id uuid NOT NULL,
    user_id uuid NOT NULL,
    role text NOT NULL,
    staff_id uuid,
    display_name text NOT NULL,
    status text DEFAULT 'active'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT workspace_members_role_check CHECK ((role = ANY (ARRAY['owner'::text, 'manager'::text, 'staff'::text]))),
    CONSTRAINT workspace_members_status_check CHECK ((status = ANY (ARRAY['active'::text, 'disabled'::text])))
);

--
-- Name: workspaces; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.workspaces (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    owner_id uuid NOT NULL,
    name text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    status text DEFAULT 'active'::text NOT NULL,
    plan_code text,
    paid_until timestamp with time zone,
    business_type text,
    tier_credits bigint,
    seat_count integer,
    billing_cycle text,
    billed_monthly_vnd bigint,
    CONSTRAINT workspaces_billed_monthly_vnd_check CHECK (((billed_monthly_vnd IS NULL) OR (billed_monthly_vnd >= 0))),
    CONSTRAINT workspaces_billing_cycle_check CHECK (((billing_cycle IS NULL) OR (billing_cycle = ANY (ARRAY['monthly'::text, 'annual'::text])))),
    CONSTRAINT workspaces_seat_count_check CHECK (((seat_count IS NULL) OR (seat_count > 0))),
    CONSTRAINT workspaces_status_check CHECK ((status = ANY (ARRAY['pending_payment'::text, 'active'::text, 'past_due'::text, 'cancelled'::text]))),
    CONSTRAINT workspaces_tier_credits_check CHECK (((tier_credits IS NULL) OR (tier_credits > 0)))
);

--
-- Name: zalo_inbox; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.zalo_inbox (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    provider text NOT NULL,
    delivery_id text NOT NULL,
    received_at timestamp with time zone DEFAULT now() NOT NULL,
    payload jsonb NOT NULL,
    processed_at timestamp with time zone,
    CONSTRAINT zalo_inbox_provider_check CHECK ((provider = 'zalo'::text))
);

--
-- Name: zalo_wizard_drafts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.zalo_wizard_drafts (
    connection_id uuid NOT NULL,
    app_id text,
    app_secret text,
    oa_secret text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

--
-- Name: accounting_adjustments accounting_adjustments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.accounting_adjustments
    ADD CONSTRAINT accounting_adjustments_pkey PRIMARY KEY (id);

--
-- Name: agent_access_log agent_access_log_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.agent_access_log
    ADD CONSTRAINT agent_access_log_pkey PRIMARY KEY (id);

--
-- Name: agent_connections agent_connections_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.agent_connections
    ADD CONSTRAINT agent_connections_pkey PRIMARY KEY (agent_id, connection_id);

--
-- Name: agent_conversations agent_conversations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.agent_conversations
    ADD CONSTRAINT agent_conversations_pkey PRIMARY KEY (id);

--
-- Name: agent_messages agent_messages_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.agent_messages
    ADD CONSTRAINT agent_messages_pkey PRIMARY KEY (id);

--
-- Name: agents agents_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.agents
    ADD CONSTRAINT agents_pkey PRIMARY KEY (id);

--
-- Name: agents agents_workspace_id_handle_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.agents
    ADD CONSTRAINT agents_workspace_id_handle_key UNIQUE (workspace_id, handle);

--
-- Name: ai_generations ai_generations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_generations
    ADD CONSTRAINT ai_generations_pkey PRIMARY KEY (id);

--
-- Name: ai_quota_overrides ai_quota_overrides_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_quota_overrides
    ADD CONSTRAINT ai_quota_overrides_pkey PRIMARY KEY (workspace_id);

--
-- Name: ai_usage_events ai_usage_events_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_usage_events
    ADD CONSTRAINT ai_usage_events_pkey PRIMARY KEY (id);

--
-- Name: ai_usage_notices ai_usage_notices_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_usage_notices
    ADD CONSTRAINT ai_usage_notices_pkey PRIMARY KEY (workspace_id, period, level);

--
-- Name: api_keys api_keys_key_hash_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.api_keys
    ADD CONSTRAINT api_keys_key_hash_key UNIQUE (key_hash);

--
-- Name: api_keys api_keys_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.api_keys
    ADD CONSTRAINT api_keys_pkey PRIMARY KEY (id);

--
-- Name: api_rate_limits api_rate_limits_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.api_rate_limits
    ADD CONSTRAINT api_rate_limits_pkey PRIMARY KEY (key_id, window_start);

--
-- Name: app_commands app_commands_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.app_commands
    ADD CONSTRAINT app_commands_pkey PRIMARY KEY (id);

--
-- Name: app_errors app_errors_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.app_errors
    ADD CONSTRAINT app_errors_pkey PRIMARY KEY (id);

--
-- Name: authority_actions authority_actions_module_key_action_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.authority_actions
    ADD CONSTRAINT authority_actions_module_key_action_key UNIQUE (module_key, action);

--
-- Name: authority_actions authority_actions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.authority_actions
    ADD CONSTRAINT authority_actions_pkey PRIMARY KEY (action);

--
-- Name: authority authority_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.authority
    ADD CONSTRAINT authority_pkey PRIMARY KEY (workspace_id);

--
-- Name: authority_rules authority_rules_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.authority_rules
    ADD CONSTRAINT authority_rules_pkey PRIMARY KEY (id);

--
-- Name: authority_rules authority_rules_workspace_id_department_action_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.authority_rules
    ADD CONSTRAINT authority_rules_workspace_id_department_action_key UNIQUE (workspace_id, department, action);

--
-- Name: automation_commands automation_commands_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.automation_commands
    ADD CONSTRAINT automation_commands_pkey PRIMARY KEY (id);

--
-- Name: automation_pipelines automation_pipelines_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.automation_pipelines
    ADD CONSTRAINT automation_pipelines_pkey PRIMARY KEY (id);

--
-- Name: automation_pipelines automation_pipelines_workspace_id_template_key_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.automation_pipelines
    ADD CONSTRAINT automation_pipelines_workspace_id_template_key_key UNIQUE (workspace_id, template_key);

--
-- Name: automation_runs automation_runs_pipeline_id_dedupe_key_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.automation_runs
    ADD CONSTRAINT automation_runs_pipeline_id_dedupe_key_key UNIQUE (pipeline_id, dedupe_key);

--
-- Name: automation_runs automation_runs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.automation_runs
    ADD CONSTRAINT automation_runs_pkey PRIMARY KEY (id);

--
-- Name: automation_templates automation_templates_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.automation_templates
    ADD CONSTRAINT automation_templates_pkey PRIMARY KEY (key);

--
-- Name: billing_config billing_config_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.billing_config
    ADD CONSTRAINT billing_config_pkey PRIMARY KEY (key);

--
-- Name: billing_events billing_events_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.billing_events
    ADD CONSTRAINT billing_events_pkey PRIMARY KEY (id);

--
-- Name: booking_exceptions booking_exceptions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.booking_exceptions
    ADD CONSTRAINT booking_exceptions_pkey PRIMARY KEY (id);

--
-- Name: booking_hours booking_hours_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.booking_hours
    ADD CONSTRAINT booking_hours_pkey PRIMARY KEY (id);

--
-- Name: booking_rate booking_rate_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.booking_rate
    ADD CONSTRAINT booking_rate_pkey PRIMARY KEY (key, window_start);

--
-- Name: booking_reminders booking_reminders_booking_id_kind_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.booking_reminders
    ADD CONSTRAINT booking_reminders_booking_id_kind_key UNIQUE (booking_id, kind);

--
-- Name: booking_reminders booking_reminders_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.booking_reminders
    ADD CONSTRAINT booking_reminders_pkey PRIMARY KEY (id);

--
-- Name: booking_resources booking_resources_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.booking_resources
    ADD CONSTRAINT booking_resources_pkey PRIMARY KEY (id);

--
-- Name: booking_services booking_services_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.booking_services
    ADD CONSTRAINT booking_services_pkey PRIMARY KEY (id);

--
-- Name: booking_settings booking_settings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.booking_settings
    ADD CONSTRAINT booking_settings_pkey PRIMARY KEY (workspace_id);

--
-- Name: booking_settings booking_settings_public_slug_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.booking_settings
    ADD CONSTRAINT booking_settings_public_slug_key UNIQUE (public_slug);

--
-- Name: booking_waitlist booking_waitlist_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.booking_waitlist
    ADD CONSTRAINT booking_waitlist_pkey PRIMARY KEY (id);

--
-- Name: bookings bookings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bookings
    ADD CONSTRAINT bookings_pkey PRIMARY KEY (id);

--
-- Name: brain_commands brain_commands_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.brain_commands
    ADD CONSTRAINT brain_commands_pkey PRIMARY KEY (id);

--
-- Name: brain_eval_cases brain_eval_cases_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.brain_eval_cases
    ADD CONSTRAINT brain_eval_cases_pkey PRIMARY KEY (id);

--
-- Name: brain_extractions brain_extractions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.brain_extractions
    ADD CONSTRAINT brain_extractions_pkey PRIMARY KEY (source_id);

--
-- Name: brain_facts brain_facts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.brain_facts
    ADD CONSTRAINT brain_facts_pkey PRIMARY KEY (id);

--
-- Name: brain_lessons brain_lessons_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.brain_lessons
    ADD CONSTRAINT brain_lessons_pkey PRIMARY KEY (id);

--
-- Name: brain_source_profiles brain_source_profiles_connection_id_entity_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.brain_source_profiles
    ADD CONSTRAINT brain_source_profiles_connection_id_entity_key UNIQUE (connection_id, entity);

--
-- Name: brain_source_profiles brain_source_profiles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.brain_source_profiles
    ADD CONSTRAINT brain_source_profiles_pkey PRIMARY KEY (id);

--
-- Name: channel_receipts channel_receipts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.channel_receipts
    ADD CONSTRAINT channel_receipts_pkey PRIMARY KEY (workspace_id, channel, receipt_id);

--
-- Name: connection_commands connection_commands_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.connection_commands
    ADD CONSTRAINT connection_commands_pkey PRIMARY KEY (id);

--
-- Name: connection_secrets connection_secrets_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.connection_secrets
    ADD CONSTRAINT connection_secrets_pkey PRIMARY KEY (connection_id);

--
-- Name: connections connections_id_workspace_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.connections
    ADD CONSTRAINT connections_id_workspace_id_key UNIQUE (id, workspace_id);

--
-- Name: connections connections_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.connections
    ADD CONSTRAINT connections_pkey PRIMARY KEY (id);

--
-- Name: connector_interest connector_interest_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.connector_interest
    ADD CONSTRAINT connector_interest_pkey PRIMARY KEY (workspace_id, connector_id);

--
-- Name: content_cadence content_cadence_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.content_cadence
    ADD CONSTRAINT content_cadence_pkey PRIMARY KEY (id);

--
-- Name: content_cadence content_cadence_workspace_id_channel_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.content_cadence
    ADD CONSTRAINT content_cadence_workspace_id_channel_key UNIQUE (workspace_id, channel);

--
-- Name: content_items content_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.content_items
    ADD CONSTRAINT content_items_pkey PRIMARY KEY (id);

--
-- Name: content_pillars content_pillars_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.content_pillars
    ADD CONSTRAINT content_pillars_pkey PRIMARY KEY (id);

--
-- Name: content_pillars content_pillars_workspace_id_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.content_pillars
    ADD CONSTRAINT content_pillars_workspace_id_name_key UNIQUE (workspace_id, name);

--
-- Name: content_plans content_plans_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.content_plans
    ADD CONSTRAINT content_plans_pkey PRIMARY KEY (id);

--
-- Name: content_settings content_settings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.content_settings
    ADD CONSTRAINT content_settings_pkey PRIMARY KEY (workspace_id);

--
-- Name: contracts contracts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contracts
    ADD CONSTRAINT contracts_pkey PRIMARY KEY (id);

--
-- Name: credit_pack_purchases credit_pack_purchases_order_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.credit_pack_purchases
    ADD CONSTRAINT credit_pack_purchases_order_id_key UNIQUE (order_id);

--
-- Name: credit_pack_purchases credit_pack_purchases_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.credit_pack_purchases
    ADD CONSTRAINT credit_pack_purchases_pkey PRIMARY KEY (id);

--
-- Name: credit_packs credit_packs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.credit_packs
    ADD CONSTRAINT credit_packs_pkey PRIMARY KEY (code);

--
-- Name: credit_topup_draws credit_topup_draws_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.credit_topup_draws
    ADD CONSTRAINT credit_topup_draws_pkey PRIMARY KEY (workspace_id, period);

--
-- Name: credit_topups credit_topups_order_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.credit_topups
    ADD CONSTRAINT credit_topups_order_id_key UNIQUE (order_id);

--
-- Name: credit_topups credit_topups_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.credit_topups
    ADD CONSTRAINT credit_topups_pkey PRIMARY KEY (id);

--
-- Name: data_records data_records_connection_id_entity_external_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.data_records
    ADD CONSTRAINT data_records_connection_id_entity_external_id_key UNIQUE (connection_id, entity, external_id);

--
-- Name: data_records data_records_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.data_records
    ADD CONSTRAINT data_records_pkey PRIMARY KEY (id);

--
-- Name: data_sync_runs data_sync_runs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.data_sync_runs
    ADD CONSTRAINT data_sync_runs_pkey PRIMARY KEY (id);

--
-- Name: decisions decisions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.decisions
    ADD CONSTRAINT decisions_pkey PRIMARY KEY (id);

--
-- Name: email_messages email_messages_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.email_messages
    ADD CONSTRAINT email_messages_pkey PRIMARY KEY (id);

--
-- Name: events events_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.events
    ADD CONSTRAINT events_pkey PRIMARY KEY (id);

--
-- Name: executions executions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.executions
    ADD CONSTRAINT executions_pkey PRIMARY KEY (id);

--
-- Name: hiring_apply_hits hiring_apply_hits_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hiring_apply_hits
    ADD CONSTRAINT hiring_apply_hits_pkey PRIMARY KEY (id);

--
-- Name: hiring_availability hiring_availability_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hiring_availability
    ADD CONSTRAINT hiring_availability_pkey PRIMARY KEY (id);

--
-- Name: hiring_candidates hiring_candidates_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hiring_candidates
    ADD CONSTRAINT hiring_candidates_pkey PRIMARY KEY (id);

--
-- Name: hiring_consents hiring_consents_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hiring_consents
    ADD CONSTRAINT hiring_consents_pkey PRIMARY KEY (id);

--
-- Name: hiring_events hiring_events_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hiring_events
    ADD CONSTRAINT hiring_events_pkey PRIMARY KEY (id);

--
-- Name: hiring_interviews hiring_interviews_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hiring_interviews
    ADD CONSTRAINT hiring_interviews_pkey PRIMARY KEY (id);

--
-- Name: hiring_interviews hiring_interviews_token_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hiring_interviews
    ADD CONSTRAINT hiring_interviews_token_key UNIQUE (token);

--
-- Name: hiring_jobs hiring_jobs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hiring_jobs
    ADD CONSTRAINT hiring_jobs_pkey PRIMARY KEY (id);

--
-- Name: hiring_jobs hiring_jobs_workspace_id_slug_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hiring_jobs
    ADD CONSTRAINT hiring_jobs_workspace_id_slug_key UNIQUE (workspace_id, slug);

--
-- Name: hiring_offers hiring_offers_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hiring_offers
    ADD CONSTRAINT hiring_offers_pkey PRIMARY KEY (id);

--
-- Name: hiring_offers hiring_offers_token_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hiring_offers
    ADD CONSTRAINT hiring_offers_token_key UNIQUE (token);

--
-- Name: hiring_onboarding hiring_onboarding_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hiring_onboarding
    ADD CONSTRAINT hiring_onboarding_pkey PRIMARY KEY (id);

--
-- Name: hiring_retention_log hiring_retention_log_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hiring_retention_log
    ADD CONSTRAINT hiring_retention_log_pkey PRIMARY KEY (id);

--
-- Name: hiring_settings hiring_settings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hiring_settings
    ADD CONSTRAINT hiring_settings_pkey PRIMARY KEY (workspace_id);

--
-- Name: hiring_settings hiring_settings_public_slug_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hiring_settings
    ADD CONSTRAINT hiring_settings_public_slug_key UNIQUE (public_slug);

--
-- Name: inbound_events inbound_events_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inbound_events
    ADD CONSTRAINT inbound_events_pkey PRIMARY KEY (id);

--
-- Name: inbound_events inbound_events_workspace_id_dedupe_key_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inbound_events
    ADD CONSTRAINT inbound_events_workspace_id_dedupe_key_key UNIQUE (workspace_id, dedupe_key);

--
-- Name: inventory_items inventory_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_items
    ADD CONSTRAINT inventory_items_pkey PRIMARY KEY (id);

--
-- Name: inventory_items inventory_items_workspace_id_sku_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_items
    ADD CONSTRAINT inventory_items_workspace_id_sku_key UNIQUE (workspace_id, sku);

--
-- Name: inventory_locations inventory_locations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_locations
    ADD CONSTRAINT inventory_locations_pkey PRIMARY KEY (id);

--
-- Name: inventory_movements inventory_movements_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_movements
    ADD CONSTRAINT inventory_movements_pkey PRIMARY KEY (id);

--
-- Name: inventory_po_lines inventory_po_lines_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_po_lines
    ADD CONSTRAINT inventory_po_lines_pkey PRIMARY KEY (id);

--
-- Name: inventory_purchase_orders inventory_purchase_orders_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_purchase_orders
    ADD CONSTRAINT inventory_purchase_orders_pkey PRIMARY KEY (id);

--
-- Name: inventory_purchase_orders inventory_purchase_orders_workspace_id_po_no_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_purchase_orders
    ADD CONSTRAINT inventory_purchase_orders_workspace_id_po_no_key UNIQUE (workspace_id, po_no);

--
-- Name: inventory_receipts inventory_receipts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_receipts
    ADD CONSTRAINT inventory_receipts_pkey PRIMARY KEY (id);

--
-- Name: inventory_recipe_lines inventory_recipe_lines_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_recipe_lines
    ADD CONSTRAINT inventory_recipe_lines_pkey PRIMARY KEY (id);

--
-- Name: inventory_recipes inventory_recipes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_recipes
    ADD CONSTRAINT inventory_recipes_pkey PRIMARY KEY (id);

--
-- Name: inventory_stock_levels inventory_stock_levels_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_stock_levels
    ADD CONSTRAINT inventory_stock_levels_pkey PRIMARY KEY (item_id, location_id);

--
-- Name: inventory_suppliers inventory_suppliers_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_suppliers
    ADD CONSTRAINT inventory_suppliers_pkey PRIMARY KEY (id);

--
-- Name: invoices invoices_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.invoices
    ADD CONSTRAINT invoices_pkey PRIMARY KEY (id);

--
-- Name: invoices invoices_workspace_id_invoice_no_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.invoices
    ADD CONSTRAINT invoices_workspace_id_invoice_no_key UNIQUE (workspace_id, invoice_no);

--
-- Name: job_outbox job_outbox_dedupe_key_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.job_outbox
    ADD CONSTRAINT job_outbox_dedupe_key_key UNIQUE (dedupe_key);

--
-- Name: job_outbox job_outbox_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.job_outbox
    ADD CONSTRAINT job_outbox_pkey PRIMARY KEY (id);

--
-- Name: job_slots job_slots_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.job_slots
    ADD CONSTRAINT job_slots_pkey PRIMARY KEY (queue, msg_id);

--
-- Name: jobs jobs_job_key_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.jobs
    ADD CONSTRAINT jobs_job_key_key UNIQUE (job_key);

--
-- Name: jobs jobs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.jobs
    ADD CONSTRAINT jobs_pkey PRIMARY KEY (id);

--
-- Name: knowledge_chunks knowledge_chunks_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.knowledge_chunks
    ADD CONSTRAINT knowledge_chunks_pkey PRIMARY KEY (id);

--
-- Name: knowledge_gaps knowledge_gaps_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.knowledge_gaps
    ADD CONSTRAINT knowledge_gaps_pkey PRIMARY KEY (id);

--
-- Name: knowledge_sources knowledge_sources_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.knowledge_sources
    ADD CONSTRAINT knowledge_sources_pkey PRIMARY KEY (id);

--
-- Name: knowledge_suggestion_state knowledge_suggestion_state_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.knowledge_suggestion_state
    ADD CONSTRAINT knowledge_suggestion_state_pkey PRIMARY KEY (workspace_id, suggestion_key);

--
-- Name: lead_actions lead_actions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lead_actions
    ADD CONSTRAINT lead_actions_pkey PRIMARY KEY (id);

--
-- Name: lead_flows lead_flows_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lead_flows
    ADD CONSTRAINT lead_flows_pkey PRIMARY KEY (id);

--
-- Name: leads leads_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.leads
    ADD CONSTRAINT leads_pkey PRIMARY KEY (id);

--
-- Name: loyalty_campaigns loyalty_campaigns_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.loyalty_campaigns
    ADD CONSTRAINT loyalty_campaigns_pkey PRIMARY KEY (id);

--
-- Name: loyalty_customer_links loyalty_customer_links_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.loyalty_customer_links
    ADD CONSTRAINT loyalty_customer_links_pkey PRIMARY KEY (id);

--
-- Name: loyalty_customer_links loyalty_customer_links_workspace_id_kind_ref_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.loyalty_customer_links
    ADD CONSTRAINT loyalty_customer_links_workspace_id_kind_ref_key UNIQUE (workspace_id, kind, ref);

--
-- Name: loyalty_customers loyalty_customers_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.loyalty_customers
    ADD CONSTRAINT loyalty_customers_pkey PRIMARY KEY (id);

--
-- Name: loyalty_ledger loyalty_ledger_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.loyalty_ledger
    ADD CONSTRAINT loyalty_ledger_pkey PRIMARY KEY (id);

--
-- Name: loyalty_ledger loyalty_ledger_workspace_id_ref_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.loyalty_ledger
    ADD CONSTRAINT loyalty_ledger_workspace_id_ref_key UNIQUE (workspace_id, ref);

--
-- Name: loyalty_otps loyalty_otps_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.loyalty_otps
    ADD CONSTRAINT loyalty_otps_pkey PRIMARY KEY (id);

--
-- Name: loyalty_programs loyalty_programs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.loyalty_programs
    ADD CONSTRAINT loyalty_programs_pkey PRIMARY KEY (workspace_id);

--
-- Name: loyalty_programs loyalty_programs_slug_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.loyalty_programs
    ADD CONSTRAINT loyalty_programs_slug_key UNIQUE (slug);

--
-- Name: loyalty_rewards loyalty_rewards_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.loyalty_rewards
    ADD CONSTRAINT loyalty_rewards_pkey PRIMARY KEY (id);

--
-- Name: loyalty_rewards loyalty_rewards_workspace_id_key_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.loyalty_rewards
    ADD CONSTRAINT loyalty_rewards_workspace_id_key_key UNIQUE (workspace_id, key);

--
-- Name: loyalty_sends loyalty_sends_campaign_id_customer_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.loyalty_sends
    ADD CONSTRAINT loyalty_sends_campaign_id_customer_id_key UNIQUE (campaign_id, customer_id);

--
-- Name: loyalty_sends loyalty_sends_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.loyalty_sends
    ADD CONSTRAINT loyalty_sends_pkey PRIMARY KEY (id);

--
-- Name: messages messages_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.messages
    ADD CONSTRAINT messages_pkey PRIMARY KEY (id);

--
-- Name: meta_comments meta_comments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.meta_comments
    ADD CONSTRAINT meta_comments_pkey PRIMARY KEY (connection_id, comment_id);

--
-- Name: meta_inbox meta_inbox_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.meta_inbox
    ADD CONSTRAINT meta_inbox_pkey PRIMARY KEY (id);

--
-- Name: meta_inbox meta_inbox_provider_delivery_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.meta_inbox
    ADD CONSTRAINT meta_inbox_provider_delivery_id_key UNIQUE (provider, delivery_id);

--
-- Name: meta_threads meta_threads_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.meta_threads
    ADD CONSTRAINT meta_threads_pkey PRIMARY KEY (connection_id, platform, user_id);

--
-- Name: module_context_notes module_context_notes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.module_context_notes
    ADD CONSTRAINT module_context_notes_pkey PRIMARY KEY (id);

--
-- Name: module_context_versions module_context_versions_installation_id_version_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.module_context_versions
    ADD CONSTRAINT module_context_versions_installation_id_version_key UNIQUE (installation_id, version);

--
-- Name: module_context_versions module_context_versions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.module_context_versions
    ADD CONSTRAINT module_context_versions_pkey PRIMARY KEY (id);

--
-- Name: module_installations module_installations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.module_installations
    ADD CONSTRAINT module_installations_pkey PRIMARY KEY (id);

--
-- Name: module_setup_messages module_setup_messages_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.module_setup_messages
    ADD CONSTRAINT module_setup_messages_pkey PRIMARY KEY (id);

--
-- Name: module_setup_sessions module_setup_sessions_installation_id_revision_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.module_setup_sessions
    ADD CONSTRAINT module_setup_sessions_installation_id_revision_key UNIQUE (installation_id, revision);

--
-- Name: module_setup_sessions module_setup_sessions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.module_setup_sessions
    ADD CONSTRAINT module_setup_sessions_pkey PRIMARY KEY (id);

--
-- Name: module_setup_writes module_setup_writes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.module_setup_writes
    ADD CONSTRAINT module_setup_writes_pkey PRIMARY KEY (id);

--
-- Name: modules modules_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.modules
    ADD CONSTRAINT modules_pkey PRIMARY KEY (key);

--
-- Name: n8n_pipelines n8n_pipelines_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.n8n_pipelines
    ADD CONSTRAINT n8n_pipelines_pkey PRIMARY KEY (workspace_id, template_key);

--
-- Name: n8n_platform_config n8n_platform_config_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.n8n_platform_config
    ADD CONSTRAINT n8n_platform_config_pkey PRIMARY KEY (key);

--
-- Name: n8n_runs n8n_runs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.n8n_runs
    ADD CONSTRAINT n8n_runs_pkey PRIMARY KEY (id);

--
-- Name: n8n_runs n8n_runs_workspace_id_template_key_dedupe_key_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.n8n_runs
    ADD CONSTRAINT n8n_runs_workspace_id_template_key_dedupe_key_key UNIQUE (workspace_id, template_key, dedupe_key);

--
-- Name: nivo_knowledge nivo_knowledge_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.nivo_knowledge
    ADD CONSTRAINT nivo_knowledge_pkey PRIMARY KEY (id);

--
-- Name: nivo_knowledge nivo_knowledge_slug_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.nivo_knowledge
    ADD CONSTRAINT nivo_knowledge_slug_key UNIQUE (slug);

--
-- Name: office_command_candidates office_command_candidates_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.office_command_candidates
    ADD CONSTRAINT office_command_candidates_pkey PRIMARY KEY (id);

--
-- Name: openclaw_agent_sync openclaw_agent_sync_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.openclaw_agent_sync
    ADD CONSTRAINT openclaw_agent_sync_pkey PRIMARY KEY (installation_id);

--
-- Name: orders orders_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.orders
    ADD CONSTRAINT orders_pkey PRIMARY KEY (id);

--
-- Name: orders orders_workspace_id_order_no_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.orders
    ADD CONSTRAINT orders_workspace_id_order_no_key UNIQUE (workspace_id, order_no);

--
-- Name: payment_order_requests payment_order_requests_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payment_order_requests
    ADD CONSTRAINT payment_order_requests_pkey PRIMARY KEY (id);

--
-- Name: payment_orders payment_orders_order_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payment_orders
    ADD CONSTRAINT payment_orders_order_code_key UNIQUE (order_code);

--
-- Name: payment_orders payment_orders_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payment_orders
    ADD CONSTRAINT payment_orders_pkey PRIMARY KEY (id);

--
-- Name: payment_orders payment_orders_sepay_transaction_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payment_orders
    ADD CONSTRAINT payment_orders_sepay_transaction_id_key UNIQUE (sepay_transaction_id);

--
-- Name: plan_usage_tiers plan_usage_tiers_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.plan_usage_tiers
    ADD CONSTRAINT plan_usage_tiers_pkey PRIMARY KEY (plan_code, credits_per_month);

--
-- Name: plans plans_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.plans
    ADD CONSTRAINT plans_pkey PRIMARY KEY (code);

--
-- Name: platform_admins platform_admins_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.platform_admins
    ADD CONSTRAINT platform_admins_pkey PRIMARY KEY (email);

--
-- Name: platform_audit platform_audit_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.platform_audit
    ADD CONSTRAINT platform_audit_pkey PRIMARY KEY (id);

--
-- Name: platform_flags platform_flags_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.platform_flags
    ADD CONSTRAINT platform_flags_pkey PRIMARY KEY (key);

--
-- Name: public_api public_api_dedupe_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.public_api
    ADD CONSTRAINT public_api_dedupe_key UNIQUE (workspace_id, dedupe_key);

--
-- Name: public_api public_api_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.public_api
    ADD CONSTRAINT public_api_pkey PRIMARY KEY (id);

--
-- Name: queue queue_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.queue
    ADD CONSTRAINT queue_pkey PRIMARY KEY (id);

--
-- Name: responsibilities responsibilities_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.responsibilities
    ADD CONSTRAINT responsibilities_pkey PRIMARY KEY (id);

--
-- Name: sepay_transactions sepay_transactions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sepay_transactions
    ADD CONSTRAINT sepay_transactions_pkey PRIMARY KEY (id);

--
-- Name: sepay_transactions sepay_transactions_sepay_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sepay_transactions
    ADD CONSTRAINT sepay_transactions_sepay_id_key UNIQUE (sepay_id);

--
-- Name: shifts_attendance shifts_attendance_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.shifts_attendance
    ADD CONSTRAINT shifts_attendance_pkey PRIMARY KEY (id);

--
-- Name: shifts_attendance shifts_attendance_shift_id_staff_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.shifts_attendance
    ADD CONSTRAINT shifts_attendance_shift_id_staff_id_key UNIQUE (shift_id, staff_id);

--
-- Name: shifts_availability shifts_availability_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.shifts_availability
    ADD CONSTRAINT shifts_availability_pkey PRIMARY KEY (id);

--
-- Name: shifts_coverage shifts_coverage_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.shifts_coverage
    ADD CONSTRAINT shifts_coverage_pkey PRIMARY KEY (id);

--
-- Name: shifts_leave_requests shifts_leave_requests_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.shifts_leave_requests
    ADD CONSTRAINT shifts_leave_requests_pkey PRIMARY KEY (id);

--
-- Name: shifts_notifications shifts_notifications_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.shifts_notifications
    ADD CONSTRAINT shifts_notifications_pkey PRIMARY KEY (id);

--
-- Name: shifts_positions shifts_positions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.shifts_positions
    ADD CONSTRAINT shifts_positions_pkey PRIMARY KEY (id);

--
-- Name: shifts_positions shifts_positions_workspace_id_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.shifts_positions
    ADD CONSTRAINT shifts_positions_workspace_id_name_key UNIQUE (workspace_id, name);

--
-- Name: shifts_schedules shifts_schedules_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.shifts_schedules
    ADD CONSTRAINT shifts_schedules_pkey PRIMARY KEY (id);

--
-- Name: shifts_schedules shifts_schedules_workspace_id_week_start_version_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.shifts_schedules
    ADD CONSTRAINT shifts_schedules_workspace_id_week_start_version_key UNIQUE (workspace_id, week_start, version);

--
-- Name: shifts_settings shifts_settings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.shifts_settings
    ADD CONSTRAINT shifts_settings_pkey PRIMARY KEY (workspace_id);

--
-- Name: shifts_shifts shifts_shifts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.shifts_shifts
    ADD CONSTRAINT shifts_shifts_pkey PRIMARY KEY (id);

--
-- Name: shifts_staff_pay shifts_staff_pay_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.shifts_staff_pay
    ADD CONSTRAINT shifts_staff_pay_pkey PRIMARY KEY (staff_id);

--
-- Name: shifts_staff shifts_staff_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.shifts_staff
    ADD CONSTRAINT shifts_staff_pkey PRIMARY KEY (id);

--
-- Name: shifts_swap_requests shifts_swap_requests_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.shifts_swap_requests
    ADD CONSTRAINT shifts_swap_requests_pkey PRIMARY KEY (id);

--
-- Name: staff staff_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.staff
    ADD CONSTRAINT staff_pkey PRIMARY KEY (id);

--
-- Name: telegram_inbox telegram_inbox_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.telegram_inbox
    ADD CONSTRAINT telegram_inbox_pkey PRIMARY KEY (id);

--
-- Name: telegram_inbox telegram_inbox_provider_delivery_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.telegram_inbox
    ADD CONSTRAINT telegram_inbox_provider_delivery_id_key UNIQUE (provider, delivery_id);

--
-- Name: transactions transactions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.transactions
    ADD CONSTRAINT transactions_pkey PRIMARY KEY (id);

--
-- Name: video_brand_kits video_brand_kits_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.video_brand_kits
    ADD CONSTRAINT video_brand_kits_pkey PRIMARY KEY (workspace_id);

--
-- Name: video_project_versions video_project_versions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.video_project_versions
    ADD CONSTRAINT video_project_versions_pkey PRIMARY KEY (id);

--
-- Name: video_project_versions video_project_versions_project_id_version_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.video_project_versions
    ADD CONSTRAINT video_project_versions_project_id_version_key UNIQUE (project_id, version);

--
-- Name: video_projects video_projects_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.video_projects
    ADD CONSTRAINT video_projects_pkey PRIMARY KEY (id);

--
-- Name: video_renders video_renders_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.video_renders
    ADD CONSTRAINT video_renders_pkey PRIMARY KEY (id);

--
-- Name: work_items work_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.work_items
    ADD CONSTRAINT work_items_pkey PRIMARY KEY (id);

--
-- Name: work_items work_items_workspace_id_dedupe_key_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.work_items
    ADD CONSTRAINT work_items_workspace_id_dedupe_key_key UNIQUE (workspace_id, dedupe_key);

--
-- Name: workspace_invites workspace_invites_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workspace_invites
    ADD CONSTRAINT workspace_invites_pkey PRIMARY KEY (id);

--
-- Name: workspace_invites workspace_invites_token_hash_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workspace_invites
    ADD CONSTRAINT workspace_invites_token_hash_key UNIQUE (token_hash);

--
-- Name: workspace_members workspace_members_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workspace_members
    ADD CONSTRAINT workspace_members_pkey PRIMARY KEY (id);

--
-- Name: workspace_members workspace_members_workspace_id_user_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workspace_members
    ADD CONSTRAINT workspace_members_workspace_id_user_id_key UNIQUE (workspace_id, user_id);

--
-- Name: workspaces workspaces_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workspaces
    ADD CONSTRAINT workspaces_pkey PRIMARY KEY (id);

--
-- Name: zalo_inbox zalo_inbox_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.zalo_inbox
    ADD CONSTRAINT zalo_inbox_pkey PRIMARY KEY (id);

--
-- Name: zalo_inbox zalo_inbox_provider_delivery_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.zalo_inbox
    ADD CONSTRAINT zalo_inbox_provider_delivery_id_key UNIQUE (provider, delivery_id);

--
-- Name: zalo_wizard_drafts zalo_wizard_drafts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.zalo_wizard_drafts
    ADD CONSTRAINT zalo_wizard_drafts_pkey PRIMARY KEY (connection_id);

--
-- Name: accounting_adjustments_target; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX accounting_adjustments_target ON public.accounting_adjustments USING btree (workspace_id, target_type, target_id, created_at DESC);

--
-- Name: agent_access_log_ws_time; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX agent_access_log_ws_time ON public.agent_access_log USING btree (workspace_id, created_at DESC);

--
-- Name: agent_connections_connection; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX agent_connections_connection ON public.agent_connections USING btree (connection_id);

--
-- Name: agent_conversations_agent_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX agent_conversations_agent_id_idx ON public.agent_conversations USING btree (agent_id);

--
-- Name: agent_conversations_channel_external; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX agent_conversations_channel_external ON public.agent_conversations USING btree (workspace_id, channel, COALESCE(connection_id, '00000000-0000-0000-0000-000000000000'::uuid), external_id) WHERE (external_id IS NOT NULL);

--
-- Name: agent_conversations_installation; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX agent_conversations_installation ON public.agent_conversations USING btree (workspace_id, installation_id, created_at DESC);

--
-- Name: agent_messages_conversation_id_created_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX agent_messages_conversation_id_created_at_idx ON public.agent_messages USING btree (conversation_id, created_at);

--
-- Name: agent_messages_one_reply_per_message_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX agent_messages_one_reply_per_message_key ON public.agent_messages USING btree (conversation_id, in_reply_to) WHERE ((role = 'agent'::text) AND (in_reply_to IS NOT NULL));

--
-- Name: agent_messages_ws_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX agent_messages_ws_created ON public.agent_messages USING btree (workspace_id, created_at DESC);

--
-- Name: agents_workspace_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX agents_workspace_id_idx ON public.agents USING btree (workspace_id);

--
-- Name: ai_generations_open; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ai_generations_open ON public.ai_generations USING btree (created_at) WHERE (status = ANY (ARRAY['queued'::text, 'running'::text]));

--
-- Name: ai_generations_workspace; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ai_generations_workspace ON public.ai_generations USING btree (workspace_id, created_at DESC);

--
-- Name: ai_usage_events_ws_time; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ai_usage_events_ws_time ON public.ai_usage_events USING btree (workspace_id, created_at DESC);

--
-- Name: api_keys_workspace; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX api_keys_workspace ON public.api_keys USING btree (workspace_id, created_at DESC);

--
-- Name: app_commands_requester; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX app_commands_requester ON public.app_commands USING btree (requested_by, created_at DESC);

--
-- Name: app_errors_recent; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX app_errors_recent ON public.app_errors USING btree (created_at DESC);

--
-- Name: app_errors_workspace; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX app_errors_workspace ON public.app_errors USING btree (workspace_id, created_at DESC) WHERE (workspace_id IS NOT NULL);

--
-- Name: authority_actions_module; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX authority_actions_module ON public.authority_actions USING btree (module_key, sort_order);

--
-- Name: authority_rules_ws; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX authority_rules_ws ON public.authority_rules USING btree (workspace_id);

--
-- Name: automation_commands_workspace; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX automation_commands_workspace ON public.automation_commands USING btree (workspace_id, created_at DESC);

--
-- Name: automation_pipelines_enabled; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX automation_pipelines_enabled ON public.automation_pipelines USING btree (template_key) WHERE enabled;

--
-- Name: automation_runs_due; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX automation_runs_due ON public.automation_runs USING btree (run_at) WHERE (status = ANY (ARRAY['queued'::text, 'failed'::text]));

--
-- Name: automation_runs_pipeline; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX automation_runs_pipeline ON public.automation_runs USING btree (pipeline_id, created_at DESC);

--
-- Name: automation_runs_workspace; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX automation_runs_workspace ON public.automation_runs USING btree (workspace_id, created_at DESC);

--
-- Name: booking_exceptions_ws; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX booking_exceptions_ws ON public.booking_exceptions USING btree (workspace_id, on_date);

--
-- Name: booking_hours_resource; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX booking_hours_resource ON public.booking_hours USING btree (resource_id, weekday);

--
-- Name: booking_reminders_due; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX booking_reminders_due ON public.booking_reminders USING btree (due_at) WHERE (status = 'scheduled'::text);

--
-- Name: booking_resources_ws; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX booking_resources_ws ON public.booking_resources USING btree (workspace_id, sort_order);

--
-- Name: booking_services_ws; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX booking_services_ws ON public.booking_services USING btree (workspace_id, sort_order);

--
-- Name: booking_waitlist_ws; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX booking_waitlist_ws ON public.booking_waitlist USING btree (workspace_id, status, window_start);

--
-- Name: bookings_idem; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX bookings_idem ON public.bookings USING btree (workspace_id, idempotency_key) WHERE (idempotency_key IS NOT NULL);

--
-- Name: bookings_installation; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX bookings_installation ON public.bookings USING btree (workspace_id, installation_id, start_at);

--
-- Name: bookings_lead; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX bookings_lead ON public.bookings USING btree (lead_id);

--
-- Name: bookings_resource_start; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX bookings_resource_start ON public.bookings USING btree (resource_id, start_at);

--
-- Name: bookings_ws_start; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX bookings_ws_start ON public.bookings USING btree (workspace_id, start_at);

--
-- Name: brain_commands_ws; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX brain_commands_ws ON public.brain_commands USING btree (workspace_id, created_at DESC);

--
-- Name: brain_eval_cases_ws; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX brain_eval_cases_ws ON public.brain_eval_cases USING btree (workspace_id, module, kind);

--
-- Name: brain_extractions_ws; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX brain_extractions_ws ON public.brain_extractions USING btree (workspace_id, status, updated_at);

--
-- Name: brain_facts_evidence; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX brain_facts_evidence ON public.brain_facts USING gin (evidence jsonb_path_ops);

--
-- Name: brain_facts_installation; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX brain_facts_installation ON public.brain_facts USING btree (workspace_id, installation_id) WHERE (installation_id IS NOT NULL);

--
-- Name: brain_facts_one_active; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX brain_facts_one_active ON public.brain_facts USING btree (workspace_id, subject_key, attribute, COALESCE(installation_id, '00000000-0000-0000-0000-000000000000'::uuid)) WHERE (status = 'active'::text);

--
-- Name: brain_facts_search; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX brain_facts_search ON public.brain_facts USING gin (to_tsvector('simple'::regconfig, ((((subject_label || ' '::text) || attribute_label) || ' '::text) || value)));

--
-- Name: brain_facts_ws_proposal; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX brain_facts_ws_proposal ON public.brain_facts USING btree (workspace_id, subject_key, attribute) WHERE (status = 'proposed'::text);

--
-- Name: brain_facts_ws_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX brain_facts_ws_status ON public.brain_facts USING btree (workspace_id, status, updated_at DESC);

--
-- Name: brain_facts_ws_subject; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX brain_facts_ws_subject ON public.brain_facts USING btree (workspace_id, subject_key);

--
-- Name: brain_lessons_ws; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX brain_lessons_ws ON public.brain_lessons USING btree (workspace_id, status, module);

--
-- Name: connection_commands_created_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX connection_commands_created_idx ON public.connection_commands USING btree (created_at);

--
-- Name: connection_secrets_token_expiry; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX connection_secrets_token_expiry ON public.connection_secrets USING btree (token_expires_at) WHERE (token_expires_at IS NOT NULL);

--
-- Name: connections_meta_ig; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX connections_meta_ig ON public.connections USING btree (((public_meta ->> 'ig_id'::text))) WHERE (provider = 'meta'::text);

--
-- Name: connections_meta_page; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX connections_meta_page ON public.connections USING btree (((public_meta ->> 'page_id'::text))) WHERE (provider = 'meta'::text);

--
-- Name: connections_next_sync; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX connections_next_sync ON public.connections USING btree (next_sync_at) WHERE ((next_sync_at IS NOT NULL) AND (status <> 'disconnected'::text));

--
-- Name: connections_smtp_default; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX connections_smtp_default ON public.connections USING btree (workspace_id) WHERE ((provider = 'smtp'::text) AND is_default AND (status <> 'disconnected'::text));

--
-- Name: connections_telegram_bot; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX connections_telegram_bot ON public.connections USING btree (((public_meta ->> 'bot_id'::text))) WHERE ((provider = 'telegram'::text) AND (status <> 'disconnected'::text));

--
-- Name: connections_workspace; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX connections_workspace ON public.connections USING btree (workspace_id, provider);

--
-- Name: content_items_ws_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX content_items_ws_status ON public.content_items USING btree (workspace_id, status);

--
-- Name: content_items_ws_when; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX content_items_ws_when ON public.content_items USING btree (workspace_id, scheduled_at);

--
-- Name: content_pillars_ws; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX content_pillars_ws ON public.content_pillars USING btree (workspace_id, sort);

--
-- Name: content_plans_ws; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX content_plans_ws ON public.content_plans USING btree (workspace_id, created_at DESC);

--
-- Name: contracts_ws_end; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX contracts_ws_end ON public.contracts USING btree (workspace_id, status, ends_on);

--
-- Name: credit_pack_purchases_period; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX credit_pack_purchases_period ON public.credit_pack_purchases USING btree (workspace_id, period);

--
-- Name: credit_topups_open; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX credit_topups_open ON public.credit_topups USING btree (workspace_id, expires_at) WHERE (credits_remaining > 0);

--
-- Name: data_records_title; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX data_records_title ON public.data_records USING gin (to_tsvector('simple'::regconfig, title));

--
-- Name: data_records_ws_entity; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX data_records_ws_entity ON public.data_records USING btree (workspace_id, entity, occurred_at DESC NULLS LAST);

--
-- Name: data_sync_runs_conn_time; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX data_sync_runs_conn_time ON public.data_sync_runs USING btree (connection_id, started_at DESC);

--
-- Name: decisions_ws_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX decisions_ws_created ON public.decisions USING btree (workspace_id, created_at DESC);

--
-- Name: email_messages_workspace; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX email_messages_workspace ON public.email_messages USING btree (workspace_id, created_at DESC);

--
-- Name: events_lead_id_created_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX events_lead_id_created_at_idx ON public.events USING btree (lead_id, created_at);

--
-- Name: executions_responsibility_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX executions_responsibility_id_idx ON public.executions USING btree (responsibility_id);

--
-- Name: hiring_apply_hits_ip; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX hiring_apply_hits_ip ON public.hiring_apply_hits USING btree (ip_hash, created_at DESC);

--
-- Name: hiring_availability_member; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX hiring_availability_member ON public.hiring_availability USING btree (workspace_id, member_user_id);

--
-- Name: hiring_candidates_job; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX hiring_candidates_job ON public.hiring_candidates USING btree (job_id, stage);

--
-- Name: hiring_candidates_job_phone; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX hiring_candidates_job_phone ON public.hiring_candidates USING btree (job_id, phone) WHERE (phone <> ''::text);

--
-- Name: hiring_candidates_ws; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX hiring_candidates_ws ON public.hiring_candidates USING btree (workspace_id, stage_changed_at);

--
-- Name: hiring_consents_candidate; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX hiring_consents_candidate ON public.hiring_consents USING btree (candidate_id);

--
-- Name: hiring_events_candidate; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX hiring_events_candidate ON public.hiring_events USING btree (candidate_id, created_at);

--
-- Name: hiring_interviews_candidate; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX hiring_interviews_candidate ON public.hiring_interviews USING btree (candidate_id);

--
-- Name: hiring_interviews_ws; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX hiring_interviews_ws ON public.hiring_interviews USING btree (workspace_id, slot_start);

--
-- Name: hiring_jobs_ws; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX hiring_jobs_ws ON public.hiring_jobs USING btree (workspace_id, status);

--
-- Name: hiring_offers_candidate; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX hiring_offers_candidate ON public.hiring_offers USING btree (candidate_id);

--
-- Name: hiring_offers_ws; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX hiring_offers_ws ON public.hiring_offers USING btree (workspace_id, status);

--
-- Name: hiring_onboarding_candidate; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX hiring_onboarding_candidate ON public.hiring_onboarding USING btree (candidate_id, sort);

--
-- Name: inbound_ws_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX inbound_ws_created ON public.inbound_events USING btree (workspace_id, created_at DESC);

--
-- Name: inbound_ws_event_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX inbound_ws_event_id ON public.inbound_events USING btree (workspace_id, event_id) WHERE (event_id IS NOT NULL);

--
-- Name: inventory_items_ws; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX inventory_items_ws ON public.inventory_items USING btree (workspace_id, active);

--
-- Name: inventory_locations_one_default; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX inventory_locations_one_default ON public.inventory_locations USING btree (workspace_id) WHERE is_default;

--
-- Name: inventory_locations_ws; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX inventory_locations_ws ON public.inventory_locations USING btree (workspace_id);

--
-- Name: inventory_movements_dedupe; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX inventory_movements_dedupe ON public.inventory_movements USING btree (workspace_id, dedupe_key) WHERE (dedupe_key IS NOT NULL);

--
-- Name: inventory_movements_item; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX inventory_movements_item ON public.inventory_movements USING btree (item_id, created_at DESC);

--
-- Name: inventory_movements_ws; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX inventory_movements_ws ON public.inventory_movements USING btree (workspace_id, created_at DESC);

--
-- Name: inventory_po_lines_po; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX inventory_po_lines_po ON public.inventory_po_lines USING btree (po_id);

--
-- Name: inventory_po_ws; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX inventory_po_ws ON public.inventory_purchase_orders USING btree (workspace_id, status);

--
-- Name: inventory_receipts_po; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX inventory_receipts_po ON public.inventory_receipts USING btree (po_id);

--
-- Name: inventory_recipe_lines_recipe; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX inventory_recipe_lines_recipe ON public.inventory_recipe_lines USING btree (recipe_id);

--
-- Name: inventory_recipes_ws; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX inventory_recipes_ws ON public.inventory_recipes USING btree (workspace_id);

--
-- Name: inventory_stock_levels_ws; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX inventory_stock_levels_ws ON public.inventory_stock_levels USING btree (workspace_id);

--
-- Name: inventory_suppliers_ws; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX inventory_suppliers_ws ON public.inventory_suppliers USING btree (workspace_id);

--
-- Name: invoices_one_per_order; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX invoices_one_per_order ON public.invoices USING btree (order_id) WHERE (order_id IS NOT NULL);

--
-- Name: invoices_ws; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX invoices_ws ON public.invoices USING btree (workspace_id, status);

--
-- Name: job_outbox_failed; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX job_outbox_failed ON public.job_outbox USING btree (finished_at DESC) WHERE (state = 'failed'::text);

--
-- Name: job_outbox_msg; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX job_outbox_msg ON public.job_outbox USING btree (queue, msg_id) WHERE (msg_id IS NOT NULL);

--
-- Name: job_outbox_open; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX job_outbox_open ON public.job_outbox USING btree (created_at) WHERE (state = ANY (ARRAY['queued'::text, 'running'::text]));

--
-- Name: job_outbox_ws; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX job_outbox_ws ON public.job_outbox USING btree (workspace_id, created_at DESC);

--
-- Name: job_slots_ws; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX job_slots_ws ON public.job_slots USING btree (workspace_id);

--
-- Name: knowledge_chunks_embedding; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX knowledge_chunks_embedding ON public.knowledge_chunks USING hnsw (embedding extensions.vector_cosine_ops);

--
-- Name: knowledge_chunks_fts; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX knowledge_chunks_fts ON public.knowledge_chunks USING gin (fts);

--
-- Name: knowledge_chunks_model; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX knowledge_chunks_model ON public.knowledge_chunks USING btree (workspace_id, embedding_model);

--
-- Name: knowledge_chunks_source; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX knowledge_chunks_source ON public.knowledge_chunks USING btree (source_id, ord);

--
-- Name: knowledge_chunks_visibility; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX knowledge_chunks_visibility ON public.knowledge_chunks USING btree (workspace_id, visibility);

--
-- Name: knowledge_chunks_ws; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX knowledge_chunks_ws ON public.knowledge_chunks USING btree (workspace_id, module);

--
-- Name: knowledge_gaps_one_question; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX knowledge_gaps_one_question ON public.knowledge_gaps USING btree (workspace_id, module, question_key);

--
-- Name: knowledge_gaps_ws_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX knowledge_gaps_ws_status ON public.knowledge_gaps USING btree (workspace_id, status, last_seen_at DESC);

--
-- Name: knowledge_sources_installation; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX knowledge_sources_installation ON public.knowledge_sources USING btree (workspace_id, installation_id) WHERE (installation_id IS NOT NULL);

--
-- Name: knowledge_sources_open; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX knowledge_sources_open ON public.knowledge_sources USING btree (workspace_id) WHERE (status = ANY (ARRAY['queued'::text, 'reading'::text, 'indexing'::text, 'extracting_facts'::text]));

--
-- Name: knowledge_sources_ws; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX knowledge_sources_ws ON public.knowledge_sources USING btree (workspace_id, created_at DESC);

--
-- Name: lead_actions_workspace_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX lead_actions_workspace_created ON public.lead_actions USING btree (workspace_id, created_at DESC);

--
-- Name: lead_flows_email; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX lead_flows_email ON public.lead_flows USING btree (workspace_id, email) WHERE (email IS NOT NULL);

--
-- Name: lead_flows_igsid; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX lead_flows_igsid ON public.lead_flows USING btree (connection_id, igsid) WHERE (igsid IS NOT NULL);

--
-- Name: lead_flows_installation; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX lead_flows_installation ON public.lead_flows USING btree (workspace_id, installation_id);

--
-- Name: lead_flows_lead; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX lead_flows_lead ON public.lead_flows USING btree (workspace_id, lead_id) WHERE (lead_id IS NOT NULL);

--
-- Name: lead_flows_phone; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX lead_flows_phone ON public.lead_flows USING btree (workspace_id, phone) WHERE (phone IS NOT NULL);

--
-- Name: lead_flows_psid; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX lead_flows_psid ON public.lead_flows USING btree (connection_id, psid) WHERE (psid IS NOT NULL);

--
-- Name: lead_flows_state; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX lead_flows_state ON public.lead_flows USING btree (workspace_id, state, updated_at DESC);

--
-- Name: leads_installation; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX leads_installation ON public.leads USING btree (workspace_id, installation_id);

--
-- Name: leads_workspace_id_created_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX leads_workspace_id_created_at_idx ON public.leads USING btree (workspace_id, created_at DESC);

--
-- Name: leads_ws_email; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX leads_ws_email ON public.leads USING btree (workspace_id, email);

--
-- Name: leads_ws_phone; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX leads_ws_phone ON public.leads USING btree (workspace_id, phone);

--
-- Name: loyalty_campaigns_ws; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX loyalty_campaigns_ws ON public.loyalty_campaigns USING btree (workspace_id, created_at DESC);

--
-- Name: loyalty_customer_links_customer; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX loyalty_customer_links_customer ON public.loyalty_customer_links USING btree (customer_id);

--
-- Name: loyalty_customers_email; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX loyalty_customers_email ON public.loyalty_customers USING btree (workspace_id, email) WHERE (email IS NOT NULL);

--
-- Name: loyalty_customers_phone; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX loyalty_customers_phone ON public.loyalty_customers USING btree (workspace_id, phone) WHERE (phone IS NOT NULL);

--
-- Name: loyalty_customers_ws; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX loyalty_customers_ws ON public.loyalty_customers USING btree (workspace_id, created_at DESC);

--
-- Name: loyalty_ledger_customer; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX loyalty_ledger_customer ON public.loyalty_ledger USING btree (customer_id, occurred_at DESC);

--
-- Name: loyalty_ledger_ws; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX loyalty_ledger_ws ON public.loyalty_ledger USING btree (workspace_id, occurred_at DESC);

--
-- Name: loyalty_otps_customer; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX loyalty_otps_customer ON public.loyalty_otps USING btree (customer_id, created_at DESC);

--
-- Name: loyalty_sends_open; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX loyalty_sends_open ON public.loyalty_sends USING btree (workspace_id, created_at) WHERE (status = 'queued'::text);

--
-- Name: messages_workspace_id_created_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX messages_workspace_id_created_at_idx ON public.messages USING btree (workspace_id, created_at);

--
-- Name: module_context_notes_inst; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX module_context_notes_inst ON public.module_context_notes USING btree (installation_id, status, created_at DESC);

--
-- Name: module_installations_agent_unique; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX module_installations_agent_unique ON public.module_installations USING btree (agent_id) WHERE (agent_id IS NOT NULL);

--
-- Name: module_installations_name_unique; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX module_installations_name_unique ON public.module_installations USING btree (workspace_id, module_key, lower(name));

--
-- Name: module_installations_single; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX module_installations_single ON public.module_installations USING btree (workspace_id, module_key) WHERE (NOT is_multi);

--
-- Name: module_installations_ws_module; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX module_installations_ws_module ON public.module_installations USING btree (workspace_id, module_key, created_at);

--
-- Name: module_setup_messages_session; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX module_setup_messages_session ON public.module_setup_messages USING btree (setup_session_id, created_at);

--
-- Name: module_setup_sessions_inst; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX module_setup_sessions_inst ON public.module_setup_sessions USING btree (installation_id, revision DESC);

--
-- Name: module_setup_writes_session; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX module_setup_writes_session ON public.module_setup_writes USING btree (setup_session_id, created_at);

--
-- Name: n8n_runs_workspace; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX n8n_runs_workspace ON public.n8n_runs USING btree (workspace_id, created_at DESC);

--
-- Name: nivo_knowledge_embedding; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX nivo_knowledge_embedding ON public.nivo_knowledge USING hnsw (embedding extensions.vector_cosine_ops);

--
-- Name: nivo_knowledge_fts; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX nivo_knowledge_fts ON public.nivo_knowledge USING gin (fts);

--
-- Name: nivo_knowledge_module; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX nivo_knowledge_module ON public.nivo_knowledge USING btree (module, kind);

--
-- Name: office_command_candidates_message; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX office_command_candidates_message ON public.office_command_candidates USING btree (message_id);

--
-- Name: office_command_candidates_ws; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX office_command_candidates_ws ON public.office_command_candidates USING btree (workspace_id, created_at DESC);

--
-- Name: openclaw_agent_sync_workspace; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX openclaw_agent_sync_workspace ON public.openclaw_agent_sync USING btree (workspace_id);

--
-- Name: orders_ws; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX orders_ws ON public.orders USING btree (workspace_id, status);

--
-- Name: payment_order_requests_ws_time; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX payment_order_requests_ws_time ON public.payment_order_requests USING btree (workspace_id, created_at DESC);

--
-- Name: payment_orders_ws; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX payment_orders_ws ON public.payment_orders USING btree (workspace_id, created_at DESC);

--
-- Name: platform_audit_recent; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX platform_audit_recent ON public.platform_audit USING btree (created_at DESC);

--
-- Name: platform_audit_workspace; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX platform_audit_workspace ON public.platform_audit USING btree (workspace_id, created_at DESC);

--
-- Name: public_api_unprocessed; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX public_api_unprocessed ON public.public_api USING btree (created_at) WHERE (processed_at IS NULL);

--
-- Name: queue_unsent_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX queue_unsent_idx ON public.queue USING btree (created_at, id) WHERE (sent_at IS NULL);

--
-- Name: responsibilities_lead_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX responsibilities_lead_id_idx ON public.responsibilities USING btree (lead_id);

--
-- Name: responsibilities_workspace_id_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX responsibilities_workspace_id_status_idx ON public.responsibilities USING btree (workspace_id, status);

--
-- Name: sepay_transactions_review; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX sepay_transactions_review ON public.sepay_transactions USING btree (status, received_at DESC);

--
-- Name: shifts_availability_staff; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX shifts_availability_staff ON public.shifts_availability USING btree (staff_id, status);

--
-- Name: shifts_coverage_ws; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX shifts_coverage_ws ON public.shifts_coverage USING btree (workspace_id, weekday);

--
-- Name: shifts_leave_ws; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX shifts_leave_ws ON public.shifts_leave_requests USING btree (workspace_id, status, from_date);

--
-- Name: shifts_notifications_shift_kind; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX shifts_notifications_shift_kind ON public.shifts_notifications USING btree (shift_id, kind) WHERE (shift_id IS NOT NULL);

--
-- Name: shifts_notifications_ws; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX shifts_notifications_ws ON public.shifts_notifications USING btree (workspace_id, created_at DESC);

--
-- Name: shifts_schedules_week; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX shifts_schedules_week ON public.shifts_schedules USING btree (workspace_id, week_start DESC);

--
-- Name: shifts_shifts_schedule; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX shifts_shifts_schedule ON public.shifts_shifts USING btree (schedule_id);

--
-- Name: shifts_shifts_staff_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX shifts_shifts_staff_date ON public.shifts_shifts USING btree (workspace_id, staff_id, shift_date);

--
-- Name: shifts_staff_link; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX shifts_staff_link ON public.shifts_staff USING btree (workspace_id, staff_id);

--
-- Name: shifts_staff_ws; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX shifts_staff_ws ON public.shifts_staff USING btree (workspace_id) WHERE active;

--
-- Name: shifts_swap_ws; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX shifts_swap_ws ON public.shifts_swap_requests USING btree (workspace_id, status);

--
-- Name: staff_ws; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX staff_ws ON public.staff USING btree (workspace_id);

--
-- Name: transactions_ws; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX transactions_ws ON public.transactions USING btree (workspace_id, status);

--
-- Name: video_project_versions_ws; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX video_project_versions_ws ON public.video_project_versions USING btree (workspace_id, created_at DESC);

--
-- Name: video_projects_workspace; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX video_projects_workspace ON public.video_projects USING btree (workspace_id, updated_at DESC);

--
-- Name: video_renders_open; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX video_renders_open ON public.video_renders USING btree (created_at) WHERE (status = ANY (ARRAY['queued'::text, 'rendering'::text]));

--
-- Name: video_renders_workspace; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX video_renders_workspace ON public.video_renders USING btree (workspace_id, created_at DESC);

--
-- Name: work_items_chain; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX work_items_chain ON public.work_items USING btree (workspace_id, chain_id, action);

--
-- Name: work_items_installation; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX work_items_installation ON public.work_items USING btree (workspace_id, installation_id, status, created_at DESC);

--
-- Name: work_items_lead; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX work_items_lead ON public.work_items USING btree (lead_id);

--
-- Name: work_items_ws_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX work_items_ws_status ON public.work_items USING btree (workspace_id, status, created_at DESC);

--
-- Name: workspace_invites_email; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX workspace_invites_email ON public.workspace_invites USING btree (lower(email));

--
-- Name: workspace_invites_ws; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX workspace_invites_ws ON public.workspace_invites USING btree (workspace_id, created_at DESC);

--
-- Name: workspace_members_one_per_staff; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX workspace_members_one_per_staff ON public.workspace_members USING btree (workspace_id, staff_id) WHERE (staff_id IS NOT NULL);

--
-- Name: workspace_members_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX workspace_members_user ON public.workspace_members USING btree (user_id) WHERE (status = 'active'::text);

--
-- Name: agent_connections agent_connections_same_workspace; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER agent_connections_same_workspace BEFORE INSERT OR UPDATE ON public.agent_connections FOR EACH ROW EXECUTE FUNCTION public.agent_connections_same_workspace();

--
-- Name: agent_conversations agent_conversations_attribute_lead; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER agent_conversations_attribute_lead AFTER INSERT OR UPDATE OF lead_id ON public.agent_conversations FOR EACH ROW EXECUTE FUNCTION public.agent_conversations_attribute_lead();

--
-- Name: agent_conversations agent_conversations_fill_installation; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER agent_conversations_fill_installation BEFORE INSERT OR UPDATE OF agent_id ON public.agent_conversations FOR EACH ROW EXECUTE FUNCTION public.agent_conversations_fill_installation();

--
-- Name: ai_usage_events ai_usage_events_settle; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER ai_usage_events_settle AFTER INSERT ON public.ai_usage_events FOR EACH ROW EXECUTE FUNCTION public.ai_usage_events_settle();

--
-- Name: bookings bookings_fill_installation; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER bookings_fill_installation BEFORE INSERT ON public.bookings FOR EACH ROW EXECUTE FUNCTION public.bookings_fill_installation();

--
-- Name: bookings bookings_notify; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER bookings_notify AFTER INSERT OR UPDATE OF status, start_at, resource_id ON public.bookings FOR EACH ROW EXECUTE FUNCTION public.bookings_notify();

--
-- Name: content_items content_items_touch; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER content_items_touch BEFORE UPDATE ON public.content_items FOR EACH ROW EXECUTE FUNCTION public.content_items_touch();

--
-- Name: content_settings content_settings_touch; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER content_settings_touch BEFORE UPDATE ON public.content_settings FOR EACH ROW EXECUTE FUNCTION public.content_settings_touch();

--
-- Name: knowledge_sources knowledge_sources_visibility_sync; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER knowledge_sources_visibility_sync AFTER UPDATE OF visibility, module ON public.knowledge_sources FOR EACH ROW EXECUTE FUNCTION public.knowledge_chunk_visibility_sync();

--
-- Name: lead_flows lead_flows_fill_installation; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER lead_flows_fill_installation BEFORE INSERT OR UPDATE OF connection_id, lead_id ON public.lead_flows FOR EACH ROW EXECUTE FUNCTION public.lead_flows_fill_installation();

--
-- Name: loyalty_ledger loyalty_ledger_no_update; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER loyalty_ledger_no_update BEFORE UPDATE ON public.loyalty_ledger FOR EACH ROW EXECUTE FUNCTION public.loyalty_ledger_immutable();

--
-- Name: module_context_versions module_context_versions_immutable; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER module_context_versions_immutable BEFORE UPDATE ON public.module_context_versions FOR EACH ROW EXECUTE FUNCTION public.module_context_versions_immutable();

--
-- Name: module_installations module_installations_fill; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER module_installations_fill BEFORE INSERT OR UPDATE OF module_key, name ON public.module_installations FOR EACH ROW EXECUTE FUNCTION public.module_installations_fill();

--
-- Name: n8n_runs n8n_runs_mirror; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER n8n_runs_mirror AFTER INSERT OR UPDATE ON public.n8n_runs FOR EACH ROW EXECUTE FUNCTION public.n8n_runs_mirror();

--
-- Name: video_brand_kits video_brand_kits_touch; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER video_brand_kits_touch BEFORE UPDATE ON public.video_brand_kits FOR EACH ROW EXECUTE FUNCTION public.video_touch();

--
-- Name: video_projects video_projects_touch; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER video_projects_touch BEFORE UPDATE ON public.video_projects FOR EACH ROW EXECUTE FUNCTION public.video_touch();

--
-- Name: video_renders video_renders_touch; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER video_renders_touch BEFORE UPDATE ON public.video_renders FOR EACH ROW EXECUTE FUNCTION public.video_renders_touch();

--
-- Name: work_items work_items_fill_installation; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER work_items_fill_installation BEFORE INSERT ON public.work_items FOR EACH ROW EXECUTE FUNCTION public.work_items_fill_installation();

--
-- Name: workspace_members workspace_members_guard; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER workspace_members_guard BEFORE INSERT OR DELETE OR UPDATE ON public.workspace_members FOR EACH ROW EXECUTE FUNCTION public.workspace_members_guard();

--
-- Name: workspaces workspaces_add_owner_member; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER workspaces_add_owner_member AFTER INSERT ON public.workspaces FOR EACH ROW EXECUTE FUNCTION public.workspaces_add_owner_member();

--
-- Name: workspaces workspaces_billing_guard; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER workspaces_billing_guard BEFORE UPDATE ON public.workspaces FOR EACH ROW EXECUTE FUNCTION public.workspaces_billing_guard();

--
-- Name: accounting_adjustments accounting_adjustments_workspace_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.accounting_adjustments
    ADD CONSTRAINT accounting_adjustments_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE CASCADE;

--
-- Name: agent_access_log agent_access_log_agent_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.agent_access_log
    ADD CONSTRAINT agent_access_log_agent_id_fkey FOREIGN KEY (agent_id) REFERENCES public.agents(id) ON DELETE SET NULL;

--
-- Name: agent_access_log agent_access_log_connection_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.agent_access_log
    ADD CONSTRAINT agent_access_log_connection_id_fkey FOREIGN KEY (connection_id) REFERENCES public.connections(id) ON DELETE SET NULL;

--
-- Name: agent_access_log agent_access_log_workspace_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.agent_access_log
    ADD CONSTRAINT agent_access_log_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE CASCADE;

--
-- Name: agent_connections agent_connections_agent_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.agent_connections
    ADD CONSTRAINT agent_connections_agent_id_fkey FOREIGN KEY (agent_id) REFERENCES public.agents(id) ON DELETE CASCADE;

--
-- Name: agent_connections agent_connections_connection_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.agent_connections
    ADD CONSTRAINT agent_connections_connection_id_fkey FOREIGN KEY (connection_id) REFERENCES public.connections(id) ON DELETE CASCADE;

--
-- Name: agent_connections agent_connections_workspace_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.agent_connections
    ADD CONSTRAINT agent_connections_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE CASCADE;

--
-- Name: agent_conversations agent_conversations_agent_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.agent_conversations
    ADD CONSTRAINT agent_conversations_agent_id_fkey FOREIGN KEY (agent_id) REFERENCES public.agents(id) ON DELETE CASCADE;

--
-- Name: agent_conversations agent_conversations_connection_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.agent_conversations
    ADD CONSTRAINT agent_conversations_connection_id_fkey FOREIGN KEY (connection_id) REFERENCES public.connections(id) ON DELETE SET NULL;

--
-- Name: agent_conversations agent_conversations_installation_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.agent_conversations
    ADD CONSTRAINT agent_conversations_installation_id_fkey FOREIGN KEY (installation_id) REFERENCES public.module_installations(id) ON DELETE SET NULL;

--
-- Name: agent_conversations agent_conversations_workspace_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.agent_conversations
    ADD CONSTRAINT agent_conversations_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE CASCADE;

--
-- Name: agent_messages agent_messages_conversation_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.agent_messages
    ADD CONSTRAINT agent_messages_conversation_id_fkey FOREIGN KEY (conversation_id) REFERENCES public.agent_conversations(id) ON DELETE CASCADE;

--
-- Name: agent_messages agent_messages_in_reply_to_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.agent_messages
    ADD CONSTRAINT agent_messages_in_reply_to_fkey FOREIGN KEY (in_reply_to) REFERENCES public.agent_messages(id) ON DELETE SET NULL;

--
-- Name: agent_messages agent_messages_workspace_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.agent_messages
    ADD CONSTRAINT agent_messages_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE CASCADE;

--
-- Name: agents agents_module_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.agents
    ADD CONSTRAINT agents_module_fk FOREIGN KEY (module) REFERENCES public.modules(key) ON UPDATE CASCADE;

--
-- Name: agents agents_workspace_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.agents
    ADD CONSTRAINT agents_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE CASCADE;

--
-- Name: ai_generations ai_generations_workspace_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_generations
    ADD CONSTRAINT ai_generations_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE CASCADE;

--
-- Name: ai_quota_overrides ai_quota_overrides_workspace_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_quota_overrides
    ADD CONSTRAINT ai_quota_overrides_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE CASCADE;

--
-- Name: ai_usage_events ai_usage_events_workspace_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_usage_events
    ADD CONSTRAINT ai_usage_events_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE CASCADE;

--
-- Name: ai_usage_notices ai_usage_notices_workspace_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ai_usage_notices
    ADD CONSTRAINT ai_usage_notices_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE CASCADE;

--
-- Name: api_rate_limits api_rate_limits_key_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.api_rate_limits
    ADD CONSTRAINT api_rate_limits_key_id_fkey FOREIGN KEY (key_id) REFERENCES public.api_keys(id) ON DELETE CASCADE;

--
-- Name: app_commands app_commands_requested_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.app_commands
    ADD CONSTRAINT app_commands_requested_by_fkey FOREIGN KEY (requested_by) REFERENCES auth.users(id) ON DELETE CASCADE;

--
-- Name: app_commands app_commands_workspace_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.app_commands
    ADD CONSTRAINT app_commands_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE CASCADE;

--
-- Name: app_errors app_errors_workspace_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.app_errors
    ADD CONSTRAINT app_errors_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE SET NULL;

--
-- Name: authority_actions authority_actions_module_key_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.authority_actions
    ADD CONSTRAINT authority_actions_module_key_fkey FOREIGN KEY (module_key) REFERENCES public.modules(key) ON UPDATE CASCADE;

--
-- Name: authority_rules authority_rules_action_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.authority_rules
    ADD CONSTRAINT authority_rules_action_fk FOREIGN KEY (department, action) REFERENCES public.authority_actions(module_key, action) ON UPDATE CASCADE;

--
-- Name: authority_rules authority_rules_department_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.authority_rules
    ADD CONSTRAINT authority_rules_department_fk FOREIGN KEY (department) REFERENCES public.modules(key) ON UPDATE CASCADE;

--
-- Name: authority_rules authority_rules_workspace_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.authority_rules
    ADD CONSTRAINT authority_rules_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE CASCADE;

--
-- Name: authority authority_workspace_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.authority
    ADD CONSTRAINT authority_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE CASCADE;

--
-- Name: automation_commands automation_commands_workspace_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.automation_commands
    ADD CONSTRAINT automation_commands_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE CASCADE;

--
-- Name: automation_pipelines automation_pipelines_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.automation_pipelines
    ADD CONSTRAINT automation_pipelines_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;

--
-- Name: automation_pipelines automation_pipelines_module_key_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.automation_pipelines
    ADD CONSTRAINT automation_pipelines_module_key_fk FOREIGN KEY (module_key) REFERENCES public.modules(key) ON UPDATE CASCADE;

--
-- Name: automation_pipelines automation_pipelines_workspace_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.automation_pipelines
    ADD CONSTRAINT automation_pipelines_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE CASCADE;

--
-- Name: automation_runs automation_runs_pipeline_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.automation_runs
    ADD CONSTRAINT automation_runs_pipeline_id_fkey FOREIGN KEY (pipeline_id) REFERENCES public.automation_pipelines(id) ON DELETE CASCADE;

--
-- Name: automation_runs automation_runs_workspace_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.automation_runs
    ADD CONSTRAINT automation_runs_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE CASCADE;

--
-- Name: billing_events billing_events_workspace_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.billing_events
    ADD CONSTRAINT billing_events_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE CASCADE;

--
-- Name: booking_exceptions booking_exceptions_resource_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.booking_exceptions
    ADD CONSTRAINT booking_exceptions_resource_id_fkey FOREIGN KEY (resource_id) REFERENCES public.booking_resources(id) ON DELETE CASCADE;

--
-- Name: booking_exceptions booking_exceptions_workspace_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.booking_exceptions
    ADD CONSTRAINT booking_exceptions_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE CASCADE;

--
-- Name: booking_hours booking_hours_resource_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.booking_hours
    ADD CONSTRAINT booking_hours_resource_id_fkey FOREIGN KEY (resource_id) REFERENCES public.booking_resources(id) ON DELETE CASCADE;

--
-- Name: booking_hours booking_hours_workspace_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.booking_hours
    ADD CONSTRAINT booking_hours_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE CASCADE;

--
-- Name: booking_reminders booking_reminders_booking_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.booking_reminders
    ADD CONSTRAINT booking_reminders_booking_id_fkey FOREIGN KEY (booking_id) REFERENCES public.bookings(id) ON DELETE CASCADE;

--
-- Name: booking_reminders booking_reminders_work_item_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.booking_reminders
    ADD CONSTRAINT booking_reminders_work_item_id_fkey FOREIGN KEY (work_item_id) REFERENCES public.work_items(id) ON DELETE SET NULL;

--
-- Name: booking_reminders booking_reminders_workspace_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.booking_reminders
    ADD CONSTRAINT booking_reminders_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE CASCADE;

--
-- Name: booking_resources booking_resources_staff_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.booking_resources
    ADD CONSTRAINT booking_resources_staff_id_fkey FOREIGN KEY (staff_id) REFERENCES public.staff(id) ON DELETE SET NULL;

--
-- Name: booking_resources booking_resources_workspace_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.booking_resources
    ADD CONSTRAINT booking_resources_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE CASCADE;

--
-- Name: booking_services booking_services_workspace_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.booking_services
    ADD CONSTRAINT booking_services_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE CASCADE;

--
-- Name: booking_settings booking_settings_workspace_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.booking_settings
    ADD CONSTRAINT booking_settings_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE CASCADE;

--
-- Name: booking_waitlist booking_waitlist_conversation_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.booking_waitlist
    ADD CONSTRAINT booking_waitlist_conversation_id_fkey FOREIGN KEY (conversation_id) REFERENCES public.agent_conversations(id) ON DELETE SET NULL;

--
-- Name: booking_waitlist booking_waitlist_lead_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.booking_waitlist
    ADD CONSTRAINT booking_waitlist_lead_id_fkey FOREIGN KEY (lead_id) REFERENCES public.leads(id) ON DELETE SET NULL;

--
-- Name: booking_waitlist booking_waitlist_resource_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.booking_waitlist
    ADD CONSTRAINT booking_waitlist_resource_id_fkey FOREIGN KEY (resource_id) REFERENCES public.booking_resources(id) ON DELETE SET NULL;

--
-- Name: booking_waitlist booking_waitlist_service_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.booking_waitlist
    ADD CONSTRAINT booking_waitlist_service_id_fkey FOREIGN KEY (service_id) REFERENCES public.booking_services(id) ON DELETE CASCADE;

--
-- Name: booking_waitlist booking_waitlist_workspace_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.booking_waitlist
    ADD CONSTRAINT booking_waitlist_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE CASCADE;

--
-- Name: bookings bookings_conversation_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bookings
    ADD CONSTRAINT bookings_conversation_id_fkey FOREIGN KEY (conversation_id) REFERENCES public.agent_conversations(id) ON DELETE SET NULL;

--
-- Name: bookings bookings_installation_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bookings
    ADD CONSTRAINT bookings_installation_id_fkey FOREIGN KEY (installation_id) REFERENCES public.module_installations(id) ON DELETE SET NULL;

--
-- Name: bookings bookings_lead_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bookings
    ADD CONSTRAINT bookings_lead_id_fkey FOREIGN KEY (lead_id) REFERENCES public.leads(id) ON DELETE SET NULL;

--
-- Name: bookings bookings_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bookings
    ADD CONSTRAINT bookings_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.orders(id) ON DELETE SET NULL;

--
-- Name: bookings bookings_resource_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bookings
    ADD CONSTRAINT bookings_resource_id_fkey FOREIGN KEY (resource_id) REFERENCES public.booking_resources(id) ON DELETE RESTRICT;

--
-- Name: bookings bookings_service_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bookings
    ADD CONSTRAINT bookings_service_id_fkey FOREIGN KEY (service_id) REFERENCES public.booking_services(id) ON DELETE RESTRICT;

--
-- Name: bookings bookings_work_item_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bookings
    ADD CONSTRAINT bookings_work_item_id_fkey FOREIGN KEY (work_item_id) REFERENCES public.work_items(id) ON DELETE SET NULL;

--
-- Name: bookings bookings_workspace_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bookings
    ADD CONSTRAINT bookings_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE CASCADE;

--
-- Name: brain_commands brain_commands_workspace_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.brain_commands
    ADD CONSTRAINT brain_commands_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE CASCADE;

--
-- Name: brain_eval_cases brain_eval_cases_workspace_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.brain_eval_cases
    ADD CONSTRAINT brain_eval_cases_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE CASCADE;

--
-- Name: brain_extractions brain_extractions_source_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.brain_extractions
    ADD CONSTRAINT brain_extractions_source_id_fkey FOREIGN KEY (source_id) REFERENCES public.knowledge_sources(id) ON DELETE CASCADE;

--
-- Name: brain_extractions brain_extractions_workspace_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.brain_extractions
    ADD CONSTRAINT brain_extractions_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE CASCADE;

--
-- Name: brain_facts brain_facts_conflict_with_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.brain_facts
    ADD CONSTRAINT brain_facts_conflict_with_fkey FOREIGN KEY (conflict_with) REFERENCES public.brain_facts(id) ON DELETE SET NULL;

--
-- Name: brain_facts brain_facts_installation_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.brain_facts
    ADD CONSTRAINT brain_facts_installation_id_fkey FOREIGN KEY (installation_id) REFERENCES public.module_installations(id) ON DELETE CASCADE;

--
-- Name: brain_facts brain_facts_supersedes_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.brain_facts
    ADD CONSTRAINT brain_facts_supersedes_id_fkey FOREIGN KEY (supersedes_id) REFERENCES public.brain_facts(id) ON DELETE SET NULL;

--
-- Name: brain_facts brain_facts_workspace_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.brain_facts
    ADD CONSTRAINT brain_facts_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE CASCADE;

--
-- Name: brain_lessons brain_lessons_supersedes_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.brain_lessons
    ADD CONSTRAINT brain_lessons_supersedes_id_fkey FOREIGN KEY (supersedes_id) REFERENCES public.brain_lessons(id) ON DELETE SET NULL;

--
-- Name: brain_lessons brain_lessons_workspace_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.brain_lessons
    ADD CONSTRAINT brain_lessons_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE CASCADE;

--
-- Name: brain_source_profiles brain_source_profiles_connection_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.brain_source_profiles
    ADD CONSTRAINT brain_source_profiles_connection_id_fkey FOREIGN KEY (connection_id) REFERENCES public.connections(id) ON DELETE CASCADE;

--
-- Name: brain_source_profiles brain_source_profiles_workspace_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.brain_source_profiles
    ADD CONSTRAINT brain_source_profiles_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE CASCADE;

--
-- Name: channel_receipts channel_receipts_workspace_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.channel_receipts
    ADD CONSTRAINT channel_receipts_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE CASCADE;

--
-- Name: connection_commands connection_commands_workspace_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.connection_commands
    ADD CONSTRAINT connection_commands_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE CASCADE;

--
-- Name: connection_secrets connection_secrets_connection_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.connection_secrets
    ADD CONSTRAINT connection_secrets_connection_id_fkey FOREIGN KEY (connection_id) REFERENCES public.connections(id) ON DELETE CASCADE;

--
-- Name: connections connections_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.connections
    ADD CONSTRAINT connections_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;

--
-- Name: connections connections_workspace_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.connections
    ADD CONSTRAINT connections_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE CASCADE;

--
-- Name: connector_interest connector_interest_workspace_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.connector_interest
    ADD CONSTRAINT connector_interest_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE CASCADE;

--
-- Name: content_cadence content_cadence_workspace_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.content_cadence
    ADD CONSTRAINT content_cadence_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE CASCADE;

--
-- Name: content_items content_items_pillar_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.content_items
    ADD CONSTRAINT content_items_pillar_id_fkey FOREIGN KEY (pillar_id) REFERENCES public.content_pillars(id) ON DELETE SET NULL;

--
-- Name: content_items content_items_plan_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.content_items
    ADD CONSTRAINT content_items_plan_id_fkey FOREIGN KEY (plan_id) REFERENCES public.content_plans(id) ON DELETE SET NULL;

--
-- Name: content_items content_items_workspace_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.content_items
    ADD CONSTRAINT content_items_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE CASCADE;

--
-- Name: content_pillars content_pillars_workspace_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.content_pillars
    ADD CONSTRAINT content_pillars_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE CASCADE;

--
-- Name: content_plans content_plans_workspace_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.content_plans
    ADD CONSTRAINT content_plans_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE CASCADE;

--
-- Name: content_settings content_settings_workspace_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.content_settings
    ADD CONSTRAINT content_settings_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE CASCADE;

--
-- Name: contracts contracts_lead_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contracts
    ADD CONSTRAINT contracts_lead_id_fkey FOREIGN KEY (lead_id) REFERENCES public.leads(id) ON DELETE SET NULL;

--
-- Name: contracts contracts_workspace_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contracts
    ADD CONSTRAINT contracts_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE CASCADE;

--
-- Name: credit_pack_purchases credit_pack_purchases_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.credit_pack_purchases
    ADD CONSTRAINT credit_pack_purchases_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.payment_orders(id);

--
-- Name: credit_pack_purchases credit_pack_purchases_workspace_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.credit_pack_purchases
    ADD CONSTRAINT credit_pack_purchases_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE CASCADE;

--
-- Name: credit_topup_draws credit_topup_draws_workspace_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.credit_topup_draws
    ADD CONSTRAINT credit_topup_draws_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE CASCADE;

--
-- Name: credit_topups credit_topups_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.credit_topups
    ADD CONSTRAINT credit_topups_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.payment_orders(id);

--
-- Name: credit_topups credit_topups_workspace_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.credit_topups
    ADD CONSTRAINT credit_topups_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE CASCADE;

--
-- Name: data_records data_records_connection_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.data_records
    ADD CONSTRAINT data_records_connection_id_fkey FOREIGN KEY (connection_id) REFERENCES public.connections(id) ON DELETE CASCADE;

--
-- Name: data_records data_records_workspace_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.data_records
    ADD CONSTRAINT data_records_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE CASCADE;

--
-- Name: data_sync_runs data_sync_runs_connection_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.data_sync_runs
    ADD CONSTRAINT data_sync_runs_connection_id_fkey FOREIGN KEY (connection_id) REFERENCES public.connections(id) ON DELETE CASCADE;

--
-- Name: data_sync_runs data_sync_runs_workspace_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.data_sync_runs
    ADD CONSTRAINT data_sync_runs_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE CASCADE;

--
-- Name: decisions decisions_lead_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.decisions
    ADD CONSTRAINT decisions_lead_id_fkey FOREIGN KEY (lead_id) REFERENCES public.leads(id) ON DELETE SET NULL;

--
-- Name: decisions decisions_work_item_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.decisions
    ADD CONSTRAINT decisions_work_item_id_fkey FOREIGN KEY (work_item_id) REFERENCES public.work_items(id) ON DELETE CASCADE;

--
-- Name: decisions decisions_workspace_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.decisions
    ADD CONSTRAINT decisions_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE CASCADE;

--
-- Name: email_messages email_messages_connection_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.email_messages
    ADD CONSTRAINT email_messages_connection_id_fkey FOREIGN KEY (connection_id) REFERENCES public.connections(id) ON DELETE SET NULL;

--
-- Name: email_messages email_messages_workspace_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.email_messages
    ADD CONSTRAINT email_messages_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE CASCADE;

--
-- Name: events events_lead_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.events
    ADD CONSTRAINT events_lead_id_fkey FOREIGN KEY (lead_id) REFERENCES public.leads(id) ON DELETE CASCADE;

--
-- Name: events events_work_item_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.events
    ADD CONSTRAINT events_work_item_id_fkey FOREIGN KEY (work_item_id) REFERENCES public.work_items(id) ON DELETE SET NULL;

--
-- Name: events events_workspace_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.events
    ADD CONSTRAINT events_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE CASCADE;

--
-- Name: executions executions_agent_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.executions
    ADD CONSTRAINT executions_agent_id_fkey FOREIGN KEY (agent_id) REFERENCES public.agents(id) ON DELETE SET NULL;

--
-- Name: executions executions_responsibility_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.executions
    ADD CONSTRAINT executions_responsibility_id_fkey FOREIGN KEY (responsibility_id) REFERENCES public.responsibilities(id) ON DELETE CASCADE;

--
-- Name: executions executions_work_item_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.executions
    ADD CONSTRAINT executions_work_item_id_fkey FOREIGN KEY (work_item_id) REFERENCES public.work_items(id) ON DELETE SET NULL;

--
-- Name: executions executions_workspace_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.executions
    ADD CONSTRAINT executions_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE CASCADE;

--
-- Name: hiring_availability hiring_availability_member_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hiring_availability
    ADD CONSTRAINT hiring_availability_member_user_id_fkey FOREIGN KEY (member_user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

--
-- Name: hiring_availability hiring_availability_workspace_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hiring_availability
    ADD CONSTRAINT hiring_availability_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE CASCADE;

--
-- Name: hiring_candidates hiring_candidates_conversation_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hiring_candidates
    ADD CONSTRAINT hiring_candidates_conversation_id_fkey FOREIGN KEY (conversation_id) REFERENCES public.agent_conversations(id) ON DELETE SET NULL;

--
-- Name: hiring_candidates hiring_candidates_job_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hiring_candidates
    ADD CONSTRAINT hiring_candidates_job_id_fkey FOREIGN KEY (job_id) REFERENCES public.hiring_jobs(id) ON DELETE CASCADE;

--
-- Name: hiring_candidates hiring_candidates_workspace_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hiring_candidates
    ADD CONSTRAINT hiring_candidates_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE CASCADE;

--
-- Name: hiring_consents hiring_consents_candidate_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hiring_consents
    ADD CONSTRAINT hiring_consents_candidate_id_fkey FOREIGN KEY (candidate_id) REFERENCES public.hiring_candidates(id) ON DELETE CASCADE;

--
-- Name: hiring_consents hiring_consents_workspace_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hiring_consents
    ADD CONSTRAINT hiring_consents_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE CASCADE;

--
-- Name: hiring_events hiring_events_candidate_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hiring_events
    ADD CONSTRAINT hiring_events_candidate_id_fkey FOREIGN KEY (candidate_id) REFERENCES public.hiring_candidates(id) ON DELETE CASCADE;

--
-- Name: hiring_events hiring_events_workspace_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hiring_events
    ADD CONSTRAINT hiring_events_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE CASCADE;

--
-- Name: hiring_interviews hiring_interviews_candidate_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hiring_interviews
    ADD CONSTRAINT hiring_interviews_candidate_id_fkey FOREIGN KEY (candidate_id) REFERENCES public.hiring_candidates(id) ON DELETE CASCADE;

--
-- Name: hiring_interviews hiring_interviews_interviewer_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hiring_interviews
    ADD CONSTRAINT hiring_interviews_interviewer_user_id_fkey FOREIGN KEY (interviewer_user_id) REFERENCES auth.users(id) ON DELETE SET NULL;

--
-- Name: hiring_interviews hiring_interviews_job_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hiring_interviews
    ADD CONSTRAINT hiring_interviews_job_id_fkey FOREIGN KEY (job_id) REFERENCES public.hiring_jobs(id) ON DELETE CASCADE;

--
-- Name: hiring_interviews hiring_interviews_work_item_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hiring_interviews
    ADD CONSTRAINT hiring_interviews_work_item_id_fkey FOREIGN KEY (work_item_id) REFERENCES public.work_items(id) ON DELETE SET NULL;

--
-- Name: hiring_interviews hiring_interviews_workspace_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hiring_interviews
    ADD CONSTRAINT hiring_interviews_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE CASCADE;

--
-- Name: hiring_jobs hiring_jobs_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hiring_jobs
    ADD CONSTRAINT hiring_jobs_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;

--
-- Name: hiring_jobs hiring_jobs_workspace_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hiring_jobs
    ADD CONSTRAINT hiring_jobs_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE CASCADE;

--
-- Name: hiring_offers hiring_offers_candidate_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hiring_offers
    ADD CONSTRAINT hiring_offers_candidate_id_fkey FOREIGN KEY (candidate_id) REFERENCES public.hiring_candidates(id) ON DELETE CASCADE;

--
-- Name: hiring_offers hiring_offers_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hiring_offers
    ADD CONSTRAINT hiring_offers_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;

--
-- Name: hiring_offers hiring_offers_job_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hiring_offers
    ADD CONSTRAINT hiring_offers_job_id_fkey FOREIGN KEY (job_id) REFERENCES public.hiring_jobs(id) ON DELETE CASCADE;

--
-- Name: hiring_offers hiring_offers_work_item_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hiring_offers
    ADD CONSTRAINT hiring_offers_work_item_id_fkey FOREIGN KEY (work_item_id) REFERENCES public.work_items(id) ON DELETE SET NULL;

--
-- Name: hiring_offers hiring_offers_workspace_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hiring_offers
    ADD CONSTRAINT hiring_offers_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE CASCADE;

--
-- Name: hiring_onboarding hiring_onboarding_candidate_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hiring_onboarding
    ADD CONSTRAINT hiring_onboarding_candidate_id_fkey FOREIGN KEY (candidate_id) REFERENCES public.hiring_candidates(id) ON DELETE CASCADE;

--
-- Name: hiring_onboarding hiring_onboarding_workspace_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hiring_onboarding
    ADD CONSTRAINT hiring_onboarding_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE CASCADE;

--
-- Name: hiring_retention_log hiring_retention_log_workspace_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hiring_retention_log
    ADD CONSTRAINT hiring_retention_log_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE CASCADE;

--
-- Name: hiring_settings hiring_settings_workspace_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hiring_settings
    ADD CONSTRAINT hiring_settings_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE CASCADE;

--
-- Name: inbound_events inbound_events_lead_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inbound_events
    ADD CONSTRAINT inbound_events_lead_id_fkey FOREIGN KEY (lead_id) REFERENCES public.leads(id) ON DELETE SET NULL;

--
-- Name: inbound_events inbound_events_workspace_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inbound_events
    ADD CONSTRAINT inbound_events_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE CASCADE;

--
-- Name: inventory_items inventory_items_supplier_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_items
    ADD CONSTRAINT inventory_items_supplier_id_fkey FOREIGN KEY (supplier_id) REFERENCES public.inventory_suppliers(id) ON DELETE SET NULL;

--
-- Name: inventory_items inventory_items_workspace_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_items
    ADD CONSTRAINT inventory_items_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE CASCADE;

--
-- Name: inventory_locations inventory_locations_workspace_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_locations
    ADD CONSTRAINT inventory_locations_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE CASCADE;

--
-- Name: inventory_movements inventory_movements_item_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_movements
    ADD CONSTRAINT inventory_movements_item_id_fkey FOREIGN KEY (item_id) REFERENCES public.inventory_items(id) ON DELETE CASCADE;

--
-- Name: inventory_movements inventory_movements_location_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_movements
    ADD CONSTRAINT inventory_movements_location_id_fkey FOREIGN KEY (location_id) REFERENCES public.inventory_locations(id) ON DELETE CASCADE;

--
-- Name: inventory_movements inventory_movements_workspace_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_movements
    ADD CONSTRAINT inventory_movements_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE CASCADE;

--
-- Name: inventory_po_lines inventory_po_lines_item_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_po_lines
    ADD CONSTRAINT inventory_po_lines_item_id_fkey FOREIGN KEY (item_id) REFERENCES public.inventory_items(id) ON DELETE RESTRICT;

--
-- Name: inventory_po_lines inventory_po_lines_po_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_po_lines
    ADD CONSTRAINT inventory_po_lines_po_id_fkey FOREIGN KEY (po_id) REFERENCES public.inventory_purchase_orders(id) ON DELETE CASCADE;

--
-- Name: inventory_po_lines inventory_po_lines_workspace_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_po_lines
    ADD CONSTRAINT inventory_po_lines_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE CASCADE;

--
-- Name: inventory_purchase_orders inventory_purchase_orders_supplier_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_purchase_orders
    ADD CONSTRAINT inventory_purchase_orders_supplier_id_fkey FOREIGN KEY (supplier_id) REFERENCES public.inventory_suppliers(id) ON DELETE SET NULL;

--
-- Name: inventory_purchase_orders inventory_purchase_orders_workspace_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_purchase_orders
    ADD CONSTRAINT inventory_purchase_orders_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE CASCADE;

--
-- Name: inventory_receipts inventory_receipts_po_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_receipts
    ADD CONSTRAINT inventory_receipts_po_id_fkey FOREIGN KEY (po_id) REFERENCES public.inventory_purchase_orders(id) ON DELETE CASCADE;

--
-- Name: inventory_receipts inventory_receipts_workspace_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_receipts
    ADD CONSTRAINT inventory_receipts_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE CASCADE;

--
-- Name: inventory_recipe_lines inventory_recipe_lines_item_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_recipe_lines
    ADD CONSTRAINT inventory_recipe_lines_item_id_fkey FOREIGN KEY (item_id) REFERENCES public.inventory_items(id) ON DELETE CASCADE;

--
-- Name: inventory_recipe_lines inventory_recipe_lines_recipe_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_recipe_lines
    ADD CONSTRAINT inventory_recipe_lines_recipe_id_fkey FOREIGN KEY (recipe_id) REFERENCES public.inventory_recipes(id) ON DELETE CASCADE;

--
-- Name: inventory_recipe_lines inventory_recipe_lines_workspace_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_recipe_lines
    ADD CONSTRAINT inventory_recipe_lines_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE CASCADE;

--
-- Name: inventory_recipes inventory_recipes_workspace_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_recipes
    ADD CONSTRAINT inventory_recipes_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE CASCADE;

--
-- Name: inventory_stock_levels inventory_stock_levels_item_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_stock_levels
    ADD CONSTRAINT inventory_stock_levels_item_id_fkey FOREIGN KEY (item_id) REFERENCES public.inventory_items(id) ON DELETE CASCADE;

--
-- Name: inventory_stock_levels inventory_stock_levels_location_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_stock_levels
    ADD CONSTRAINT inventory_stock_levels_location_id_fkey FOREIGN KEY (location_id) REFERENCES public.inventory_locations(id) ON DELETE CASCADE;

--
-- Name: inventory_stock_levels inventory_stock_levels_workspace_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_stock_levels
    ADD CONSTRAINT inventory_stock_levels_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE CASCADE;

--
-- Name: inventory_suppliers inventory_suppliers_workspace_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_suppliers
    ADD CONSTRAINT inventory_suppliers_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE CASCADE;

--
-- Name: invoices invoices_lead_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.invoices
    ADD CONSTRAINT invoices_lead_id_fkey FOREIGN KEY (lead_id) REFERENCES public.leads(id) ON DELETE SET NULL;

--
-- Name: invoices invoices_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.invoices
    ADD CONSTRAINT invoices_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.orders(id) ON DELETE SET NULL;

--
-- Name: invoices invoices_workspace_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.invoices
    ADD CONSTRAINT invoices_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE CASCADE;

--
-- Name: job_outbox job_outbox_workspace_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.job_outbox
    ADD CONSTRAINT job_outbox_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE CASCADE;

--
-- Name: knowledge_chunks knowledge_chunks_module_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.knowledge_chunks
    ADD CONSTRAINT knowledge_chunks_module_fk FOREIGN KEY (module) REFERENCES public.modules(key) ON UPDATE CASCADE;

--
-- Name: knowledge_chunks knowledge_chunks_source_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.knowledge_chunks
    ADD CONSTRAINT knowledge_chunks_source_id_fkey FOREIGN KEY (source_id) REFERENCES public.knowledge_sources(id) ON DELETE CASCADE;

--
-- Name: knowledge_chunks knowledge_chunks_workspace_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.knowledge_chunks
    ADD CONSTRAINT knowledge_chunks_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE CASCADE;

--
-- Name: knowledge_gaps knowledge_gaps_example_conversation_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.knowledge_gaps
    ADD CONSTRAINT knowledge_gaps_example_conversation_id_fkey FOREIGN KEY (example_conversation_id) REFERENCES public.agent_conversations(id) ON DELETE SET NULL;

--
-- Name: knowledge_gaps knowledge_gaps_workspace_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.knowledge_gaps
    ADD CONSTRAINT knowledge_gaps_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE CASCADE;

--
-- Name: knowledge_sources knowledge_sources_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.knowledge_sources
    ADD CONSTRAINT knowledge_sources_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;

--
-- Name: knowledge_sources knowledge_sources_installation_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.knowledge_sources
    ADD CONSTRAINT knowledge_sources_installation_id_fkey FOREIGN KEY (installation_id) REFERENCES public.module_installations(id) ON DELETE CASCADE;

--
-- Name: knowledge_sources knowledge_sources_module_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.knowledge_sources
    ADD CONSTRAINT knowledge_sources_module_fk FOREIGN KEY (module) REFERENCES public.modules(key) ON UPDATE CASCADE;

--
-- Name: knowledge_sources knowledge_sources_workspace_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.knowledge_sources
    ADD CONSTRAINT knowledge_sources_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE CASCADE;

--
-- Name: knowledge_suggestion_state knowledge_suggestion_state_decided_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.knowledge_suggestion_state
    ADD CONSTRAINT knowledge_suggestion_state_decided_by_fkey FOREIGN KEY (decided_by) REFERENCES auth.users(id) ON DELETE SET NULL;

--
-- Name: knowledge_suggestion_state knowledge_suggestion_state_workspace_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.knowledge_suggestion_state
    ADD CONSTRAINT knowledge_suggestion_state_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE CASCADE;

--
-- Name: lead_actions lead_actions_requested_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lead_actions
    ADD CONSTRAINT lead_actions_requested_by_fkey FOREIGN KEY (requested_by) REFERENCES auth.users(id);

--
-- Name: lead_actions lead_actions_workspace_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lead_actions
    ADD CONSTRAINT lead_actions_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE CASCADE;

--
-- Name: lead_flows lead_flows_connection_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lead_flows
    ADD CONSTRAINT lead_flows_connection_id_fkey FOREIGN KEY (connection_id) REFERENCES public.connections(id) ON DELETE SET NULL;

--
-- Name: lead_flows lead_flows_conversation_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lead_flows
    ADD CONSTRAINT lead_flows_conversation_id_fkey FOREIGN KEY (conversation_id) REFERENCES public.agent_conversations(id) ON DELETE SET NULL;

--
-- Name: lead_flows lead_flows_installation_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lead_flows
    ADD CONSTRAINT lead_flows_installation_id_fkey FOREIGN KEY (installation_id) REFERENCES public.module_installations(id) ON DELETE SET NULL;

--
-- Name: lead_flows lead_flows_lead_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lead_flows
    ADD CONSTRAINT lead_flows_lead_id_fkey FOREIGN KEY (lead_id) REFERENCES public.leads(id) ON DELETE CASCADE;

--
-- Name: lead_flows lead_flows_workspace_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lead_flows
    ADD CONSTRAINT lead_flows_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE CASCADE;

--
-- Name: leads leads_installation_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.leads
    ADD CONSTRAINT leads_installation_id_fkey FOREIGN KEY (installation_id) REFERENCES public.module_installations(id) ON DELETE SET NULL;

--
-- Name: leads leads_workspace_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.leads
    ADD CONSTRAINT leads_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE CASCADE;

--
-- Name: loyalty_campaigns loyalty_campaigns_workspace_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.loyalty_campaigns
    ADD CONSTRAINT loyalty_campaigns_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE CASCADE;

--
-- Name: loyalty_customer_links loyalty_customer_links_customer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.loyalty_customer_links
    ADD CONSTRAINT loyalty_customer_links_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.loyalty_customers(id) ON DELETE CASCADE;

--
-- Name: loyalty_customer_links loyalty_customer_links_workspace_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.loyalty_customer_links
    ADD CONSTRAINT loyalty_customer_links_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE CASCADE;

--
-- Name: loyalty_customers loyalty_customers_workspace_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.loyalty_customers
    ADD CONSTRAINT loyalty_customers_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE CASCADE;

--
-- Name: loyalty_ledger loyalty_ledger_customer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.loyalty_ledger
    ADD CONSTRAINT loyalty_ledger_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.loyalty_customers(id) ON DELETE CASCADE;

--
-- Name: loyalty_ledger loyalty_ledger_reward_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.loyalty_ledger
    ADD CONSTRAINT loyalty_ledger_reward_id_fkey FOREIGN KEY (reward_id) REFERENCES public.loyalty_rewards(id) ON DELETE SET NULL;

--
-- Name: loyalty_ledger loyalty_ledger_workspace_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.loyalty_ledger
    ADD CONSTRAINT loyalty_ledger_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE CASCADE;

--
-- Name: loyalty_otps loyalty_otps_customer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.loyalty_otps
    ADD CONSTRAINT loyalty_otps_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.loyalty_customers(id) ON DELETE CASCADE;

--
-- Name: loyalty_otps loyalty_otps_workspace_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.loyalty_otps
    ADD CONSTRAINT loyalty_otps_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE CASCADE;

--
-- Name: loyalty_programs loyalty_programs_workspace_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.loyalty_programs
    ADD CONSTRAINT loyalty_programs_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE CASCADE;

--
-- Name: loyalty_rewards loyalty_rewards_workspace_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.loyalty_rewards
    ADD CONSTRAINT loyalty_rewards_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE CASCADE;

--
-- Name: loyalty_sends loyalty_sends_campaign_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.loyalty_sends
    ADD CONSTRAINT loyalty_sends_campaign_id_fkey FOREIGN KEY (campaign_id) REFERENCES public.loyalty_campaigns(id) ON DELETE CASCADE;

--
-- Name: loyalty_sends loyalty_sends_customer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.loyalty_sends
    ADD CONSTRAINT loyalty_sends_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.loyalty_customers(id) ON DELETE CASCADE;

--
-- Name: loyalty_sends loyalty_sends_workspace_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.loyalty_sends
    ADD CONSTRAINT loyalty_sends_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE CASCADE;

--
-- Name: messages messages_agent_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.messages
    ADD CONSTRAINT messages_agent_id_fkey FOREIGN KEY (agent_id) REFERENCES public.agents(id) ON DELETE SET NULL;

--
-- Name: messages messages_lead_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.messages
    ADD CONSTRAINT messages_lead_id_fkey FOREIGN KEY (lead_id) REFERENCES public.leads(id) ON DELETE SET NULL;

--
-- Name: messages messages_staff_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.messages
    ADD CONSTRAINT messages_staff_id_fkey FOREIGN KEY (staff_id) REFERENCES public.staff(id) ON DELETE SET NULL;

--
-- Name: messages messages_work_item_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.messages
    ADD CONSTRAINT messages_work_item_id_fkey FOREIGN KEY (work_item_id) REFERENCES public.work_items(id) ON DELETE SET NULL;

--
-- Name: messages messages_workspace_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.messages
    ADD CONSTRAINT messages_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE CASCADE;

--
-- Name: meta_comments meta_comments_connection_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.meta_comments
    ADD CONSTRAINT meta_comments_connection_id_fkey FOREIGN KEY (connection_id) REFERENCES public.connections(id) ON DELETE CASCADE;

--
-- Name: meta_threads meta_threads_connection_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.meta_threads
    ADD CONSTRAINT meta_threads_connection_id_fkey FOREIGN KEY (connection_id) REFERENCES public.connections(id) ON DELETE CASCADE;

--
-- Name: module_context_notes module_context_notes_author_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.module_context_notes
    ADD CONSTRAINT module_context_notes_author_user_id_fkey FOREIGN KEY (author_user_id) REFERENCES auth.users(id) ON DELETE SET NULL;

--
-- Name: module_context_notes module_context_notes_installation_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.module_context_notes
    ADD CONSTRAINT module_context_notes_installation_id_fkey FOREIGN KEY (installation_id) REFERENCES public.module_installations(id) ON DELETE CASCADE;

--
-- Name: module_context_notes module_context_notes_workspace_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.module_context_notes
    ADD CONSTRAINT module_context_notes_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE CASCADE;

--
-- Name: module_context_versions module_context_versions_installation_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.module_context_versions
    ADD CONSTRAINT module_context_versions_installation_id_fkey FOREIGN KEY (installation_id) REFERENCES public.module_installations(id) ON DELETE CASCADE;

--
-- Name: module_context_versions module_context_versions_workspace_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.module_context_versions
    ADD CONSTRAINT module_context_versions_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE CASCADE;

--
-- Name: module_installations module_installations_active_version_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.module_installations
    ADD CONSTRAINT module_installations_active_version_fk FOREIGN KEY (active_context_version_id) REFERENCES public.module_context_versions(id) ON DELETE SET NULL;

--
-- Name: module_installations module_installations_agent_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.module_installations
    ADD CONSTRAINT module_installations_agent_id_fkey FOREIGN KEY (agent_id) REFERENCES public.agents(id) ON DELETE SET NULL;

--
-- Name: module_installations module_installations_module_key_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.module_installations
    ADD CONSTRAINT module_installations_module_key_fk FOREIGN KEY (module_key) REFERENCES public.modules(key) ON UPDATE CASCADE;

--
-- Name: module_installations module_installations_workspace_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.module_installations
    ADD CONSTRAINT module_installations_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE CASCADE;

--
-- Name: module_setup_messages module_setup_messages_setup_session_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.module_setup_messages
    ADD CONSTRAINT module_setup_messages_setup_session_id_fkey FOREIGN KEY (setup_session_id) REFERENCES public.module_setup_sessions(id) ON DELETE CASCADE;

--
-- Name: module_setup_messages module_setup_messages_workspace_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.module_setup_messages
    ADD CONSTRAINT module_setup_messages_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE CASCADE;

--
-- Name: module_setup_sessions module_setup_sessions_installation_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.module_setup_sessions
    ADD CONSTRAINT module_setup_sessions_installation_id_fkey FOREIGN KEY (installation_id) REFERENCES public.module_installations(id) ON DELETE CASCADE;

--
-- Name: module_setup_sessions module_setup_sessions_workspace_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.module_setup_sessions
    ADD CONSTRAINT module_setup_sessions_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE CASCADE;

--
-- Name: module_setup_writes module_setup_writes_setup_session_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.module_setup_writes
    ADD CONSTRAINT module_setup_writes_setup_session_id_fkey FOREIGN KEY (setup_session_id) REFERENCES public.module_setup_sessions(id) ON DELETE CASCADE;

--
-- Name: module_setup_writes module_setup_writes_source_message_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.module_setup_writes
    ADD CONSTRAINT module_setup_writes_source_message_id_fkey FOREIGN KEY (source_message_id) REFERENCES public.module_setup_messages(id) ON DELETE SET NULL;

--
-- Name: module_setup_writes module_setup_writes_workspace_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.module_setup_writes
    ADD CONSTRAINT module_setup_writes_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE CASCADE;

--
-- Name: n8n_pipelines n8n_pipelines_updated_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.n8n_pipelines
    ADD CONSTRAINT n8n_pipelines_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES auth.users(id) ON DELETE SET NULL;

--
-- Name: n8n_pipelines n8n_pipelines_workspace_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.n8n_pipelines
    ADD CONSTRAINT n8n_pipelines_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE CASCADE;

--
-- Name: n8n_runs n8n_runs_workspace_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.n8n_runs
    ADD CONSTRAINT n8n_runs_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE CASCADE;

--
-- Name: office_command_candidates office_command_candidates_message_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.office_command_candidates
    ADD CONSTRAINT office_command_candidates_message_id_fkey FOREIGN KEY (message_id) REFERENCES public.messages(id) ON DELETE CASCADE;

--
-- Name: office_command_candidates office_command_candidates_work_item_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.office_command_candidates
    ADD CONSTRAINT office_command_candidates_work_item_id_fkey FOREIGN KEY (work_item_id) REFERENCES public.work_items(id) ON DELETE SET NULL;

--
-- Name: office_command_candidates office_command_candidates_workspace_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.office_command_candidates
    ADD CONSTRAINT office_command_candidates_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE CASCADE;

--
-- Name: openclaw_agent_sync openclaw_agent_sync_installation_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.openclaw_agent_sync
    ADD CONSTRAINT openclaw_agent_sync_installation_id_fkey FOREIGN KEY (installation_id) REFERENCES public.module_installations(id) ON DELETE CASCADE;

--
-- Name: openclaw_agent_sync openclaw_agent_sync_workspace_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.openclaw_agent_sync
    ADD CONSTRAINT openclaw_agent_sync_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE CASCADE;

--
-- Name: orders orders_inbound_event_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.orders
    ADD CONSTRAINT orders_inbound_event_id_fkey FOREIGN KEY (inbound_event_id) REFERENCES public.inbound_events(id) ON DELETE SET NULL;

--
-- Name: orders orders_lead_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.orders
    ADD CONSTRAINT orders_lead_id_fkey FOREIGN KEY (lead_id) REFERENCES public.leads(id) ON DELETE SET NULL;

--
-- Name: orders orders_workspace_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.orders
    ADD CONSTRAINT orders_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE CASCADE;

--
-- Name: payment_order_requests payment_order_requests_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payment_order_requests
    ADD CONSTRAINT payment_order_requests_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.payment_orders(id) ON DELETE SET NULL;

--
-- Name: payment_order_requests payment_order_requests_workspace_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payment_order_requests
    ADD CONSTRAINT payment_order_requests_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE CASCADE;

--
-- Name: payment_orders payment_orders_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payment_orders
    ADD CONSTRAINT payment_orders_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;

--
-- Name: payment_orders payment_orders_pack_code_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payment_orders
    ADD CONSTRAINT payment_orders_pack_code_fkey FOREIGN KEY (pack_code) REFERENCES public.credit_packs(code);

--
-- Name: payment_orders payment_orders_plan_code_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payment_orders
    ADD CONSTRAINT payment_orders_plan_code_fkey FOREIGN KEY (plan_code) REFERENCES public.plans(code);

--
-- Name: payment_orders payment_orders_workspace_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payment_orders
    ADD CONSTRAINT payment_orders_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE CASCADE;

--
-- Name: plan_usage_tiers plan_usage_tiers_plan_code_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.plan_usage_tiers
    ADD CONSTRAINT plan_usage_tiers_plan_code_fkey FOREIGN KEY (plan_code) REFERENCES public.plans(code) ON DELETE CASCADE;

--
-- Name: platform_audit platform_audit_workspace_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.platform_audit
    ADD CONSTRAINT platform_audit_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE SET NULL;

--
-- Name: public_api public_api_key_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.public_api
    ADD CONSTRAINT public_api_key_id_fkey FOREIGN KEY (key_id) REFERENCES public.api_keys(id) ON DELETE CASCADE;

--
-- Name: public_api public_api_lead_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.public_api
    ADD CONSTRAINT public_api_lead_id_fkey FOREIGN KEY (lead_id) REFERENCES public.leads(id) ON DELETE SET NULL;

--
-- Name: public_api public_api_workspace_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.public_api
    ADD CONSTRAINT public_api_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE CASCADE;

--
-- Name: responsibilities responsibilities_lead_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.responsibilities
    ADD CONSTRAINT responsibilities_lead_id_fkey FOREIGN KEY (lead_id) REFERENCES public.leads(id) ON DELETE CASCADE;

--
-- Name: responsibilities responsibilities_owner_agent_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.responsibilities
    ADD CONSTRAINT responsibilities_owner_agent_id_fkey FOREIGN KEY (owner_agent_id) REFERENCES public.agents(id) ON DELETE SET NULL;

--
-- Name: responsibilities responsibilities_workspace_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.responsibilities
    ADD CONSTRAINT responsibilities_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE CASCADE;

--
-- Name: sepay_transactions sepay_transactions_matched_order_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sepay_transactions
    ADD CONSTRAINT sepay_transactions_matched_order_id_fkey FOREIGN KEY (matched_order_id) REFERENCES public.payment_orders(id) ON DELETE SET NULL;

--
-- Name: shifts_attendance shifts_attendance_shift_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.shifts_attendance
    ADD CONSTRAINT shifts_attendance_shift_id_fkey FOREIGN KEY (shift_id) REFERENCES public.shifts_shifts(id) ON DELETE CASCADE;

--
-- Name: shifts_attendance shifts_attendance_staff_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.shifts_attendance
    ADD CONSTRAINT shifts_attendance_staff_id_fkey FOREIGN KEY (staff_id) REFERENCES public.shifts_staff(id) ON DELETE CASCADE;

--
-- Name: shifts_attendance shifts_attendance_workspace_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.shifts_attendance
    ADD CONSTRAINT shifts_attendance_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE CASCADE;

--
-- Name: shifts_availability shifts_availability_staff_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.shifts_availability
    ADD CONSTRAINT shifts_availability_staff_id_fkey FOREIGN KEY (staff_id) REFERENCES public.shifts_staff(id) ON DELETE CASCADE;

--
-- Name: shifts_availability shifts_availability_workspace_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.shifts_availability
    ADD CONSTRAINT shifts_availability_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE CASCADE;

--
-- Name: shifts_coverage shifts_coverage_position_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.shifts_coverage
    ADD CONSTRAINT shifts_coverage_position_id_fkey FOREIGN KEY (position_id) REFERENCES public.shifts_positions(id) ON DELETE CASCADE;

--
-- Name: shifts_coverage shifts_coverage_workspace_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.shifts_coverage
    ADD CONSTRAINT shifts_coverage_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE CASCADE;

--
-- Name: shifts_leave_requests shifts_leave_requests_staff_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.shifts_leave_requests
    ADD CONSTRAINT shifts_leave_requests_staff_id_fkey FOREIGN KEY (staff_id) REFERENCES public.shifts_staff(id) ON DELETE CASCADE;

--
-- Name: shifts_leave_requests shifts_leave_requests_work_item_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.shifts_leave_requests
    ADD CONSTRAINT shifts_leave_requests_work_item_id_fkey FOREIGN KEY (work_item_id) REFERENCES public.work_items(id) ON DELETE SET NULL;

--
-- Name: shifts_leave_requests shifts_leave_requests_workspace_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.shifts_leave_requests
    ADD CONSTRAINT shifts_leave_requests_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE CASCADE;

--
-- Name: shifts_notifications shifts_notifications_schedule_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.shifts_notifications
    ADD CONSTRAINT shifts_notifications_schedule_id_fkey FOREIGN KEY (schedule_id) REFERENCES public.shifts_schedules(id) ON DELETE SET NULL;

--
-- Name: shifts_notifications shifts_notifications_shift_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.shifts_notifications
    ADD CONSTRAINT shifts_notifications_shift_id_fkey FOREIGN KEY (shift_id) REFERENCES public.shifts_shifts(id) ON DELETE SET NULL;

--
-- Name: shifts_notifications shifts_notifications_staff_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.shifts_notifications
    ADD CONSTRAINT shifts_notifications_staff_id_fkey FOREIGN KEY (staff_id) REFERENCES public.shifts_staff(id) ON DELETE SET NULL;

--
-- Name: shifts_notifications shifts_notifications_workspace_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.shifts_notifications
    ADD CONSTRAINT shifts_notifications_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE CASCADE;

--
-- Name: shifts_positions shifts_positions_workspace_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.shifts_positions
    ADD CONSTRAINT shifts_positions_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE CASCADE;

--
-- Name: shifts_schedules shifts_schedules_work_item_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.shifts_schedules
    ADD CONSTRAINT shifts_schedules_work_item_id_fkey FOREIGN KEY (work_item_id) REFERENCES public.work_items(id) ON DELETE SET NULL;

--
-- Name: shifts_schedules shifts_schedules_workspace_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.shifts_schedules
    ADD CONSTRAINT shifts_schedules_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE CASCADE;

--
-- Name: shifts_settings shifts_settings_workspace_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.shifts_settings
    ADD CONSTRAINT shifts_settings_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE CASCADE;

--
-- Name: shifts_shifts shifts_shifts_position_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.shifts_shifts
    ADD CONSTRAINT shifts_shifts_position_id_fkey FOREIGN KEY (position_id) REFERENCES public.shifts_positions(id) ON DELETE CASCADE;

--
-- Name: shifts_shifts shifts_shifts_schedule_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.shifts_shifts
    ADD CONSTRAINT shifts_shifts_schedule_id_fkey FOREIGN KEY (schedule_id) REFERENCES public.shifts_schedules(id) ON DELETE CASCADE;

--
-- Name: shifts_shifts shifts_shifts_staff_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.shifts_shifts
    ADD CONSTRAINT shifts_shifts_staff_id_fkey FOREIGN KEY (staff_id) REFERENCES public.shifts_staff(id) ON DELETE SET NULL;

--
-- Name: shifts_shifts shifts_shifts_workspace_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.shifts_shifts
    ADD CONSTRAINT shifts_shifts_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE CASCADE;

--
-- Name: shifts_staff_pay shifts_staff_pay_staff_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.shifts_staff_pay
    ADD CONSTRAINT shifts_staff_pay_staff_id_fkey FOREIGN KEY (staff_id) REFERENCES public.shifts_staff(id) ON DELETE CASCADE;

--
-- Name: shifts_staff_pay shifts_staff_pay_workspace_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.shifts_staff_pay
    ADD CONSTRAINT shifts_staff_pay_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE CASCADE;

--
-- Name: shifts_staff shifts_staff_staff_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.shifts_staff
    ADD CONSTRAINT shifts_staff_staff_id_fkey FOREIGN KEY (staff_id) REFERENCES public.staff(id) ON DELETE SET NULL;

--
-- Name: shifts_staff shifts_staff_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.shifts_staff
    ADD CONSTRAINT shifts_staff_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE SET NULL;

--
-- Name: shifts_staff shifts_staff_workspace_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.shifts_staff
    ADD CONSTRAINT shifts_staff_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE CASCADE;

--
-- Name: shifts_swap_requests shifts_swap_requests_from_staff_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.shifts_swap_requests
    ADD CONSTRAINT shifts_swap_requests_from_staff_id_fkey FOREIGN KEY (from_staff_id) REFERENCES public.shifts_staff(id) ON DELETE CASCADE;

--
-- Name: shifts_swap_requests shifts_swap_requests_shift_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.shifts_swap_requests
    ADD CONSTRAINT shifts_swap_requests_shift_id_fkey FOREIGN KEY (shift_id) REFERENCES public.shifts_shifts(id) ON DELETE CASCADE;

--
-- Name: shifts_swap_requests shifts_swap_requests_to_staff_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.shifts_swap_requests
    ADD CONSTRAINT shifts_swap_requests_to_staff_id_fkey FOREIGN KEY (to_staff_id) REFERENCES public.shifts_staff(id) ON DELETE CASCADE;

--
-- Name: shifts_swap_requests shifts_swap_requests_work_item_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.shifts_swap_requests
    ADD CONSTRAINT shifts_swap_requests_work_item_id_fkey FOREIGN KEY (work_item_id) REFERENCES public.work_items(id) ON DELETE SET NULL;

--
-- Name: shifts_swap_requests shifts_swap_requests_workspace_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.shifts_swap_requests
    ADD CONSTRAINT shifts_swap_requests_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE CASCADE;

--
-- Name: staff staff_workspace_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.staff
    ADD CONSTRAINT staff_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE CASCADE;

--
-- Name: transactions transactions_inbound_event_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.transactions
    ADD CONSTRAINT transactions_inbound_event_id_fkey FOREIGN KEY (inbound_event_id) REFERENCES public.inbound_events(id) ON DELETE SET NULL;

--
-- Name: transactions transactions_invoice_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.transactions
    ADD CONSTRAINT transactions_invoice_id_fkey FOREIGN KEY (invoice_id) REFERENCES public.invoices(id) ON DELETE SET NULL;

--
-- Name: transactions transactions_workspace_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.transactions
    ADD CONSTRAINT transactions_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE CASCADE;

--
-- Name: video_brand_kits video_brand_kits_updated_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.video_brand_kits
    ADD CONSTRAINT video_brand_kits_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES auth.users(id) ON DELETE SET NULL;

--
-- Name: video_brand_kits video_brand_kits_workspace_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.video_brand_kits
    ADD CONSTRAINT video_brand_kits_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE CASCADE;

--
-- Name: video_project_versions video_project_versions_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.video_project_versions
    ADD CONSTRAINT video_project_versions_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;

--
-- Name: video_project_versions video_project_versions_project_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.video_project_versions
    ADD CONSTRAINT video_project_versions_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.video_projects(id) ON DELETE CASCADE;

--
-- Name: video_project_versions video_project_versions_render_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.video_project_versions
    ADD CONSTRAINT video_project_versions_render_id_fkey FOREIGN KEY (render_id) REFERENCES public.video_renders(id) ON DELETE SET NULL;

--
-- Name: video_project_versions video_project_versions_workspace_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.video_project_versions
    ADD CONSTRAINT video_project_versions_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE CASCADE;

--
-- Name: video_projects video_projects_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.video_projects
    ADD CONSTRAINT video_projects_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;

--
-- Name: video_projects video_projects_publish_work_item_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.video_projects
    ADD CONSTRAINT video_projects_publish_work_item_id_fkey FOREIGN KEY (publish_work_item_id) REFERENCES public.work_items(id) ON DELETE SET NULL;

--
-- Name: video_projects video_projects_render_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.video_projects
    ADD CONSTRAINT video_projects_render_id_fkey FOREIGN KEY (render_id) REFERENCES public.video_renders(id) ON DELETE SET NULL;

--
-- Name: video_projects video_projects_source_project_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.video_projects
    ADD CONSTRAINT video_projects_source_project_id_fkey FOREIGN KEY (source_project_id) REFERENCES public.video_projects(id) ON DELETE SET NULL;

--
-- Name: video_projects video_projects_workspace_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.video_projects
    ADD CONSTRAINT video_projects_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE CASCADE;

--
-- Name: video_renders video_renders_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.video_renders
    ADD CONSTRAINT video_renders_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;

--
-- Name: video_renders video_renders_workspace_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.video_renders
    ADD CONSTRAINT video_renders_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE CASCADE;

--
-- Name: work_items work_items_assigned_staff_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.work_items
    ADD CONSTRAINT work_items_assigned_staff_id_fkey FOREIGN KEY (assigned_staff_id) REFERENCES public.staff(id) ON DELETE SET NULL;

--
-- Name: work_items work_items_department_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.work_items
    ADD CONSTRAINT work_items_department_fk FOREIGN KEY (department) REFERENCES public.modules(key) ON UPDATE CASCADE;

--
-- Name: work_items work_items_execution_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.work_items
    ADD CONSTRAINT work_items_execution_id_fkey FOREIGN KEY (execution_id) REFERENCES public.executions(id) ON DELETE SET NULL;

--
-- Name: work_items work_items_inbound_event_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.work_items
    ADD CONSTRAINT work_items_inbound_event_id_fkey FOREIGN KEY (inbound_event_id) REFERENCES public.inbound_events(id) ON DELETE SET NULL;

--
-- Name: work_items work_items_installation_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.work_items
    ADD CONSTRAINT work_items_installation_id_fkey FOREIGN KEY (installation_id) REFERENCES public.module_installations(id) ON DELETE SET NULL;

--
-- Name: work_items work_items_lead_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.work_items
    ADD CONSTRAINT work_items_lead_id_fkey FOREIGN KEY (lead_id) REFERENCES public.leads(id) ON DELETE CASCADE;

--
-- Name: work_items work_items_parent_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.work_items
    ADD CONSTRAINT work_items_parent_id_fkey FOREIGN KEY (parent_id) REFERENCES public.work_items(id) ON DELETE SET NULL;

--
-- Name: work_items work_items_workspace_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.work_items
    ADD CONSTRAINT work_items_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE CASCADE;

--
-- Name: api_keys workspace_api_keys_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.api_keys
    ADD CONSTRAINT workspace_api_keys_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;

--
-- Name: api_keys workspace_api_keys_workspace_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.api_keys
    ADD CONSTRAINT workspace_api_keys_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE CASCADE;

--
-- Name: workspace_invites workspace_invites_accepted_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workspace_invites
    ADD CONSTRAINT workspace_invites_accepted_by_fkey FOREIGN KEY (accepted_by) REFERENCES auth.users(id) ON DELETE SET NULL;

--
-- Name: workspace_invites workspace_invites_invited_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workspace_invites
    ADD CONSTRAINT workspace_invites_invited_by_fkey FOREIGN KEY (invited_by) REFERENCES auth.users(id) ON DELETE SET NULL;

--
-- Name: workspace_invites workspace_invites_staff_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workspace_invites
    ADD CONSTRAINT workspace_invites_staff_id_fkey FOREIGN KEY (staff_id) REFERENCES public.staff(id) ON DELETE SET NULL;

--
-- Name: workspace_invites workspace_invites_workspace_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workspace_invites
    ADD CONSTRAINT workspace_invites_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE CASCADE;

--
-- Name: workspace_members workspace_members_staff_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workspace_members
    ADD CONSTRAINT workspace_members_staff_id_fkey FOREIGN KEY (staff_id) REFERENCES public.staff(id) ON DELETE SET NULL;

--
-- Name: workspace_members workspace_members_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workspace_members
    ADD CONSTRAINT workspace_members_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

--
-- Name: workspace_members workspace_members_workspace_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workspace_members
    ADD CONSTRAINT workspace_members_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE CASCADE;

--
-- Name: workspaces workspaces_owner_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workspaces
    ADD CONSTRAINT workspaces_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES auth.users(id) ON DELETE CASCADE;

--
-- Name: workspaces workspaces_plan_code_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workspaces
    ADD CONSTRAINT workspaces_plan_code_fkey FOREIGN KEY (plan_code) REFERENCES public.plans(code);

--
-- Name: zalo_wizard_drafts zalo_wizard_drafts_connection_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.zalo_wizard_drafts
    ADD CONSTRAINT zalo_wizard_drafts_connection_id_fkey FOREIGN KEY (connection_id) REFERENCES public.connections(id) ON DELETE CASCADE;

--
-- Name: accounting_adjustments; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.accounting_adjustments ENABLE ROW LEVEL SECURITY;

--
-- Name: accounting_adjustments accounting_adjustments_app_be_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY accounting_adjustments_app_be_insert ON public.accounting_adjustments FOR INSERT TO app_be WITH CHECK ((workspace_id IS NOT NULL));

--
-- Name: accounting_adjustments accounting_adjustments_app_be_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY accounting_adjustments_app_be_select ON public.accounting_adjustments FOR SELECT TO app_be USING ((workspace_id IS NOT NULL));

--
-- Name: accounting_adjustments accounting_adjustments_manager_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY accounting_adjustments_manager_insert ON public.accounting_adjustments FOR INSERT TO authenticated WITH CHECK ((public.is_manager(workspace_id) AND (created_by_user = auth.uid())));

--
-- Name: accounting_adjustments accounting_adjustments_member_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY accounting_adjustments_member_select ON public.accounting_adjustments FOR SELECT TO authenticated USING (public.is_member(workspace_id));

--
-- Name: agent_access_log; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.agent_access_log ENABLE ROW LEVEL SECURITY;

--
-- Name: agent_access_log agent_access_log_app_be_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY agent_access_log_app_be_insert ON public.agent_access_log FOR INSERT TO app_be WITH CHECK ((workspace_id IS NOT NULL));

--
-- Name: agent_access_log agent_access_log_app_be_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY agent_access_log_app_be_select ON public.agent_access_log FOR SELECT TO app_be USING ((workspace_id IS NOT NULL));

--
-- Name: agent_access_log agent_access_log_manager_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY agent_access_log_manager_select ON public.agent_access_log FOR SELECT TO authenticated USING (public.is_manager(workspace_id));

--
-- Name: agent_connections; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.agent_connections ENABLE ROW LEVEL SECURITY;

--
-- Name: agent_connections agent_connections_app_be_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY agent_connections_app_be_delete ON public.agent_connections FOR DELETE TO app_be USING ((workspace_id IS NOT NULL));

--
-- Name: agent_connections agent_connections_app_be_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY agent_connections_app_be_insert ON public.agent_connections FOR INSERT TO app_be WITH CHECK ((workspace_id IS NOT NULL));

--
-- Name: agent_connections agent_connections_app_be_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY agent_connections_app_be_select ON public.agent_connections FOR SELECT TO app_be USING ((workspace_id IS NOT NULL));

--
-- Name: agent_connections agent_connections_app_be_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY agent_connections_app_be_update ON public.agent_connections FOR UPDATE TO app_be USING ((workspace_id IS NOT NULL)) WITH CHECK ((workspace_id IS NOT NULL));

--
-- Name: agent_connections agent_connections_member_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY agent_connections_member_select ON public.agent_connections FOR SELECT TO authenticated USING (public.is_member(workspace_id));

--
-- Name: agent_connections agent_connections_owner_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY agent_connections_owner_all ON public.agent_connections TO authenticated USING (public.is_owner(workspace_id)) WITH CHECK (public.is_owner(workspace_id));

--
-- Name: agent_conversations; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.agent_conversations ENABLE ROW LEVEL SECURITY;

--
-- Name: agent_conversations agent_conversations_app_be_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY agent_conversations_app_be_delete ON public.agent_conversations FOR DELETE TO app_be USING ((workspace_id IS NOT NULL));

--
-- Name: agent_conversations agent_conversations_app_be_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY agent_conversations_app_be_insert ON public.agent_conversations FOR INSERT TO app_be WITH CHECK ((workspace_id IS NOT NULL));

--
-- Name: agent_conversations agent_conversations_app_be_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY agent_conversations_app_be_select ON public.agent_conversations FOR SELECT TO app_be USING ((workspace_id IS NOT NULL));

--
-- Name: agent_conversations agent_conversations_app_be_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY agent_conversations_app_be_update ON public.agent_conversations FOR UPDATE TO app_be USING ((workspace_id IS NOT NULL)) WITH CHECK ((workspace_id IS NOT NULL));

--
-- Name: agent_conversations agent_conversations_member_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY agent_conversations_member_all ON public.agent_conversations TO authenticated USING (public.is_member(workspace_id)) WITH CHECK (public.is_member(workspace_id));

--
-- Name: agent_messages; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.agent_messages ENABLE ROW LEVEL SECURITY;

--
-- Name: agent_messages agent_messages_app_be_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY agent_messages_app_be_delete ON public.agent_messages FOR DELETE TO app_be USING ((workspace_id IS NOT NULL));

--
-- Name: agent_messages agent_messages_app_be_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY agent_messages_app_be_insert ON public.agent_messages FOR INSERT TO app_be WITH CHECK ((workspace_id IS NOT NULL));

--
-- Name: agent_messages agent_messages_app_be_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY agent_messages_app_be_select ON public.agent_messages FOR SELECT TO app_be USING ((workspace_id IS NOT NULL));

--
-- Name: agent_messages agent_messages_app_be_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY agent_messages_app_be_update ON public.agent_messages FOR UPDATE TO app_be USING ((workspace_id IS NOT NULL)) WITH CHECK ((workspace_id IS NOT NULL));

--
-- Name: agent_messages agent_messages_member_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY agent_messages_member_all ON public.agent_messages TO authenticated USING (public.is_member(workspace_id)) WITH CHECK (public.is_member(workspace_id));

--
-- Name: agents; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.agents ENABLE ROW LEVEL SECURITY;

--
-- Name: agents agents_app_be_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY agents_app_be_delete ON public.agents FOR DELETE TO app_be USING ((workspace_id IS NOT NULL));

--
-- Name: agents agents_app_be_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY agents_app_be_insert ON public.agents FOR INSERT TO app_be WITH CHECK ((workspace_id IS NOT NULL));

--
-- Name: agents agents_app_be_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY agents_app_be_select ON public.agents FOR SELECT TO app_be USING ((workspace_id IS NOT NULL));

--
-- Name: agents agents_app_be_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY agents_app_be_update ON public.agents FOR UPDATE TO app_be USING ((workspace_id IS NOT NULL)) WITH CHECK ((workspace_id IS NOT NULL));

--
-- Name: agents agents_manager_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY agents_manager_delete ON public.agents FOR DELETE TO authenticated USING (public.is_manager(workspace_id));

--
-- Name: agents agents_manager_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY agents_manager_insert ON public.agents FOR INSERT TO authenticated WITH CHECK (public.is_manager(workspace_id));

--
-- Name: agents agents_manager_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY agents_manager_update ON public.agents FOR UPDATE TO authenticated USING (public.is_manager(workspace_id)) WITH CHECK (public.is_manager(workspace_id));

--
-- Name: agents agents_member_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY agents_member_select ON public.agents FOR SELECT TO authenticated USING (public.is_member(workspace_id));

--
-- Name: ai_generations; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.ai_generations ENABLE ROW LEVEL SECURITY;

--
-- Name: ai_generations ai_generations_app_be_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY ai_generations_app_be_delete ON public.ai_generations FOR DELETE TO app_be USING ((workspace_id IS NOT NULL));

--
-- Name: ai_generations ai_generations_app_be_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY ai_generations_app_be_insert ON public.ai_generations FOR INSERT TO app_be WITH CHECK ((workspace_id IS NOT NULL));

--
-- Name: ai_generations ai_generations_app_be_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY ai_generations_app_be_select ON public.ai_generations FOR SELECT TO app_be USING ((workspace_id IS NOT NULL));

--
-- Name: ai_generations ai_generations_app_be_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY ai_generations_app_be_update ON public.ai_generations FOR UPDATE TO app_be USING ((workspace_id IS NOT NULL)) WITH CHECK ((workspace_id IS NOT NULL));

--
-- Name: ai_generations ai_generations_member_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY ai_generations_member_select ON public.ai_generations FOR SELECT TO authenticated USING (public.is_member(workspace_id));

--
-- Name: ai_quota_overrides; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.ai_quota_overrides ENABLE ROW LEVEL SECURITY;

--
-- Name: ai_quota_overrides ai_quota_overrides_app_be_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY ai_quota_overrides_app_be_delete ON public.ai_quota_overrides FOR DELETE TO app_be USING ((workspace_id IS NOT NULL));

--
-- Name: ai_quota_overrides ai_quota_overrides_app_be_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY ai_quota_overrides_app_be_insert ON public.ai_quota_overrides FOR INSERT TO app_be WITH CHECK ((workspace_id IS NOT NULL));

--
-- Name: ai_quota_overrides ai_quota_overrides_app_be_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY ai_quota_overrides_app_be_select ON public.ai_quota_overrides FOR SELECT TO app_be USING ((workspace_id IS NOT NULL));

--
-- Name: ai_quota_overrides ai_quota_overrides_app_be_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY ai_quota_overrides_app_be_update ON public.ai_quota_overrides FOR UPDATE TO app_be USING ((workspace_id IS NOT NULL)) WITH CHECK ((workspace_id IS NOT NULL));

--
-- Name: ai_quota_overrides ai_quota_overrides_manager_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY ai_quota_overrides_manager_select ON public.ai_quota_overrides FOR SELECT TO authenticated USING (public.is_manager(workspace_id));

--
-- Name: ai_quota_overrides ai_quota_overrides_platform_admin_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY ai_quota_overrides_platform_admin_select ON public.ai_quota_overrides FOR SELECT TO authenticated USING (( SELECT public.is_platform_admin() AS is_platform_admin));

--
-- Name: ai_usage_events; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.ai_usage_events ENABLE ROW LEVEL SECURITY;

--
-- Name: ai_usage_events ai_usage_events_app_be_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY ai_usage_events_app_be_insert ON public.ai_usage_events FOR INSERT TO app_be WITH CHECK ((workspace_id IS NOT NULL));

--
-- Name: ai_usage_events ai_usage_events_app_be_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY ai_usage_events_app_be_select ON public.ai_usage_events FOR SELECT TO app_be USING ((workspace_id IS NOT NULL));

--
-- Name: ai_usage_events ai_usage_events_member_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY ai_usage_events_member_select ON public.ai_usage_events FOR SELECT TO authenticated USING (public.is_member(workspace_id));

--
-- Name: ai_usage_notices; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.ai_usage_notices ENABLE ROW LEVEL SECURITY;

--
-- Name: ai_usage_notices ai_usage_notices_app_be_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY ai_usage_notices_app_be_delete ON public.ai_usage_notices FOR DELETE TO app_be USING ((workspace_id IS NOT NULL));

--
-- Name: ai_usage_notices ai_usage_notices_app_be_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY ai_usage_notices_app_be_insert ON public.ai_usage_notices FOR INSERT TO app_be WITH CHECK ((workspace_id IS NOT NULL));

--
-- Name: ai_usage_notices ai_usage_notices_app_be_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY ai_usage_notices_app_be_select ON public.ai_usage_notices FOR SELECT TO app_be USING ((workspace_id IS NOT NULL));

--
-- Name: ai_usage_notices ai_usage_notices_app_be_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY ai_usage_notices_app_be_update ON public.ai_usage_notices FOR UPDATE TO app_be USING ((workspace_id IS NOT NULL)) WITH CHECK ((workspace_id IS NOT NULL));

--
-- Name: api_keys; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.api_keys ENABLE ROW LEVEL SECURITY;

--
-- Name: api_keys api_keys_authenticated_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY api_keys_authenticated_select ON public.api_keys FOR SELECT TO authenticated USING (public.is_manager(workspace_id));

--
-- Name: api_rate_limits; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.api_rate_limits ENABLE ROW LEVEL SECURITY;

--
-- Name: api_rate_limits api_rate_limits_app_be_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY api_rate_limits_app_be_delete ON public.api_rate_limits FOR DELETE TO app_be USING ((key_id IS NOT NULL));

--
-- Name: api_rate_limits api_rate_limits_app_be_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY api_rate_limits_app_be_insert ON public.api_rate_limits FOR INSERT TO app_be WITH CHECK ((key_id IS NOT NULL));

--
-- Name: api_rate_limits api_rate_limits_app_be_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY api_rate_limits_app_be_select ON public.api_rate_limits FOR SELECT TO app_be USING ((key_id IS NOT NULL));

--
-- Name: api_rate_limits api_rate_limits_app_be_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY api_rate_limits_app_be_update ON public.api_rate_limits FOR UPDATE TO app_be USING ((key_id IS NOT NULL)) WITH CHECK ((key_id IS NOT NULL));

--
-- Name: app_commands; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.app_commands ENABLE ROW LEVEL SECURITY;

--
-- Name: app_commands app_commands_app_be_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY app_commands_app_be_select ON public.app_commands FOR SELECT TO app_be USING ((id IS NOT NULL));

--
-- Name: app_commands app_commands_app_be_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY app_commands_app_be_update ON public.app_commands FOR UPDATE TO app_be USING ((id IS NOT NULL)) WITH CHECK ((id IS NOT NULL));

--
-- Name: app_commands app_commands_requester_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY app_commands_requester_select ON public.app_commands FOR SELECT TO authenticated USING ((requested_by = ( SELECT auth.uid() AS uid)));

--
-- Name: app_errors; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.app_errors ENABLE ROW LEVEL SECURITY;

--
-- Name: app_errors app_errors_app_be_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY app_errors_app_be_insert ON public.app_errors FOR INSERT TO app_be WITH CHECK ((scope IS NOT NULL));

--
-- Name: app_errors app_errors_app_be_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY app_errors_app_be_select ON public.app_errors FOR SELECT TO app_be USING ((workspace_id IS NOT NULL));

--
-- Name: app_errors app_errors_platform_admin_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY app_errors_platform_admin_select ON public.app_errors FOR SELECT TO authenticated USING (( SELECT public.is_platform_admin() AS is_platform_admin));

--
-- Name: authority; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.authority ENABLE ROW LEVEL SECURITY;

--
-- Name: authority_actions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.authority_actions ENABLE ROW LEVEL SECURITY;

--
-- Name: authority_actions authority_actions_app_be_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY authority_actions_app_be_insert ON public.authority_actions FOR INSERT TO app_be WITH CHECK ((action IS NOT NULL));

--
-- Name: authority_actions authority_actions_app_be_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY authority_actions_app_be_select ON public.authority_actions FOR SELECT TO app_be USING ((action IS NOT NULL));

--
-- Name: authority_actions authority_actions_app_be_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY authority_actions_app_be_update ON public.authority_actions FOR UPDATE TO app_be USING ((action IS NOT NULL)) WITH CHECK ((action IS NOT NULL));

--
-- Name: authority_actions authority_actions_authenticated_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY authority_actions_authenticated_select ON public.authority_actions FOR SELECT TO authenticated USING ((( SELECT auth.uid() AS uid) IS NOT NULL));

--
-- Name: authority authority_app_be_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY authority_app_be_delete ON public.authority FOR DELETE TO app_be USING ((workspace_id IS NOT NULL));

--
-- Name: authority authority_app_be_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY authority_app_be_insert ON public.authority FOR INSERT TO app_be WITH CHECK ((workspace_id IS NOT NULL));

--
-- Name: authority authority_app_be_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY authority_app_be_select ON public.authority FOR SELECT TO app_be USING ((workspace_id IS NOT NULL));

--
-- Name: authority authority_app_be_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY authority_app_be_update ON public.authority FOR UPDATE TO app_be USING ((workspace_id IS NOT NULL)) WITH CHECK ((workspace_id IS NOT NULL));

--
-- Name: authority authority_manager_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY authority_manager_delete ON public.authority FOR DELETE TO authenticated USING (public.is_manager(workspace_id));

--
-- Name: authority authority_manager_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY authority_manager_insert ON public.authority FOR INSERT TO authenticated WITH CHECK (public.is_manager(workspace_id));

--
-- Name: authority authority_manager_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY authority_manager_update ON public.authority FOR UPDATE TO authenticated USING (public.is_manager(workspace_id)) WITH CHECK (public.is_manager(workspace_id));

--
-- Name: authority authority_member_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY authority_member_select ON public.authority FOR SELECT TO authenticated USING (public.is_member(workspace_id));

--
-- Name: authority_rules; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.authority_rules ENABLE ROW LEVEL SECURITY;

--
-- Name: authority_rules authority_rules_app_be_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY authority_rules_app_be_delete ON public.authority_rules FOR DELETE TO app_be USING ((workspace_id IS NOT NULL));

--
-- Name: authority_rules authority_rules_app_be_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY authority_rules_app_be_insert ON public.authority_rules FOR INSERT TO app_be WITH CHECK ((workspace_id IS NOT NULL));

--
-- Name: authority_rules authority_rules_app_be_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY authority_rules_app_be_select ON public.authority_rules FOR SELECT TO app_be USING ((workspace_id IS NOT NULL));

--
-- Name: authority_rules authority_rules_app_be_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY authority_rules_app_be_update ON public.authority_rules FOR UPDATE TO app_be USING ((workspace_id IS NOT NULL)) WITH CHECK ((workspace_id IS NOT NULL));

--
-- Name: authority_rules authority_rules_manager_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY authority_rules_manager_delete ON public.authority_rules FOR DELETE TO authenticated USING (public.is_manager(workspace_id));

--
-- Name: authority_rules authority_rules_manager_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY authority_rules_manager_insert ON public.authority_rules FOR INSERT TO authenticated WITH CHECK (public.is_manager(workspace_id));

--
-- Name: authority_rules authority_rules_manager_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY authority_rules_manager_update ON public.authority_rules FOR UPDATE TO authenticated USING (public.is_manager(workspace_id)) WITH CHECK (public.is_manager(workspace_id));

--
-- Name: authority_rules authority_rules_member_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY authority_rules_member_select ON public.authority_rules FOR SELECT TO authenticated USING (public.is_member(workspace_id));

--
-- Name: automation_commands; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.automation_commands ENABLE ROW LEVEL SECURITY;

--
-- Name: automation_commands automation_commands_app_be_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY automation_commands_app_be_select ON public.automation_commands FOR SELECT TO app_be USING ((workspace_id IS NOT NULL));

--
-- Name: automation_commands automation_commands_app_be_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY automation_commands_app_be_update ON public.automation_commands FOR UPDATE TO app_be USING ((workspace_id IS NOT NULL)) WITH CHECK ((workspace_id IS NOT NULL));

--
-- Name: automation_commands automation_commands_manager_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY automation_commands_manager_select ON public.automation_commands FOR SELECT TO authenticated USING (public.is_manager(workspace_id));

--
-- Name: automation_pipelines; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.automation_pipelines ENABLE ROW LEVEL SECURITY;

--
-- Name: automation_pipelines automation_pipelines_app_be_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY automation_pipelines_app_be_delete ON public.automation_pipelines FOR DELETE TO app_be USING ((workspace_id IS NOT NULL));

--
-- Name: automation_pipelines automation_pipelines_app_be_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY automation_pipelines_app_be_insert ON public.automation_pipelines FOR INSERT TO app_be WITH CHECK ((workspace_id IS NOT NULL));

--
-- Name: automation_pipelines automation_pipelines_app_be_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY automation_pipelines_app_be_select ON public.automation_pipelines FOR SELECT TO app_be USING ((workspace_id IS NOT NULL));

--
-- Name: automation_pipelines automation_pipelines_app_be_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY automation_pipelines_app_be_update ON public.automation_pipelines FOR UPDATE TO app_be USING ((workspace_id IS NOT NULL)) WITH CHECK ((workspace_id IS NOT NULL));

--
-- Name: automation_pipelines automation_pipelines_manager_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY automation_pipelines_manager_all ON public.automation_pipelines TO authenticated USING (public.is_manager(workspace_id)) WITH CHECK (public.is_manager(workspace_id));

--
-- Name: automation_pipelines automation_pipelines_member_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY automation_pipelines_member_select ON public.automation_pipelines FOR SELECT TO authenticated USING (public.is_member(workspace_id));

--
-- Name: automation_runs; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.automation_runs ENABLE ROW LEVEL SECURITY;

--
-- Name: automation_runs automation_runs_app_be_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY automation_runs_app_be_delete ON public.automation_runs FOR DELETE TO app_be USING ((workspace_id IS NOT NULL));

--
-- Name: automation_runs automation_runs_app_be_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY automation_runs_app_be_insert ON public.automation_runs FOR INSERT TO app_be WITH CHECK ((workspace_id IS NOT NULL));

--
-- Name: automation_runs automation_runs_app_be_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY automation_runs_app_be_select ON public.automation_runs FOR SELECT TO app_be USING ((workspace_id IS NOT NULL));

--
-- Name: automation_runs automation_runs_app_be_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY automation_runs_app_be_update ON public.automation_runs FOR UPDATE TO app_be USING ((workspace_id IS NOT NULL)) WITH CHECK ((workspace_id IS NOT NULL));

--
-- Name: automation_runs automation_runs_member_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY automation_runs_member_select ON public.automation_runs FOR SELECT TO authenticated USING (public.is_member(workspace_id));

--
-- Name: automation_templates; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.automation_templates ENABLE ROW LEVEL SECURITY;

--
-- Name: automation_templates automation_templates_app_be_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY automation_templates_app_be_insert ON public.automation_templates FOR INSERT TO app_be WITH CHECK ((key IS NOT NULL));

--
-- Name: automation_templates automation_templates_app_be_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY automation_templates_app_be_select ON public.automation_templates FOR SELECT TO app_be USING ((key IS NOT NULL));

--
-- Name: automation_templates automation_templates_app_be_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY automation_templates_app_be_update ON public.automation_templates FOR UPDATE TO app_be USING ((key IS NOT NULL)) WITH CHECK ((key IS NOT NULL));

--
-- Name: automation_templates automation_templates_authenticated_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY automation_templates_authenticated_select ON public.automation_templates FOR SELECT TO authenticated USING ((( SELECT auth.uid() AS uid) IS NOT NULL));

--
-- Name: billing_config; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.billing_config ENABLE ROW LEVEL SECURITY;

--
-- Name: billing_config billing_config_app_be_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY billing_config_app_be_select ON public.billing_config FOR SELECT TO app_be USING ((key IS NOT NULL));

--
-- Name: billing_events; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.billing_events ENABLE ROW LEVEL SECURITY;

--
-- Name: billing_events billing_events_app_be_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY billing_events_app_be_insert ON public.billing_events FOR INSERT TO app_be WITH CHECK ((workspace_id IS NOT NULL));

--
-- Name: billing_events billing_events_app_be_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY billing_events_app_be_select ON public.billing_events FOR SELECT TO app_be USING ((workspace_id IS NOT NULL));

--
-- Name: billing_events billing_events_manager_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY billing_events_manager_select ON public.billing_events FOR SELECT TO authenticated USING (((workspace_id IS NOT NULL) AND public.is_manager(workspace_id)));

--
-- Name: billing_events billing_events_platform_admin_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY billing_events_platform_admin_select ON public.billing_events FOR SELECT TO authenticated USING (( SELECT public.is_platform_admin() AS is_platform_admin));

--
-- Name: booking_exceptions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.booking_exceptions ENABLE ROW LEVEL SECURITY;

--
-- Name: booking_exceptions booking_exceptions_app_be_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY booking_exceptions_app_be_delete ON public.booking_exceptions FOR DELETE TO app_be USING ((workspace_id IS NOT NULL));

--
-- Name: booking_exceptions booking_exceptions_app_be_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY booking_exceptions_app_be_insert ON public.booking_exceptions FOR INSERT TO app_be WITH CHECK ((workspace_id IS NOT NULL));

--
-- Name: booking_exceptions booking_exceptions_app_be_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY booking_exceptions_app_be_select ON public.booking_exceptions FOR SELECT TO app_be USING ((workspace_id IS NOT NULL));

--
-- Name: booking_exceptions booking_exceptions_app_be_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY booking_exceptions_app_be_update ON public.booking_exceptions FOR UPDATE TO app_be USING ((workspace_id IS NOT NULL)) WITH CHECK ((workspace_id IS NOT NULL));

--
-- Name: booking_exceptions booking_exceptions_manager_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY booking_exceptions_manager_all ON public.booking_exceptions TO authenticated USING (public.is_manager(workspace_id)) WITH CHECK (public.is_manager(workspace_id));

--
-- Name: booking_exceptions booking_exceptions_member_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY booking_exceptions_member_select ON public.booking_exceptions FOR SELECT TO authenticated USING (public.is_member(workspace_id));

--
-- Name: booking_hours; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.booking_hours ENABLE ROW LEVEL SECURITY;

--
-- Name: booking_hours booking_hours_app_be_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY booking_hours_app_be_delete ON public.booking_hours FOR DELETE TO app_be USING ((workspace_id IS NOT NULL));

--
-- Name: booking_hours booking_hours_app_be_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY booking_hours_app_be_insert ON public.booking_hours FOR INSERT TO app_be WITH CHECK ((workspace_id IS NOT NULL));

--
-- Name: booking_hours booking_hours_app_be_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY booking_hours_app_be_select ON public.booking_hours FOR SELECT TO app_be USING ((workspace_id IS NOT NULL));

--
-- Name: booking_hours booking_hours_app_be_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY booking_hours_app_be_update ON public.booking_hours FOR UPDATE TO app_be USING ((workspace_id IS NOT NULL)) WITH CHECK ((workspace_id IS NOT NULL));

--
-- Name: booking_hours booking_hours_manager_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY booking_hours_manager_all ON public.booking_hours TO authenticated USING (public.is_manager(workspace_id)) WITH CHECK (public.is_manager(workspace_id));

--
-- Name: booking_hours booking_hours_member_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY booking_hours_member_select ON public.booking_hours FOR SELECT TO authenticated USING (public.is_member(workspace_id));

--
-- Name: booking_rate; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.booking_rate ENABLE ROW LEVEL SECURITY;

--
-- Name: booking_rate booking_rate_app_be_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY booking_rate_app_be_delete ON public.booking_rate FOR DELETE TO app_be USING ((key IS NOT NULL));

--
-- Name: booking_rate booking_rate_app_be_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY booking_rate_app_be_insert ON public.booking_rate FOR INSERT TO app_be WITH CHECK ((key IS NOT NULL));

--
-- Name: booking_rate booking_rate_app_be_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY booking_rate_app_be_select ON public.booking_rate FOR SELECT TO app_be USING ((key IS NOT NULL));

--
-- Name: booking_rate booking_rate_app_be_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY booking_rate_app_be_update ON public.booking_rate FOR UPDATE TO app_be USING ((key IS NOT NULL)) WITH CHECK ((key IS NOT NULL));

--
-- Name: booking_reminders; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.booking_reminders ENABLE ROW LEVEL SECURITY;

--
-- Name: booking_reminders booking_reminders_app_be_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY booking_reminders_app_be_delete ON public.booking_reminders FOR DELETE TO app_be USING ((workspace_id IS NOT NULL));

--
-- Name: booking_reminders booking_reminders_app_be_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY booking_reminders_app_be_insert ON public.booking_reminders FOR INSERT TO app_be WITH CHECK ((workspace_id IS NOT NULL));

--
-- Name: booking_reminders booking_reminders_app_be_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY booking_reminders_app_be_select ON public.booking_reminders FOR SELECT TO app_be USING ((workspace_id IS NOT NULL));

--
-- Name: booking_reminders booking_reminders_app_be_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY booking_reminders_app_be_update ON public.booking_reminders FOR UPDATE TO app_be USING ((workspace_id IS NOT NULL)) WITH CHECK ((workspace_id IS NOT NULL));

--
-- Name: booking_reminders booking_reminders_manager_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY booking_reminders_manager_all ON public.booking_reminders TO authenticated USING (public.is_manager(workspace_id)) WITH CHECK (public.is_manager(workspace_id));

--
-- Name: booking_reminders booking_reminders_member_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY booking_reminders_member_select ON public.booking_reminders FOR SELECT TO authenticated USING (public.is_member(workspace_id));

--
-- Name: booking_resources; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.booking_resources ENABLE ROW LEVEL SECURITY;

--
-- Name: booking_resources booking_resources_app_be_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY booking_resources_app_be_delete ON public.booking_resources FOR DELETE TO app_be USING ((workspace_id IS NOT NULL));

--
-- Name: booking_resources booking_resources_app_be_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY booking_resources_app_be_insert ON public.booking_resources FOR INSERT TO app_be WITH CHECK ((workspace_id IS NOT NULL));

--
-- Name: booking_resources booking_resources_app_be_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY booking_resources_app_be_select ON public.booking_resources FOR SELECT TO app_be USING ((workspace_id IS NOT NULL));

--
-- Name: booking_resources booking_resources_app_be_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY booking_resources_app_be_update ON public.booking_resources FOR UPDATE TO app_be USING ((workspace_id IS NOT NULL)) WITH CHECK ((workspace_id IS NOT NULL));

--
-- Name: booking_resources booking_resources_manager_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY booking_resources_manager_all ON public.booking_resources TO authenticated USING (public.is_manager(workspace_id)) WITH CHECK (public.is_manager(workspace_id));

--
-- Name: booking_resources booking_resources_member_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY booking_resources_member_select ON public.booking_resources FOR SELECT TO authenticated USING (public.is_member(workspace_id));

--
-- Name: booking_services; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.booking_services ENABLE ROW LEVEL SECURITY;

--
-- Name: booking_services booking_services_app_be_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY booking_services_app_be_delete ON public.booking_services FOR DELETE TO app_be USING ((workspace_id IS NOT NULL));

--
-- Name: booking_services booking_services_app_be_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY booking_services_app_be_insert ON public.booking_services FOR INSERT TO app_be WITH CHECK ((workspace_id IS NOT NULL));

--
-- Name: booking_services booking_services_app_be_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY booking_services_app_be_select ON public.booking_services FOR SELECT TO app_be USING ((workspace_id IS NOT NULL));

--
-- Name: booking_services booking_services_app_be_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY booking_services_app_be_update ON public.booking_services FOR UPDATE TO app_be USING ((workspace_id IS NOT NULL)) WITH CHECK ((workspace_id IS NOT NULL));

--
-- Name: booking_services booking_services_manager_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY booking_services_manager_all ON public.booking_services TO authenticated USING (public.is_manager(workspace_id)) WITH CHECK (public.is_manager(workspace_id));

--
-- Name: booking_services booking_services_member_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY booking_services_member_select ON public.booking_services FOR SELECT TO authenticated USING (public.is_member(workspace_id));

--
-- Name: booking_settings; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.booking_settings ENABLE ROW LEVEL SECURITY;

--
-- Name: booking_settings booking_settings_app_be_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY booking_settings_app_be_delete ON public.booking_settings FOR DELETE TO app_be USING ((workspace_id IS NOT NULL));

--
-- Name: booking_settings booking_settings_app_be_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY booking_settings_app_be_insert ON public.booking_settings FOR INSERT TO app_be WITH CHECK ((workspace_id IS NOT NULL));

--
-- Name: booking_settings booking_settings_app_be_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY booking_settings_app_be_select ON public.booking_settings FOR SELECT TO app_be USING ((workspace_id IS NOT NULL));

--
-- Name: booking_settings booking_settings_app_be_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY booking_settings_app_be_update ON public.booking_settings FOR UPDATE TO app_be USING ((workspace_id IS NOT NULL)) WITH CHECK ((workspace_id IS NOT NULL));

--
-- Name: booking_settings booking_settings_manager_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY booking_settings_manager_all ON public.booking_settings TO authenticated USING (public.is_manager(workspace_id)) WITH CHECK (public.is_manager(workspace_id));

--
-- Name: booking_settings booking_settings_member_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY booking_settings_member_select ON public.booking_settings FOR SELECT TO authenticated USING (public.is_member(workspace_id));

--
-- Name: booking_waitlist; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.booking_waitlist ENABLE ROW LEVEL SECURITY;

--
-- Name: booking_waitlist booking_waitlist_app_be_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY booking_waitlist_app_be_delete ON public.booking_waitlist FOR DELETE TO app_be USING ((workspace_id IS NOT NULL));

--
-- Name: booking_waitlist booking_waitlist_app_be_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY booking_waitlist_app_be_insert ON public.booking_waitlist FOR INSERT TO app_be WITH CHECK ((workspace_id IS NOT NULL));

--
-- Name: booking_waitlist booking_waitlist_app_be_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY booking_waitlist_app_be_select ON public.booking_waitlist FOR SELECT TO app_be USING ((workspace_id IS NOT NULL));

--
-- Name: booking_waitlist booking_waitlist_app_be_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY booking_waitlist_app_be_update ON public.booking_waitlist FOR UPDATE TO app_be USING ((workspace_id IS NOT NULL)) WITH CHECK ((workspace_id IS NOT NULL));

--
-- Name: booking_waitlist booking_waitlist_manager_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY booking_waitlist_manager_all ON public.booking_waitlist TO authenticated USING (public.is_manager(workspace_id)) WITH CHECK (public.is_manager(workspace_id));

--
-- Name: booking_waitlist booking_waitlist_member_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY booking_waitlist_member_select ON public.booking_waitlist FOR SELECT TO authenticated USING (public.is_member(workspace_id));

--
-- Name: bookings; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;

--
-- Name: bookings bookings_app_be_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY bookings_app_be_delete ON public.bookings FOR DELETE TO app_be USING ((workspace_id IS NOT NULL));

--
-- Name: bookings bookings_app_be_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY bookings_app_be_insert ON public.bookings FOR INSERT TO app_be WITH CHECK ((workspace_id IS NOT NULL));

--
-- Name: bookings bookings_app_be_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY bookings_app_be_select ON public.bookings FOR SELECT TO app_be USING ((workspace_id IS NOT NULL));

--
-- Name: bookings bookings_app_be_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY bookings_app_be_update ON public.bookings FOR UPDATE TO app_be USING ((workspace_id IS NOT NULL)) WITH CHECK ((workspace_id IS NOT NULL));

--
-- Name: bookings bookings_manager_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY bookings_manager_all ON public.bookings TO authenticated USING (public.is_manager(workspace_id)) WITH CHECK (public.is_manager(workspace_id));

--
-- Name: bookings bookings_member_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY bookings_member_select ON public.bookings FOR SELECT TO authenticated USING (public.is_member(workspace_id));

--
-- Name: brain_commands; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.brain_commands ENABLE ROW LEVEL SECURITY;

--
-- Name: brain_commands brain_commands_app_be_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY brain_commands_app_be_delete ON public.brain_commands FOR DELETE TO app_be USING ((workspace_id IS NOT NULL));

--
-- Name: brain_commands brain_commands_app_be_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY brain_commands_app_be_insert ON public.brain_commands FOR INSERT TO app_be WITH CHECK ((workspace_id IS NOT NULL));

--
-- Name: brain_commands brain_commands_app_be_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY brain_commands_app_be_select ON public.brain_commands FOR SELECT TO app_be USING ((workspace_id IS NOT NULL));

--
-- Name: brain_commands brain_commands_app_be_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY brain_commands_app_be_update ON public.brain_commands FOR UPDATE TO app_be USING ((workspace_id IS NOT NULL)) WITH CHECK ((workspace_id IS NOT NULL));

--
-- Name: brain_commands brain_commands_authenticated_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY brain_commands_authenticated_select ON public.brain_commands FOR SELECT TO authenticated USING ((requested_by = auth.uid()));

--
-- Name: brain_eval_cases; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.brain_eval_cases ENABLE ROW LEVEL SECURITY;

--
-- Name: brain_eval_cases brain_eval_cases_app_be_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY brain_eval_cases_app_be_delete ON public.brain_eval_cases FOR DELETE TO app_be USING ((workspace_id IS NOT NULL));

--
-- Name: brain_eval_cases brain_eval_cases_app_be_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY brain_eval_cases_app_be_insert ON public.brain_eval_cases FOR INSERT TO app_be WITH CHECK ((workspace_id IS NOT NULL));

--
-- Name: brain_eval_cases brain_eval_cases_app_be_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY brain_eval_cases_app_be_select ON public.brain_eval_cases FOR SELECT TO app_be USING ((workspace_id IS NOT NULL));

--
-- Name: brain_eval_cases brain_eval_cases_app_be_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY brain_eval_cases_app_be_update ON public.brain_eval_cases FOR UPDATE TO app_be USING ((workspace_id IS NOT NULL)) WITH CHECK ((workspace_id IS NOT NULL));

--
-- Name: brain_eval_cases brain_eval_cases_manager_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY brain_eval_cases_manager_select ON public.brain_eval_cases FOR SELECT TO authenticated USING (public.is_manager(workspace_id));

--
-- Name: brain_extractions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.brain_extractions ENABLE ROW LEVEL SECURITY;

--
-- Name: brain_extractions brain_extractions_app_be_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY brain_extractions_app_be_delete ON public.brain_extractions FOR DELETE TO app_be USING ((workspace_id IS NOT NULL));

--
-- Name: brain_extractions brain_extractions_app_be_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY brain_extractions_app_be_insert ON public.brain_extractions FOR INSERT TO app_be WITH CHECK ((workspace_id IS NOT NULL));

--
-- Name: brain_extractions brain_extractions_app_be_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY brain_extractions_app_be_select ON public.brain_extractions FOR SELECT TO app_be USING ((workspace_id IS NOT NULL));

--
-- Name: brain_extractions brain_extractions_app_be_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY brain_extractions_app_be_update ON public.brain_extractions FOR UPDATE TO app_be USING ((workspace_id IS NOT NULL)) WITH CHECK ((workspace_id IS NOT NULL));

--
-- Name: brain_extractions brain_extractions_manager_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY brain_extractions_manager_select ON public.brain_extractions FOR SELECT TO authenticated USING (public.is_manager(workspace_id));

--
-- Name: brain_facts; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.brain_facts ENABLE ROW LEVEL SECURITY;

--
-- Name: brain_facts brain_facts_app_be_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY brain_facts_app_be_delete ON public.brain_facts FOR DELETE TO app_be USING ((workspace_id IS NOT NULL));

--
-- Name: brain_facts brain_facts_app_be_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY brain_facts_app_be_insert ON public.brain_facts FOR INSERT TO app_be WITH CHECK ((workspace_id IS NOT NULL));

--
-- Name: brain_facts brain_facts_app_be_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY brain_facts_app_be_select ON public.brain_facts FOR SELECT TO app_be USING ((workspace_id IS NOT NULL));

--
-- Name: brain_facts brain_facts_app_be_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY brain_facts_app_be_update ON public.brain_facts FOR UPDATE TO app_be USING ((workspace_id IS NOT NULL)) WITH CHECK ((workspace_id IS NOT NULL));

--
-- Name: brain_facts brain_facts_manager_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY brain_facts_manager_select ON public.brain_facts FOR SELECT TO authenticated USING ((public.is_manager(workspace_id) OR ((scope <> 'restricted'::text) AND public.is_member(workspace_id))));

--
-- Name: brain_lessons; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.brain_lessons ENABLE ROW LEVEL SECURITY;

--
-- Name: brain_lessons brain_lessons_app_be_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY brain_lessons_app_be_delete ON public.brain_lessons FOR DELETE TO app_be USING ((workspace_id IS NOT NULL));

--
-- Name: brain_lessons brain_lessons_app_be_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY brain_lessons_app_be_insert ON public.brain_lessons FOR INSERT TO app_be WITH CHECK ((workspace_id IS NOT NULL));

--
-- Name: brain_lessons brain_lessons_app_be_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY brain_lessons_app_be_select ON public.brain_lessons FOR SELECT TO app_be USING ((workspace_id IS NOT NULL));

--
-- Name: brain_lessons brain_lessons_app_be_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY brain_lessons_app_be_update ON public.brain_lessons FOR UPDATE TO app_be USING ((workspace_id IS NOT NULL)) WITH CHECK ((workspace_id IS NOT NULL));

--
-- Name: brain_lessons brain_lessons_member_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY brain_lessons_member_select ON public.brain_lessons FOR SELECT TO authenticated USING (public.is_member(workspace_id));

--
-- Name: brain_source_profiles; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.brain_source_profiles ENABLE ROW LEVEL SECURITY;

--
-- Name: brain_source_profiles brain_source_profiles_app_be_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY brain_source_profiles_app_be_delete ON public.brain_source_profiles FOR DELETE TO app_be USING ((workspace_id IS NOT NULL));

--
-- Name: brain_source_profiles brain_source_profiles_app_be_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY brain_source_profiles_app_be_insert ON public.brain_source_profiles FOR INSERT TO app_be WITH CHECK ((workspace_id IS NOT NULL));

--
-- Name: brain_source_profiles brain_source_profiles_app_be_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY brain_source_profiles_app_be_select ON public.brain_source_profiles FOR SELECT TO app_be USING ((workspace_id IS NOT NULL));

--
-- Name: brain_source_profiles brain_source_profiles_app_be_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY brain_source_profiles_app_be_update ON public.brain_source_profiles FOR UPDATE TO app_be USING ((workspace_id IS NOT NULL)) WITH CHECK ((workspace_id IS NOT NULL));

--
-- Name: brain_source_profiles brain_source_profiles_manager_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY brain_source_profiles_manager_select ON public.brain_source_profiles FOR SELECT TO authenticated USING (public.is_manager(workspace_id));

--
-- Name: channel_receipts; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.channel_receipts ENABLE ROW LEVEL SECURITY;

--
-- Name: channel_receipts channel_receipts_app_be_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY channel_receipts_app_be_insert ON public.channel_receipts FOR INSERT TO app_be WITH CHECK ((workspace_id IS NOT NULL));

--
-- Name: channel_receipts channel_receipts_app_be_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY channel_receipts_app_be_select ON public.channel_receipts FOR SELECT TO app_be USING ((workspace_id IS NOT NULL));

--
-- Name: connection_commands; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.connection_commands ENABLE ROW LEVEL SECURITY;

--
-- Name: connection_commands connection_commands_app_be_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY connection_commands_app_be_select ON public.connection_commands FOR SELECT TO app_be USING ((user_id IS NOT NULL));

--
-- Name: connection_commands connection_commands_app_be_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY connection_commands_app_be_update ON public.connection_commands FOR UPDATE TO app_be USING ((user_id IS NOT NULL)) WITH CHECK ((user_id IS NOT NULL));

--
-- Name: connection_secrets; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.connection_secrets ENABLE ROW LEVEL SECURITY;

--
-- Name: connection_secrets connection_secrets_app_be_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY connection_secrets_app_be_delete ON public.connection_secrets FOR DELETE TO app_be USING ((connection_id IS NOT NULL));

--
-- Name: connection_secrets connection_secrets_app_be_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY connection_secrets_app_be_insert ON public.connection_secrets FOR INSERT TO app_be WITH CHECK ((connection_id IS NOT NULL));

--
-- Name: connection_secrets connection_secrets_app_be_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY connection_secrets_app_be_select ON public.connection_secrets FOR SELECT TO app_be USING ((connection_id IS NOT NULL));

--
-- Name: connection_secrets connection_secrets_app_be_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY connection_secrets_app_be_update ON public.connection_secrets FOR UPDATE TO app_be USING ((connection_id IS NOT NULL)) WITH CHECK ((connection_id IS NOT NULL));

--
-- Name: connections; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.connections ENABLE ROW LEVEL SECURITY;

--
-- Name: connections connections_app_be_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY connections_app_be_delete ON public.connections FOR DELETE TO app_be USING ((workspace_id IS NOT NULL));

--
-- Name: connections connections_app_be_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY connections_app_be_insert ON public.connections FOR INSERT TO app_be WITH CHECK ((workspace_id IS NOT NULL));

--
-- Name: connections connections_app_be_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY connections_app_be_select ON public.connections FOR SELECT TO app_be USING ((workspace_id IS NOT NULL));

--
-- Name: connections connections_app_be_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY connections_app_be_update ON public.connections FOR UPDATE TO app_be USING ((workspace_id IS NOT NULL)) WITH CHECK ((workspace_id IS NOT NULL));

--
-- Name: connections connections_member_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY connections_member_select ON public.connections FOR SELECT TO authenticated USING (public.is_member(workspace_id));

--
-- Name: connections connections_platform_admin_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY connections_platform_admin_select ON public.connections FOR SELECT TO authenticated USING (( SELECT public.is_platform_admin() AS is_platform_admin));

--
-- Name: connector_interest; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.connector_interest ENABLE ROW LEVEL SECURITY;

--
-- Name: connector_interest connector_interest_app_be_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY connector_interest_app_be_delete ON public.connector_interest FOR DELETE TO app_be USING ((workspace_id IS NOT NULL));

--
-- Name: connector_interest connector_interest_app_be_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY connector_interest_app_be_insert ON public.connector_interest FOR INSERT TO app_be WITH CHECK ((workspace_id IS NOT NULL));

--
-- Name: connector_interest connector_interest_app_be_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY connector_interest_app_be_select ON public.connector_interest FOR SELECT TO app_be USING ((workspace_id IS NOT NULL));

--
-- Name: connector_interest connector_interest_app_be_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY connector_interest_app_be_update ON public.connector_interest FOR UPDATE TO app_be USING ((workspace_id IS NOT NULL)) WITH CHECK ((workspace_id IS NOT NULL));

--
-- Name: connector_interest connector_interest_member_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY connector_interest_member_select ON public.connector_interest FOR SELECT TO authenticated USING (public.is_member(workspace_id));

--
-- Name: content_cadence; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.content_cadence ENABLE ROW LEVEL SECURITY;

--
-- Name: content_cadence content_cadence_app_be_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY content_cadence_app_be_delete ON public.content_cadence FOR DELETE TO app_be USING ((workspace_id IS NOT NULL));

--
-- Name: content_cadence content_cadence_app_be_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY content_cadence_app_be_insert ON public.content_cadence FOR INSERT TO app_be WITH CHECK ((workspace_id IS NOT NULL));

--
-- Name: content_cadence content_cadence_app_be_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY content_cadence_app_be_select ON public.content_cadence FOR SELECT TO app_be USING ((workspace_id IS NOT NULL));

--
-- Name: content_cadence content_cadence_app_be_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY content_cadence_app_be_update ON public.content_cadence FOR UPDATE TO app_be USING ((workspace_id IS NOT NULL)) WITH CHECK ((workspace_id IS NOT NULL));

--
-- Name: content_cadence content_cadence_manager_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY content_cadence_manager_all ON public.content_cadence TO authenticated USING (public.is_manager(workspace_id)) WITH CHECK (public.is_manager(workspace_id));

--
-- Name: content_cadence content_cadence_member_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY content_cadence_member_select ON public.content_cadence FOR SELECT TO authenticated USING (public.is_member(workspace_id));

--
-- Name: content_items; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.content_items ENABLE ROW LEVEL SECURITY;

--
-- Name: content_items content_items_app_be_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY content_items_app_be_delete ON public.content_items FOR DELETE TO app_be USING ((workspace_id IS NOT NULL));

--
-- Name: content_items content_items_app_be_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY content_items_app_be_insert ON public.content_items FOR INSERT TO app_be WITH CHECK ((workspace_id IS NOT NULL));

--
-- Name: content_items content_items_app_be_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY content_items_app_be_select ON public.content_items FOR SELECT TO app_be USING ((workspace_id IS NOT NULL));

--
-- Name: content_items content_items_app_be_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY content_items_app_be_update ON public.content_items FOR UPDATE TO app_be USING ((workspace_id IS NOT NULL)) WITH CHECK ((workspace_id IS NOT NULL));

--
-- Name: content_items content_items_manager_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY content_items_manager_all ON public.content_items TO authenticated USING (public.is_manager(workspace_id)) WITH CHECK (public.is_manager(workspace_id));

--
-- Name: content_items content_items_member_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY content_items_member_select ON public.content_items FOR SELECT TO authenticated USING (public.is_member(workspace_id));

--
-- Name: content_pillars; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.content_pillars ENABLE ROW LEVEL SECURITY;

--
-- Name: content_pillars content_pillars_app_be_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY content_pillars_app_be_delete ON public.content_pillars FOR DELETE TO app_be USING ((workspace_id IS NOT NULL));

--
-- Name: content_pillars content_pillars_app_be_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY content_pillars_app_be_insert ON public.content_pillars FOR INSERT TO app_be WITH CHECK ((workspace_id IS NOT NULL));

--
-- Name: content_pillars content_pillars_app_be_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY content_pillars_app_be_select ON public.content_pillars FOR SELECT TO app_be USING ((workspace_id IS NOT NULL));

--
-- Name: content_pillars content_pillars_app_be_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY content_pillars_app_be_update ON public.content_pillars FOR UPDATE TO app_be USING ((workspace_id IS NOT NULL)) WITH CHECK ((workspace_id IS NOT NULL));

--
-- Name: content_pillars content_pillars_manager_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY content_pillars_manager_all ON public.content_pillars TO authenticated USING (public.is_manager(workspace_id)) WITH CHECK (public.is_manager(workspace_id));

--
-- Name: content_pillars content_pillars_member_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY content_pillars_member_select ON public.content_pillars FOR SELECT TO authenticated USING (public.is_member(workspace_id));

--
-- Name: content_plans; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.content_plans ENABLE ROW LEVEL SECURITY;

--
-- Name: content_plans content_plans_app_be_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY content_plans_app_be_delete ON public.content_plans FOR DELETE TO app_be USING ((workspace_id IS NOT NULL));

--
-- Name: content_plans content_plans_app_be_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY content_plans_app_be_insert ON public.content_plans FOR INSERT TO app_be WITH CHECK ((workspace_id IS NOT NULL));

--
-- Name: content_plans content_plans_app_be_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY content_plans_app_be_select ON public.content_plans FOR SELECT TO app_be USING ((workspace_id IS NOT NULL));

--
-- Name: content_plans content_plans_app_be_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY content_plans_app_be_update ON public.content_plans FOR UPDATE TO app_be USING ((workspace_id IS NOT NULL)) WITH CHECK ((workspace_id IS NOT NULL));

--
-- Name: content_plans content_plans_manager_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY content_plans_manager_all ON public.content_plans TO authenticated USING (public.is_manager(workspace_id)) WITH CHECK (public.is_manager(workspace_id));

--
-- Name: content_plans content_plans_member_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY content_plans_member_select ON public.content_plans FOR SELECT TO authenticated USING (public.is_member(workspace_id));

--
-- Name: content_settings; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.content_settings ENABLE ROW LEVEL SECURITY;

--
-- Name: content_settings content_settings_app_be_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY content_settings_app_be_delete ON public.content_settings FOR DELETE TO app_be USING ((workspace_id IS NOT NULL));

--
-- Name: content_settings content_settings_app_be_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY content_settings_app_be_insert ON public.content_settings FOR INSERT TO app_be WITH CHECK ((workspace_id IS NOT NULL));

--
-- Name: content_settings content_settings_app_be_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY content_settings_app_be_select ON public.content_settings FOR SELECT TO app_be USING ((workspace_id IS NOT NULL));

--
-- Name: content_settings content_settings_app_be_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY content_settings_app_be_update ON public.content_settings FOR UPDATE TO app_be USING ((workspace_id IS NOT NULL)) WITH CHECK ((workspace_id IS NOT NULL));

--
-- Name: content_settings content_settings_manager_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY content_settings_manager_all ON public.content_settings TO authenticated USING (public.is_manager(workspace_id)) WITH CHECK (public.is_manager(workspace_id));

--
-- Name: content_settings content_settings_member_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY content_settings_member_select ON public.content_settings FOR SELECT TO authenticated USING (public.is_member(workspace_id));

--
-- Name: contracts; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.contracts ENABLE ROW LEVEL SECURITY;

--
-- Name: contracts contracts_app_be_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY contracts_app_be_delete ON public.contracts FOR DELETE TO app_be USING ((workspace_id IS NOT NULL));

--
-- Name: contracts contracts_app_be_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY contracts_app_be_insert ON public.contracts FOR INSERT TO app_be WITH CHECK ((workspace_id IS NOT NULL));

--
-- Name: contracts contracts_app_be_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY contracts_app_be_select ON public.contracts FOR SELECT TO app_be USING ((workspace_id IS NOT NULL));

--
-- Name: contracts contracts_app_be_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY contracts_app_be_update ON public.contracts FOR UPDATE TO app_be USING ((workspace_id IS NOT NULL)) WITH CHECK ((workspace_id IS NOT NULL));

--
-- Name: contracts contracts_member_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY contracts_member_insert ON public.contracts FOR INSERT TO authenticated WITH CHECK (public.is_member(workspace_id));

--
-- Name: contracts contracts_member_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY contracts_member_select ON public.contracts FOR SELECT TO authenticated USING (public.is_member(workspace_id));

--
-- Name: contracts contracts_member_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY contracts_member_update ON public.contracts FOR UPDATE TO authenticated USING (public.is_member(workspace_id)) WITH CHECK (public.is_member(workspace_id));

--
-- Name: credit_pack_purchases; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.credit_pack_purchases ENABLE ROW LEVEL SECURITY;

--
-- Name: credit_pack_purchases credit_pack_purchases_app_be_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY credit_pack_purchases_app_be_select ON public.credit_pack_purchases FOR SELECT TO app_be USING ((workspace_id IS NOT NULL));

--
-- Name: credit_pack_purchases credit_pack_purchases_manager_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY credit_pack_purchases_manager_select ON public.credit_pack_purchases FOR SELECT TO authenticated USING (public.is_manager(workspace_id));

--
-- Name: credit_packs; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.credit_packs ENABLE ROW LEVEL SECURITY;

--
-- Name: credit_packs credit_packs_app_be_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY credit_packs_app_be_select ON public.credit_packs FOR SELECT TO app_be USING ((code IS NOT NULL));

--
-- Name: credit_packs credit_packs_authenticated_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY credit_packs_authenticated_select ON public.credit_packs FOR SELECT TO authenticated USING ((auth.uid() IS NOT NULL));

--
-- Name: credit_topup_draws; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.credit_topup_draws ENABLE ROW LEVEL SECURITY;

--
-- Name: credit_topup_draws credit_topup_draws_app_be_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY credit_topup_draws_app_be_delete ON public.credit_topup_draws FOR DELETE TO app_be USING ((workspace_id IS NOT NULL));

--
-- Name: credit_topup_draws credit_topup_draws_app_be_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY credit_topup_draws_app_be_insert ON public.credit_topup_draws FOR INSERT TO app_be WITH CHECK ((workspace_id IS NOT NULL));

--
-- Name: credit_topup_draws credit_topup_draws_app_be_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY credit_topup_draws_app_be_select ON public.credit_topup_draws FOR SELECT TO app_be USING ((workspace_id IS NOT NULL));

--
-- Name: credit_topup_draws credit_topup_draws_app_be_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY credit_topup_draws_app_be_update ON public.credit_topup_draws FOR UPDATE TO app_be USING ((workspace_id IS NOT NULL)) WITH CHECK ((workspace_id IS NOT NULL));

--
-- Name: credit_topup_draws credit_topup_draws_manager_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY credit_topup_draws_manager_select ON public.credit_topup_draws FOR SELECT TO authenticated USING (public.is_manager(workspace_id));

--
-- Name: credit_topups; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.credit_topups ENABLE ROW LEVEL SECURITY;

--
-- Name: credit_topups credit_topups_app_be_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY credit_topups_app_be_delete ON public.credit_topups FOR DELETE TO app_be USING ((workspace_id IS NOT NULL));

--
-- Name: credit_topups credit_topups_app_be_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY credit_topups_app_be_insert ON public.credit_topups FOR INSERT TO app_be WITH CHECK ((workspace_id IS NOT NULL));

--
-- Name: credit_topups credit_topups_app_be_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY credit_topups_app_be_select ON public.credit_topups FOR SELECT TO app_be USING ((workspace_id IS NOT NULL));

--
-- Name: credit_topups credit_topups_app_be_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY credit_topups_app_be_update ON public.credit_topups FOR UPDATE TO app_be USING ((workspace_id IS NOT NULL)) WITH CHECK ((workspace_id IS NOT NULL));

--
-- Name: credit_topups credit_topups_manager_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY credit_topups_manager_select ON public.credit_topups FOR SELECT TO authenticated USING (public.is_manager(workspace_id));

--
-- Name: data_records; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.data_records ENABLE ROW LEVEL SECURITY;

--
-- Name: data_records data_records_app_be_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY data_records_app_be_delete ON public.data_records FOR DELETE TO app_be USING ((workspace_id IS NOT NULL));

--
-- Name: data_records data_records_app_be_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY data_records_app_be_insert ON public.data_records FOR INSERT TO app_be WITH CHECK ((workspace_id IS NOT NULL));

--
-- Name: data_records data_records_app_be_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY data_records_app_be_select ON public.data_records FOR SELECT TO app_be USING ((workspace_id IS NOT NULL));

--
-- Name: data_records data_records_app_be_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY data_records_app_be_update ON public.data_records FOR UPDATE TO app_be USING ((workspace_id IS NOT NULL)) WITH CHECK ((workspace_id IS NOT NULL));

--
-- Name: data_records data_records_manager_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY data_records_manager_select ON public.data_records FOR SELECT TO authenticated USING (public.is_manager(workspace_id));

--
-- Name: data_sync_runs; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.data_sync_runs ENABLE ROW LEVEL SECURITY;

--
-- Name: data_sync_runs data_sync_runs_app_be_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY data_sync_runs_app_be_delete ON public.data_sync_runs FOR DELETE TO app_be USING ((workspace_id IS NOT NULL));

--
-- Name: data_sync_runs data_sync_runs_app_be_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY data_sync_runs_app_be_insert ON public.data_sync_runs FOR INSERT TO app_be WITH CHECK ((workspace_id IS NOT NULL));

--
-- Name: data_sync_runs data_sync_runs_app_be_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY data_sync_runs_app_be_select ON public.data_sync_runs FOR SELECT TO app_be USING ((workspace_id IS NOT NULL));

--
-- Name: data_sync_runs data_sync_runs_app_be_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY data_sync_runs_app_be_update ON public.data_sync_runs FOR UPDATE TO app_be USING ((workspace_id IS NOT NULL)) WITH CHECK ((workspace_id IS NOT NULL));

--
-- Name: data_sync_runs data_sync_runs_manager_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY data_sync_runs_manager_select ON public.data_sync_runs FOR SELECT TO authenticated USING (public.is_manager(workspace_id));

--
-- Name: decisions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.decisions ENABLE ROW LEVEL SECURITY;

--
-- Name: decisions decisions_app_be_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY decisions_app_be_insert ON public.decisions FOR INSERT TO app_be WITH CHECK ((workspace_id IS NOT NULL));

--
-- Name: decisions decisions_app_be_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY decisions_app_be_select ON public.decisions FOR SELECT TO app_be USING ((workspace_id IS NOT NULL));

--
-- Name: decisions decisions_member_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY decisions_member_insert ON public.decisions FOR INSERT TO authenticated WITH CHECK (public.is_member(workspace_id));

--
-- Name: decisions decisions_member_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY decisions_member_select ON public.decisions FOR SELECT TO authenticated USING (public.is_member(workspace_id));

--
-- Name: email_messages; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.email_messages ENABLE ROW LEVEL SECURITY;

--
-- Name: email_messages email_messages_app_be_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY email_messages_app_be_delete ON public.email_messages FOR DELETE TO app_be USING ((workspace_id IS NOT NULL));

--
-- Name: email_messages email_messages_app_be_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY email_messages_app_be_insert ON public.email_messages FOR INSERT TO app_be WITH CHECK ((workspace_id IS NOT NULL));

--
-- Name: email_messages email_messages_app_be_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY email_messages_app_be_select ON public.email_messages FOR SELECT TO app_be USING ((workspace_id IS NOT NULL));

--
-- Name: email_messages email_messages_app_be_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY email_messages_app_be_update ON public.email_messages FOR UPDATE TO app_be USING ((workspace_id IS NOT NULL)) WITH CHECK ((workspace_id IS NOT NULL));

--
-- Name: email_messages email_messages_member_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY email_messages_member_select ON public.email_messages FOR SELECT TO authenticated USING (public.is_member(workspace_id));

--
-- Name: events; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;

--
-- Name: events events_app_be_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY events_app_be_insert ON public.events FOR INSERT TO app_be WITH CHECK ((workspace_id IS NOT NULL));

--
-- Name: events events_app_be_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY events_app_be_select ON public.events FOR SELECT TO app_be USING ((workspace_id IS NOT NULL));

--
-- Name: events events_member_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY events_member_insert ON public.events FOR INSERT TO authenticated WITH CHECK (public.is_member(workspace_id));

--
-- Name: events events_member_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY events_member_select ON public.events FOR SELECT TO authenticated USING (public.is_member(workspace_id));

--
-- Name: executions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.executions ENABLE ROW LEVEL SECURITY;

--
-- Name: executions executions_app_be_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY executions_app_be_delete ON public.executions FOR DELETE TO app_be USING ((workspace_id IS NOT NULL));

--
-- Name: executions executions_app_be_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY executions_app_be_insert ON public.executions FOR INSERT TO app_be WITH CHECK ((workspace_id IS NOT NULL));

--
-- Name: executions executions_app_be_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY executions_app_be_select ON public.executions FOR SELECT TO app_be USING ((workspace_id IS NOT NULL));

--
-- Name: executions executions_app_be_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY executions_app_be_update ON public.executions FOR UPDATE TO app_be USING ((workspace_id IS NOT NULL)) WITH CHECK ((workspace_id IS NOT NULL));

--
-- Name: executions executions_member_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY executions_member_all ON public.executions TO authenticated USING (public.is_member(workspace_id)) WITH CHECK (public.is_member(workspace_id));

--
-- Name: hiring_apply_hits; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.hiring_apply_hits ENABLE ROW LEVEL SECURITY;

--
-- Name: hiring_apply_hits hiring_apply_hits_app_be_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY hiring_apply_hits_app_be_delete ON public.hiring_apply_hits FOR DELETE TO app_be USING ((workspace_id IS NOT NULL));

--
-- Name: hiring_apply_hits hiring_apply_hits_app_be_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY hiring_apply_hits_app_be_insert ON public.hiring_apply_hits FOR INSERT TO app_be WITH CHECK ((workspace_id IS NOT NULL));

--
-- Name: hiring_apply_hits hiring_apply_hits_app_be_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY hiring_apply_hits_app_be_select ON public.hiring_apply_hits FOR SELECT TO app_be USING ((workspace_id IS NOT NULL));

--
-- Name: hiring_apply_hits hiring_apply_hits_app_be_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY hiring_apply_hits_app_be_update ON public.hiring_apply_hits FOR UPDATE TO app_be USING ((workspace_id IS NOT NULL)) WITH CHECK ((workspace_id IS NOT NULL));

--
-- Name: hiring_availability; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.hiring_availability ENABLE ROW LEVEL SECURITY;

--
-- Name: hiring_availability hiring_availability_app_be_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY hiring_availability_app_be_delete ON public.hiring_availability FOR DELETE TO app_be USING ((workspace_id IS NOT NULL));

--
-- Name: hiring_availability hiring_availability_app_be_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY hiring_availability_app_be_insert ON public.hiring_availability FOR INSERT TO app_be WITH CHECK ((workspace_id IS NOT NULL));

--
-- Name: hiring_availability hiring_availability_app_be_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY hiring_availability_app_be_select ON public.hiring_availability FOR SELECT TO app_be USING ((workspace_id IS NOT NULL));

--
-- Name: hiring_availability hiring_availability_app_be_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY hiring_availability_app_be_update ON public.hiring_availability FOR UPDATE TO app_be USING ((workspace_id IS NOT NULL)) WITH CHECK ((workspace_id IS NOT NULL));

--
-- Name: hiring_availability hiring_availability_manager_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY hiring_availability_manager_all ON public.hiring_availability TO authenticated USING ((public.is_manager(workspace_id) OR (public.is_member(workspace_id) AND (member_user_id = auth.uid())))) WITH CHECK ((public.is_manager(workspace_id) OR (public.is_member(workspace_id) AND (member_user_id = auth.uid()))));

--
-- Name: hiring_availability hiring_availability_member_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY hiring_availability_member_select ON public.hiring_availability FOR SELECT TO authenticated USING (public.is_member(workspace_id));

--
-- Name: hiring_candidates; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.hiring_candidates ENABLE ROW LEVEL SECURITY;

--
-- Name: hiring_candidates hiring_candidates_app_be_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY hiring_candidates_app_be_delete ON public.hiring_candidates FOR DELETE TO app_be USING ((workspace_id IS NOT NULL));

--
-- Name: hiring_candidates hiring_candidates_app_be_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY hiring_candidates_app_be_insert ON public.hiring_candidates FOR INSERT TO app_be WITH CHECK ((workspace_id IS NOT NULL));

--
-- Name: hiring_candidates hiring_candidates_app_be_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY hiring_candidates_app_be_select ON public.hiring_candidates FOR SELECT TO app_be USING ((workspace_id IS NOT NULL));

--
-- Name: hiring_candidates hiring_candidates_app_be_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY hiring_candidates_app_be_update ON public.hiring_candidates FOR UPDATE TO app_be USING ((workspace_id IS NOT NULL)) WITH CHECK ((workspace_id IS NOT NULL));

--
-- Name: hiring_candidates hiring_candidates_manager_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY hiring_candidates_manager_all ON public.hiring_candidates TO authenticated USING (public.is_manager(workspace_id)) WITH CHECK (public.is_manager(workspace_id));

--
-- Name: hiring_consents; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.hiring_consents ENABLE ROW LEVEL SECURITY;

--
-- Name: hiring_consents hiring_consents_app_be_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY hiring_consents_app_be_insert ON public.hiring_consents FOR INSERT TO app_be WITH CHECK ((workspace_id IS NOT NULL));

--
-- Name: hiring_consents hiring_consents_app_be_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY hiring_consents_app_be_select ON public.hiring_consents FOR SELECT TO app_be USING ((workspace_id IS NOT NULL));

--
-- Name: hiring_consents hiring_consents_manager_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY hiring_consents_manager_select ON public.hiring_consents FOR SELECT TO authenticated USING (public.is_manager(workspace_id));

--
-- Name: hiring_events; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.hiring_events ENABLE ROW LEVEL SECURITY;

--
-- Name: hiring_events hiring_events_app_be_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY hiring_events_app_be_insert ON public.hiring_events FOR INSERT TO app_be WITH CHECK ((workspace_id IS NOT NULL));

--
-- Name: hiring_events hiring_events_app_be_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY hiring_events_app_be_select ON public.hiring_events FOR SELECT TO app_be USING ((workspace_id IS NOT NULL));

--
-- Name: hiring_events hiring_events_manager_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY hiring_events_manager_select ON public.hiring_events FOR SELECT TO authenticated USING (public.is_manager(workspace_id));

--
-- Name: hiring_interviews; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.hiring_interviews ENABLE ROW LEVEL SECURITY;

--
-- Name: hiring_interviews hiring_interviews_app_be_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY hiring_interviews_app_be_delete ON public.hiring_interviews FOR DELETE TO app_be USING ((workspace_id IS NOT NULL));

--
-- Name: hiring_interviews hiring_interviews_app_be_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY hiring_interviews_app_be_insert ON public.hiring_interviews FOR INSERT TO app_be WITH CHECK ((workspace_id IS NOT NULL));

--
-- Name: hiring_interviews hiring_interviews_app_be_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY hiring_interviews_app_be_select ON public.hiring_interviews FOR SELECT TO app_be USING ((workspace_id IS NOT NULL));

--
-- Name: hiring_interviews hiring_interviews_app_be_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY hiring_interviews_app_be_update ON public.hiring_interviews FOR UPDATE TO app_be USING ((workspace_id IS NOT NULL)) WITH CHECK ((workspace_id IS NOT NULL));

--
-- Name: hiring_interviews hiring_interviews_manager_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY hiring_interviews_manager_all ON public.hiring_interviews TO authenticated USING (public.is_manager(workspace_id)) WITH CHECK (public.is_manager(workspace_id));

--
-- Name: hiring_interviews hiring_interviews_member_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY hiring_interviews_member_select ON public.hiring_interviews FOR SELECT TO authenticated USING (((interviewer_user_id = auth.uid()) AND public.is_member(workspace_id)));

--
-- Name: hiring_jobs; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.hiring_jobs ENABLE ROW LEVEL SECURITY;

--
-- Name: hiring_jobs hiring_jobs_app_be_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY hiring_jobs_app_be_delete ON public.hiring_jobs FOR DELETE TO app_be USING ((workspace_id IS NOT NULL));

--
-- Name: hiring_jobs hiring_jobs_app_be_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY hiring_jobs_app_be_insert ON public.hiring_jobs FOR INSERT TO app_be WITH CHECK ((workspace_id IS NOT NULL));

--
-- Name: hiring_jobs hiring_jobs_app_be_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY hiring_jobs_app_be_select ON public.hiring_jobs FOR SELECT TO app_be USING ((workspace_id IS NOT NULL));

--
-- Name: hiring_jobs hiring_jobs_app_be_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY hiring_jobs_app_be_update ON public.hiring_jobs FOR UPDATE TO app_be USING ((workspace_id IS NOT NULL)) WITH CHECK ((workspace_id IS NOT NULL));

--
-- Name: hiring_jobs hiring_jobs_manager_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY hiring_jobs_manager_all ON public.hiring_jobs TO authenticated USING (public.is_manager(workspace_id)) WITH CHECK (public.is_manager(workspace_id));

--
-- Name: hiring_jobs hiring_jobs_member_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY hiring_jobs_member_select ON public.hiring_jobs FOR SELECT TO authenticated USING (public.is_member(workspace_id));

--
-- Name: hiring_offers; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.hiring_offers ENABLE ROW LEVEL SECURITY;

--
-- Name: hiring_offers hiring_offers_app_be_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY hiring_offers_app_be_delete ON public.hiring_offers FOR DELETE TO app_be USING ((workspace_id IS NOT NULL));

--
-- Name: hiring_offers hiring_offers_app_be_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY hiring_offers_app_be_insert ON public.hiring_offers FOR INSERT TO app_be WITH CHECK ((workspace_id IS NOT NULL));

--
-- Name: hiring_offers hiring_offers_app_be_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY hiring_offers_app_be_select ON public.hiring_offers FOR SELECT TO app_be USING ((workspace_id IS NOT NULL));

--
-- Name: hiring_offers hiring_offers_app_be_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY hiring_offers_app_be_update ON public.hiring_offers FOR UPDATE TO app_be USING ((workspace_id IS NOT NULL)) WITH CHECK ((workspace_id IS NOT NULL));

--
-- Name: hiring_offers hiring_offers_manager_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY hiring_offers_manager_all ON public.hiring_offers TO authenticated USING (public.is_manager(workspace_id)) WITH CHECK (public.is_manager(workspace_id));

--
-- Name: hiring_onboarding; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.hiring_onboarding ENABLE ROW LEVEL SECURITY;

--
-- Name: hiring_onboarding hiring_onboarding_app_be_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY hiring_onboarding_app_be_delete ON public.hiring_onboarding FOR DELETE TO app_be USING ((workspace_id IS NOT NULL));

--
-- Name: hiring_onboarding hiring_onboarding_app_be_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY hiring_onboarding_app_be_insert ON public.hiring_onboarding FOR INSERT TO app_be WITH CHECK ((workspace_id IS NOT NULL));

--
-- Name: hiring_onboarding hiring_onboarding_app_be_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY hiring_onboarding_app_be_select ON public.hiring_onboarding FOR SELECT TO app_be USING ((workspace_id IS NOT NULL));

--
-- Name: hiring_onboarding hiring_onboarding_app_be_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY hiring_onboarding_app_be_update ON public.hiring_onboarding FOR UPDATE TO app_be USING ((workspace_id IS NOT NULL)) WITH CHECK ((workspace_id IS NOT NULL));

--
-- Name: hiring_onboarding hiring_onboarding_manager_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY hiring_onboarding_manager_all ON public.hiring_onboarding TO authenticated USING (public.is_manager(workspace_id)) WITH CHECK (public.is_manager(workspace_id));

--
-- Name: hiring_retention_log; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.hiring_retention_log ENABLE ROW LEVEL SECURITY;

--
-- Name: hiring_retention_log hiring_retention_log_app_be_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY hiring_retention_log_app_be_insert ON public.hiring_retention_log FOR INSERT TO app_be WITH CHECK ((workspace_id IS NOT NULL));

--
-- Name: hiring_retention_log hiring_retention_log_app_be_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY hiring_retention_log_app_be_select ON public.hiring_retention_log FOR SELECT TO app_be USING ((workspace_id IS NOT NULL));

--
-- Name: hiring_retention_log hiring_retention_log_manager_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY hiring_retention_log_manager_select ON public.hiring_retention_log FOR SELECT TO authenticated USING (public.is_manager(workspace_id));

--
-- Name: hiring_settings; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.hiring_settings ENABLE ROW LEVEL SECURITY;

--
-- Name: hiring_settings hiring_settings_app_be_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY hiring_settings_app_be_delete ON public.hiring_settings FOR DELETE TO app_be USING ((workspace_id IS NOT NULL));

--
-- Name: hiring_settings hiring_settings_app_be_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY hiring_settings_app_be_insert ON public.hiring_settings FOR INSERT TO app_be WITH CHECK ((workspace_id IS NOT NULL));

--
-- Name: hiring_settings hiring_settings_app_be_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY hiring_settings_app_be_select ON public.hiring_settings FOR SELECT TO app_be USING ((workspace_id IS NOT NULL));

--
-- Name: hiring_settings hiring_settings_app_be_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY hiring_settings_app_be_update ON public.hiring_settings FOR UPDATE TO app_be USING ((workspace_id IS NOT NULL)) WITH CHECK ((workspace_id IS NOT NULL));

--
-- Name: hiring_settings hiring_settings_manager_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY hiring_settings_manager_all ON public.hiring_settings TO authenticated USING (public.is_manager(workspace_id)) WITH CHECK (public.is_manager(workspace_id));

--
-- Name: hiring_settings hiring_settings_member_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY hiring_settings_member_select ON public.hiring_settings FOR SELECT TO authenticated USING (public.is_member(workspace_id));

--
-- Name: inbound_events; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.inbound_events ENABLE ROW LEVEL SECURITY;

--
-- Name: inbound_events inbound_events_app_be_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY inbound_events_app_be_delete ON public.inbound_events FOR DELETE TO app_be USING ((workspace_id IS NOT NULL));

--
-- Name: inbound_events inbound_events_app_be_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY inbound_events_app_be_insert ON public.inbound_events FOR INSERT TO app_be WITH CHECK ((workspace_id IS NOT NULL));

--
-- Name: inbound_events inbound_events_app_be_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY inbound_events_app_be_select ON public.inbound_events FOR SELECT TO app_be USING ((workspace_id IS NOT NULL));

--
-- Name: inbound_events inbound_events_app_be_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY inbound_events_app_be_update ON public.inbound_events FOR UPDATE TO app_be USING ((workspace_id IS NOT NULL)) WITH CHECK ((workspace_id IS NOT NULL));

--
-- Name: inbound_events inbound_events_member_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY inbound_events_member_all ON public.inbound_events TO authenticated USING (public.is_member(workspace_id)) WITH CHECK (public.is_member(workspace_id));

--
-- Name: inbound_events inbound_events_owner_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY inbound_events_owner_all ON public.inbound_events TO authenticated USING (public.owns_workspace(workspace_id)) WITH CHECK (public.owns_workspace(workspace_id));

--
-- Name: inventory_items; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.inventory_items ENABLE ROW LEVEL SECURITY;

--
-- Name: inventory_items inventory_items_app_be_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY inventory_items_app_be_delete ON public.inventory_items FOR DELETE TO app_be USING ((workspace_id IS NOT NULL));

--
-- Name: inventory_items inventory_items_app_be_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY inventory_items_app_be_insert ON public.inventory_items FOR INSERT TO app_be WITH CHECK ((workspace_id IS NOT NULL));

--
-- Name: inventory_items inventory_items_app_be_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY inventory_items_app_be_select ON public.inventory_items FOR SELECT TO app_be USING ((workspace_id IS NOT NULL));

--
-- Name: inventory_items inventory_items_app_be_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY inventory_items_app_be_update ON public.inventory_items FOR UPDATE TO app_be USING ((workspace_id IS NOT NULL)) WITH CHECK ((workspace_id IS NOT NULL));

--
-- Name: inventory_items inventory_items_member_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY inventory_items_member_select ON public.inventory_items FOR SELECT TO authenticated USING (public.is_member(workspace_id));

--
-- Name: inventory_locations; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.inventory_locations ENABLE ROW LEVEL SECURITY;

--
-- Name: inventory_locations inventory_locations_app_be_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY inventory_locations_app_be_delete ON public.inventory_locations FOR DELETE TO app_be USING ((workspace_id IS NOT NULL));

--
-- Name: inventory_locations inventory_locations_app_be_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY inventory_locations_app_be_insert ON public.inventory_locations FOR INSERT TO app_be WITH CHECK ((workspace_id IS NOT NULL));

--
-- Name: inventory_locations inventory_locations_app_be_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY inventory_locations_app_be_select ON public.inventory_locations FOR SELECT TO app_be USING ((workspace_id IS NOT NULL));

--
-- Name: inventory_locations inventory_locations_app_be_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY inventory_locations_app_be_update ON public.inventory_locations FOR UPDATE TO app_be USING ((workspace_id IS NOT NULL)) WITH CHECK ((workspace_id IS NOT NULL));

--
-- Name: inventory_locations inventory_locations_member_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY inventory_locations_member_select ON public.inventory_locations FOR SELECT TO authenticated USING (public.is_member(workspace_id));

--
-- Name: inventory_movements; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.inventory_movements ENABLE ROW LEVEL SECURITY;

--
-- Name: inventory_movements inventory_movements_app_be_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY inventory_movements_app_be_insert ON public.inventory_movements FOR INSERT TO app_be WITH CHECK ((workspace_id IS NOT NULL));

--
-- Name: inventory_movements inventory_movements_app_be_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY inventory_movements_app_be_select ON public.inventory_movements FOR SELECT TO app_be USING ((workspace_id IS NOT NULL));

--
-- Name: inventory_movements inventory_movements_member_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY inventory_movements_member_select ON public.inventory_movements FOR SELECT TO authenticated USING (public.is_member(workspace_id));

--
-- Name: inventory_po_lines; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.inventory_po_lines ENABLE ROW LEVEL SECURITY;

--
-- Name: inventory_po_lines inventory_po_lines_app_be_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY inventory_po_lines_app_be_delete ON public.inventory_po_lines FOR DELETE TO app_be USING ((workspace_id IS NOT NULL));

--
-- Name: inventory_po_lines inventory_po_lines_app_be_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY inventory_po_lines_app_be_insert ON public.inventory_po_lines FOR INSERT TO app_be WITH CHECK ((workspace_id IS NOT NULL));

--
-- Name: inventory_po_lines inventory_po_lines_app_be_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY inventory_po_lines_app_be_select ON public.inventory_po_lines FOR SELECT TO app_be USING ((workspace_id IS NOT NULL));

--
-- Name: inventory_po_lines inventory_po_lines_app_be_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY inventory_po_lines_app_be_update ON public.inventory_po_lines FOR UPDATE TO app_be USING ((workspace_id IS NOT NULL)) WITH CHECK ((workspace_id IS NOT NULL));

--
-- Name: inventory_po_lines inventory_po_lines_member_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY inventory_po_lines_member_select ON public.inventory_po_lines FOR SELECT TO authenticated USING (public.is_member(workspace_id));

--
-- Name: inventory_purchase_orders; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.inventory_purchase_orders ENABLE ROW LEVEL SECURITY;

--
-- Name: inventory_purchase_orders inventory_purchase_orders_app_be_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY inventory_purchase_orders_app_be_delete ON public.inventory_purchase_orders FOR DELETE TO app_be USING ((workspace_id IS NOT NULL));

--
-- Name: inventory_purchase_orders inventory_purchase_orders_app_be_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY inventory_purchase_orders_app_be_insert ON public.inventory_purchase_orders FOR INSERT TO app_be WITH CHECK ((workspace_id IS NOT NULL));

--
-- Name: inventory_purchase_orders inventory_purchase_orders_app_be_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY inventory_purchase_orders_app_be_select ON public.inventory_purchase_orders FOR SELECT TO app_be USING ((workspace_id IS NOT NULL));

--
-- Name: inventory_purchase_orders inventory_purchase_orders_app_be_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY inventory_purchase_orders_app_be_update ON public.inventory_purchase_orders FOR UPDATE TO app_be USING ((workspace_id IS NOT NULL)) WITH CHECK ((workspace_id IS NOT NULL));

--
-- Name: inventory_purchase_orders inventory_purchase_orders_member_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY inventory_purchase_orders_member_select ON public.inventory_purchase_orders FOR SELECT TO authenticated USING (public.is_member(workspace_id));

--
-- Name: inventory_receipts; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.inventory_receipts ENABLE ROW LEVEL SECURITY;

--
-- Name: inventory_receipts inventory_receipts_app_be_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY inventory_receipts_app_be_delete ON public.inventory_receipts FOR DELETE TO app_be USING ((workspace_id IS NOT NULL));

--
-- Name: inventory_receipts inventory_receipts_app_be_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY inventory_receipts_app_be_insert ON public.inventory_receipts FOR INSERT TO app_be WITH CHECK ((workspace_id IS NOT NULL));

--
-- Name: inventory_receipts inventory_receipts_app_be_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY inventory_receipts_app_be_select ON public.inventory_receipts FOR SELECT TO app_be USING ((workspace_id IS NOT NULL));

--
-- Name: inventory_receipts inventory_receipts_app_be_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY inventory_receipts_app_be_update ON public.inventory_receipts FOR UPDATE TO app_be USING ((workspace_id IS NOT NULL)) WITH CHECK ((workspace_id IS NOT NULL));

--
-- Name: inventory_receipts inventory_receipts_member_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY inventory_receipts_member_select ON public.inventory_receipts FOR SELECT TO authenticated USING (public.is_member(workspace_id));

--
-- Name: inventory_recipe_lines; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.inventory_recipe_lines ENABLE ROW LEVEL SECURITY;

--
-- Name: inventory_recipe_lines inventory_recipe_lines_app_be_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY inventory_recipe_lines_app_be_delete ON public.inventory_recipe_lines FOR DELETE TO app_be USING ((workspace_id IS NOT NULL));

--
-- Name: inventory_recipe_lines inventory_recipe_lines_app_be_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY inventory_recipe_lines_app_be_insert ON public.inventory_recipe_lines FOR INSERT TO app_be WITH CHECK ((workspace_id IS NOT NULL));

--
-- Name: inventory_recipe_lines inventory_recipe_lines_app_be_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY inventory_recipe_lines_app_be_select ON public.inventory_recipe_lines FOR SELECT TO app_be USING ((workspace_id IS NOT NULL));

--
-- Name: inventory_recipe_lines inventory_recipe_lines_app_be_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY inventory_recipe_lines_app_be_update ON public.inventory_recipe_lines FOR UPDATE TO app_be USING ((workspace_id IS NOT NULL)) WITH CHECK ((workspace_id IS NOT NULL));

--
-- Name: inventory_recipe_lines inventory_recipe_lines_member_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY inventory_recipe_lines_member_select ON public.inventory_recipe_lines FOR SELECT TO authenticated USING (public.is_member(workspace_id));

--
-- Name: inventory_recipes; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.inventory_recipes ENABLE ROW LEVEL SECURITY;

--
-- Name: inventory_recipes inventory_recipes_app_be_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY inventory_recipes_app_be_delete ON public.inventory_recipes FOR DELETE TO app_be USING ((workspace_id IS NOT NULL));

--
-- Name: inventory_recipes inventory_recipes_app_be_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY inventory_recipes_app_be_insert ON public.inventory_recipes FOR INSERT TO app_be WITH CHECK ((workspace_id IS NOT NULL));

--
-- Name: inventory_recipes inventory_recipes_app_be_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY inventory_recipes_app_be_select ON public.inventory_recipes FOR SELECT TO app_be USING ((workspace_id IS NOT NULL));

--
-- Name: inventory_recipes inventory_recipes_app_be_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY inventory_recipes_app_be_update ON public.inventory_recipes FOR UPDATE TO app_be USING ((workspace_id IS NOT NULL)) WITH CHECK ((workspace_id IS NOT NULL));

--
-- Name: inventory_recipes inventory_recipes_member_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY inventory_recipes_member_select ON public.inventory_recipes FOR SELECT TO authenticated USING (public.is_member(workspace_id));

--
-- Name: inventory_stock_levels; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.inventory_stock_levels ENABLE ROW LEVEL SECURITY;

--
-- Name: inventory_stock_levels inventory_stock_levels_app_be_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY inventory_stock_levels_app_be_delete ON public.inventory_stock_levels FOR DELETE TO app_be USING ((workspace_id IS NOT NULL));

--
-- Name: inventory_stock_levels inventory_stock_levels_app_be_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY inventory_stock_levels_app_be_insert ON public.inventory_stock_levels FOR INSERT TO app_be WITH CHECK ((workspace_id IS NOT NULL));

--
-- Name: inventory_stock_levels inventory_stock_levels_app_be_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY inventory_stock_levels_app_be_select ON public.inventory_stock_levels FOR SELECT TO app_be USING ((workspace_id IS NOT NULL));

--
-- Name: inventory_stock_levels inventory_stock_levels_app_be_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY inventory_stock_levels_app_be_update ON public.inventory_stock_levels FOR UPDATE TO app_be USING ((workspace_id IS NOT NULL)) WITH CHECK ((workspace_id IS NOT NULL));

--
-- Name: inventory_stock_levels inventory_stock_levels_member_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY inventory_stock_levels_member_select ON public.inventory_stock_levels FOR SELECT TO authenticated USING (public.is_member(workspace_id));

--
-- Name: inventory_suppliers; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.inventory_suppliers ENABLE ROW LEVEL SECURITY;

--
-- Name: inventory_suppliers inventory_suppliers_app_be_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY inventory_suppliers_app_be_delete ON public.inventory_suppliers FOR DELETE TO app_be USING ((workspace_id IS NOT NULL));

--
-- Name: inventory_suppliers inventory_suppliers_app_be_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY inventory_suppliers_app_be_insert ON public.inventory_suppliers FOR INSERT TO app_be WITH CHECK ((workspace_id IS NOT NULL));

--
-- Name: inventory_suppliers inventory_suppliers_app_be_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY inventory_suppliers_app_be_select ON public.inventory_suppliers FOR SELECT TO app_be USING ((workspace_id IS NOT NULL));

--
-- Name: inventory_suppliers inventory_suppliers_app_be_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY inventory_suppliers_app_be_update ON public.inventory_suppliers FOR UPDATE TO app_be USING ((workspace_id IS NOT NULL)) WITH CHECK ((workspace_id IS NOT NULL));

--
-- Name: inventory_suppliers inventory_suppliers_member_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY inventory_suppliers_member_select ON public.inventory_suppliers FOR SELECT TO authenticated USING (public.is_member(workspace_id));

--
-- Name: invoices; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;

--
-- Name: invoices invoices_app_be_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY invoices_app_be_delete ON public.invoices FOR DELETE TO app_be USING ((workspace_id IS NOT NULL));

--
-- Name: invoices invoices_app_be_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY invoices_app_be_insert ON public.invoices FOR INSERT TO app_be WITH CHECK ((workspace_id IS NOT NULL));

--
-- Name: invoices invoices_app_be_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY invoices_app_be_select ON public.invoices FOR SELECT TO app_be USING ((workspace_id IS NOT NULL));

--
-- Name: invoices invoices_app_be_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY invoices_app_be_update ON public.invoices FOR UPDATE TO app_be USING ((workspace_id IS NOT NULL)) WITH CHECK ((workspace_id IS NOT NULL));

--
-- Name: invoices invoices_member_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY invoices_member_all ON public.invoices TO authenticated USING (public.is_member(workspace_id)) WITH CHECK (public.is_member(workspace_id));

--
-- Name: job_outbox; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.job_outbox ENABLE ROW LEVEL SECURITY;

--
-- Name: job_slots; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.job_slots ENABLE ROW LEVEL SECURITY;

--
-- Name: jobs; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.jobs ENABLE ROW LEVEL SECURITY;

--
-- Name: jobs jobs_app_be_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY jobs_app_be_insert ON public.jobs FOR INSERT TO app_be WITH CHECK ((kind IS NOT NULL));

--
-- Name: jobs jobs_app_be_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY jobs_app_be_select ON public.jobs FOR SELECT TO app_be USING ((kind IS NOT NULL));

--
-- Name: jobs jobs_app_be_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY jobs_app_be_update ON public.jobs FOR UPDATE TO app_be USING ((kind IS NOT NULL)) WITH CHECK ((kind IS NOT NULL));

--
-- Name: knowledge_chunks; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.knowledge_chunks ENABLE ROW LEVEL SECURITY;

--
-- Name: knowledge_chunks knowledge_chunks_app_be_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY knowledge_chunks_app_be_delete ON public.knowledge_chunks FOR DELETE TO app_be USING ((workspace_id IS NOT NULL));

--
-- Name: knowledge_chunks knowledge_chunks_app_be_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY knowledge_chunks_app_be_insert ON public.knowledge_chunks FOR INSERT TO app_be WITH CHECK ((workspace_id IS NOT NULL));

--
-- Name: knowledge_chunks knowledge_chunks_app_be_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY knowledge_chunks_app_be_select ON public.knowledge_chunks FOR SELECT TO app_be USING ((workspace_id IS NOT NULL));

--
-- Name: knowledge_chunks knowledge_chunks_app_be_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY knowledge_chunks_app_be_update ON public.knowledge_chunks FOR UPDATE TO app_be USING ((workspace_id IS NOT NULL)) WITH CHECK ((workspace_id IS NOT NULL));

--
-- Name: knowledge_chunks knowledge_chunks_manager_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY knowledge_chunks_manager_all ON public.knowledge_chunks TO authenticated USING (public.is_manager(workspace_id)) WITH CHECK (public.is_manager(workspace_id));

--
-- Name: knowledge_chunks knowledge_chunks_member_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY knowledge_chunks_member_select ON public.knowledge_chunks FOR SELECT TO authenticated USING (public.is_member(workspace_id));

--
-- Name: knowledge_gaps; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.knowledge_gaps ENABLE ROW LEVEL SECURITY;

--
-- Name: knowledge_gaps knowledge_gaps_app_be_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY knowledge_gaps_app_be_delete ON public.knowledge_gaps FOR DELETE TO app_be USING ((workspace_id IS NOT NULL));

--
-- Name: knowledge_gaps knowledge_gaps_app_be_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY knowledge_gaps_app_be_insert ON public.knowledge_gaps FOR INSERT TO app_be WITH CHECK ((workspace_id IS NOT NULL));

--
-- Name: knowledge_gaps knowledge_gaps_app_be_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY knowledge_gaps_app_be_select ON public.knowledge_gaps FOR SELECT TO app_be USING ((workspace_id IS NOT NULL));

--
-- Name: knowledge_gaps knowledge_gaps_app_be_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY knowledge_gaps_app_be_update ON public.knowledge_gaps FOR UPDATE TO app_be USING ((workspace_id IS NOT NULL)) WITH CHECK ((workspace_id IS NOT NULL));

--
-- Name: knowledge_gaps knowledge_gaps_manager_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY knowledge_gaps_manager_select ON public.knowledge_gaps FOR SELECT TO authenticated USING (public.is_manager(workspace_id));

--
-- Name: knowledge_sources; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.knowledge_sources ENABLE ROW LEVEL SECURITY;

--
-- Name: knowledge_sources knowledge_sources_app_be_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY knowledge_sources_app_be_delete ON public.knowledge_sources FOR DELETE TO app_be USING ((workspace_id IS NOT NULL));

--
-- Name: knowledge_sources knowledge_sources_app_be_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY knowledge_sources_app_be_insert ON public.knowledge_sources FOR INSERT TO app_be WITH CHECK ((workspace_id IS NOT NULL));

--
-- Name: knowledge_sources knowledge_sources_app_be_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY knowledge_sources_app_be_select ON public.knowledge_sources FOR SELECT TO app_be USING ((workspace_id IS NOT NULL));

--
-- Name: knowledge_sources knowledge_sources_app_be_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY knowledge_sources_app_be_update ON public.knowledge_sources FOR UPDATE TO app_be USING ((workspace_id IS NOT NULL)) WITH CHECK ((workspace_id IS NOT NULL));

--
-- Name: knowledge_sources knowledge_sources_manager_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY knowledge_sources_manager_all ON public.knowledge_sources TO authenticated USING (public.is_manager(workspace_id)) WITH CHECK (public.is_manager(workspace_id));

--
-- Name: knowledge_sources knowledge_sources_member_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY knowledge_sources_member_select ON public.knowledge_sources FOR SELECT TO authenticated USING (public.is_member(workspace_id));

--
-- Name: knowledge_sources knowledge_sources_platform_admin_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY knowledge_sources_platform_admin_select ON public.knowledge_sources FOR SELECT TO authenticated USING (( SELECT public.is_platform_admin() AS is_platform_admin));

--
-- Name: knowledge_suggestion_state; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.knowledge_suggestion_state ENABLE ROW LEVEL SECURITY;

--
-- Name: knowledge_suggestion_state knowledge_suggestion_state_app_be_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY knowledge_suggestion_state_app_be_delete ON public.knowledge_suggestion_state FOR DELETE TO app_be USING ((workspace_id IS NOT NULL));

--
-- Name: knowledge_suggestion_state knowledge_suggestion_state_app_be_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY knowledge_suggestion_state_app_be_insert ON public.knowledge_suggestion_state FOR INSERT TO app_be WITH CHECK ((workspace_id IS NOT NULL));

--
-- Name: knowledge_suggestion_state knowledge_suggestion_state_app_be_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY knowledge_suggestion_state_app_be_select ON public.knowledge_suggestion_state FOR SELECT TO app_be USING ((workspace_id IS NOT NULL));

--
-- Name: knowledge_suggestion_state knowledge_suggestion_state_app_be_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY knowledge_suggestion_state_app_be_update ON public.knowledge_suggestion_state FOR UPDATE TO app_be USING ((workspace_id IS NOT NULL)) WITH CHECK ((workspace_id IS NOT NULL));

--
-- Name: knowledge_suggestion_state knowledge_suggestion_state_manager_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY knowledge_suggestion_state_manager_all ON public.knowledge_suggestion_state TO authenticated USING (public.is_manager(workspace_id)) WITH CHECK (public.is_manager(workspace_id));

--
-- Name: knowledge_suggestion_state knowledge_suggestion_state_member_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY knowledge_suggestion_state_member_select ON public.knowledge_suggestion_state FOR SELECT TO authenticated USING (public.is_member(workspace_id));

--
-- Name: lead_actions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.lead_actions ENABLE ROW LEVEL SECURITY;

--
-- Name: lead_actions lead_actions_app_be_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY lead_actions_app_be_delete ON public.lead_actions FOR DELETE TO app_be USING ((workspace_id IS NOT NULL));

--
-- Name: lead_actions lead_actions_app_be_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY lead_actions_app_be_insert ON public.lead_actions FOR INSERT TO app_be WITH CHECK ((workspace_id IS NOT NULL));

--
-- Name: lead_actions lead_actions_app_be_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY lead_actions_app_be_select ON public.lead_actions FOR SELECT TO app_be USING ((workspace_id IS NOT NULL));

--
-- Name: lead_actions lead_actions_app_be_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY lead_actions_app_be_update ON public.lead_actions FOR UPDATE TO app_be USING ((workspace_id IS NOT NULL)) WITH CHECK ((workspace_id IS NOT NULL));

--
-- Name: lead_flows; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.lead_flows ENABLE ROW LEVEL SECURITY;

--
-- Name: lead_flows lead_flows_app_be_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY lead_flows_app_be_delete ON public.lead_flows FOR DELETE TO app_be USING ((workspace_id IS NOT NULL));

--
-- Name: lead_flows lead_flows_app_be_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY lead_flows_app_be_insert ON public.lead_flows FOR INSERT TO app_be WITH CHECK ((workspace_id IS NOT NULL));

--
-- Name: lead_flows lead_flows_app_be_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY lead_flows_app_be_select ON public.lead_flows FOR SELECT TO app_be USING ((workspace_id IS NOT NULL));

--
-- Name: lead_flows lead_flows_app_be_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY lead_flows_app_be_update ON public.lead_flows FOR UPDATE TO app_be USING ((workspace_id IS NOT NULL)) WITH CHECK ((workspace_id IS NOT NULL));

--
-- Name: lead_flows lead_flows_manager_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY lead_flows_manager_select ON public.lead_flows FOR SELECT TO authenticated USING (public.is_manager(workspace_id));

--
-- Name: leads; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;

--
-- Name: leads leads_app_be_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY leads_app_be_delete ON public.leads FOR DELETE TO app_be USING ((workspace_id IS NOT NULL));

--
-- Name: leads leads_app_be_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY leads_app_be_insert ON public.leads FOR INSERT TO app_be WITH CHECK ((workspace_id IS NOT NULL));

--
-- Name: leads leads_app_be_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY leads_app_be_select ON public.leads FOR SELECT TO app_be USING ((workspace_id IS NOT NULL));

--
-- Name: leads leads_app_be_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY leads_app_be_update ON public.leads FOR UPDATE TO app_be USING ((workspace_id IS NOT NULL)) WITH CHECK ((workspace_id IS NOT NULL));

--
-- Name: leads leads_member_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY leads_member_all ON public.leads TO authenticated USING (public.is_member(workspace_id)) WITH CHECK (public.is_member(workspace_id));

--
-- Name: loyalty_campaigns; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.loyalty_campaigns ENABLE ROW LEVEL SECURITY;

--
-- Name: loyalty_campaigns loyalty_campaigns_app_be_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY loyalty_campaigns_app_be_delete ON public.loyalty_campaigns FOR DELETE TO app_be USING ((workspace_id IS NOT NULL));

--
-- Name: loyalty_campaigns loyalty_campaigns_app_be_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY loyalty_campaigns_app_be_insert ON public.loyalty_campaigns FOR INSERT TO app_be WITH CHECK ((workspace_id IS NOT NULL));

--
-- Name: loyalty_campaigns loyalty_campaigns_app_be_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY loyalty_campaigns_app_be_select ON public.loyalty_campaigns FOR SELECT TO app_be USING ((workspace_id IS NOT NULL));

--
-- Name: loyalty_campaigns loyalty_campaigns_app_be_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY loyalty_campaigns_app_be_update ON public.loyalty_campaigns FOR UPDATE TO app_be USING ((workspace_id IS NOT NULL)) WITH CHECK ((workspace_id IS NOT NULL));

--
-- Name: loyalty_campaigns loyalty_campaigns_member_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY loyalty_campaigns_member_select ON public.loyalty_campaigns FOR SELECT TO authenticated USING (public.is_member(workspace_id));

--
-- Name: loyalty_customer_links; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.loyalty_customer_links ENABLE ROW LEVEL SECURITY;

--
-- Name: loyalty_customer_links loyalty_customer_links_app_be_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY loyalty_customer_links_app_be_delete ON public.loyalty_customer_links FOR DELETE TO app_be USING ((workspace_id IS NOT NULL));

--
-- Name: loyalty_customer_links loyalty_customer_links_app_be_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY loyalty_customer_links_app_be_insert ON public.loyalty_customer_links FOR INSERT TO app_be WITH CHECK ((workspace_id IS NOT NULL));

--
-- Name: loyalty_customer_links loyalty_customer_links_app_be_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY loyalty_customer_links_app_be_select ON public.loyalty_customer_links FOR SELECT TO app_be USING ((workspace_id IS NOT NULL));

--
-- Name: loyalty_customer_links loyalty_customer_links_app_be_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY loyalty_customer_links_app_be_update ON public.loyalty_customer_links FOR UPDATE TO app_be USING ((workspace_id IS NOT NULL)) WITH CHECK ((workspace_id IS NOT NULL));

--
-- Name: loyalty_customer_links loyalty_customer_links_member_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY loyalty_customer_links_member_select ON public.loyalty_customer_links FOR SELECT TO authenticated USING (public.is_member(workspace_id));

--
-- Name: loyalty_customers; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.loyalty_customers ENABLE ROW LEVEL SECURITY;

--
-- Name: loyalty_customers loyalty_customers_app_be_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY loyalty_customers_app_be_delete ON public.loyalty_customers FOR DELETE TO app_be USING ((workspace_id IS NOT NULL));

--
-- Name: loyalty_customers loyalty_customers_app_be_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY loyalty_customers_app_be_insert ON public.loyalty_customers FOR INSERT TO app_be WITH CHECK ((workspace_id IS NOT NULL));

--
-- Name: loyalty_customers loyalty_customers_app_be_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY loyalty_customers_app_be_select ON public.loyalty_customers FOR SELECT TO app_be USING ((workspace_id IS NOT NULL));

--
-- Name: loyalty_customers loyalty_customers_app_be_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY loyalty_customers_app_be_update ON public.loyalty_customers FOR UPDATE TO app_be USING ((workspace_id IS NOT NULL)) WITH CHECK ((workspace_id IS NOT NULL));

--
-- Name: loyalty_customers loyalty_customers_manager_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY loyalty_customers_manager_update ON public.loyalty_customers FOR UPDATE TO authenticated USING (public.is_manager(workspace_id)) WITH CHECK (public.is_manager(workspace_id));

--
-- Name: loyalty_customers loyalty_customers_member_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY loyalty_customers_member_select ON public.loyalty_customers FOR SELECT TO authenticated USING (public.is_member(workspace_id));

--
-- Name: loyalty_ledger; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.loyalty_ledger ENABLE ROW LEVEL SECURITY;

--
-- Name: loyalty_ledger loyalty_ledger_app_be_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY loyalty_ledger_app_be_insert ON public.loyalty_ledger FOR INSERT TO app_be WITH CHECK ((workspace_id IS NOT NULL));

--
-- Name: loyalty_ledger loyalty_ledger_app_be_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY loyalty_ledger_app_be_select ON public.loyalty_ledger FOR SELECT TO app_be USING ((workspace_id IS NOT NULL));

--
-- Name: loyalty_ledger loyalty_ledger_member_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY loyalty_ledger_member_select ON public.loyalty_ledger FOR SELECT TO authenticated USING (public.is_member(workspace_id));

--
-- Name: loyalty_otps; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.loyalty_otps ENABLE ROW LEVEL SECURITY;

--
-- Name: loyalty_otps loyalty_otps_app_be_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY loyalty_otps_app_be_delete ON public.loyalty_otps FOR DELETE TO app_be USING ((workspace_id IS NOT NULL));

--
-- Name: loyalty_otps loyalty_otps_app_be_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY loyalty_otps_app_be_insert ON public.loyalty_otps FOR INSERT TO app_be WITH CHECK ((workspace_id IS NOT NULL));

--
-- Name: loyalty_otps loyalty_otps_app_be_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY loyalty_otps_app_be_select ON public.loyalty_otps FOR SELECT TO app_be USING ((workspace_id IS NOT NULL));

--
-- Name: loyalty_otps loyalty_otps_app_be_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY loyalty_otps_app_be_update ON public.loyalty_otps FOR UPDATE TO app_be USING ((workspace_id IS NOT NULL)) WITH CHECK ((workspace_id IS NOT NULL));

--
-- Name: loyalty_programs; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.loyalty_programs ENABLE ROW LEVEL SECURITY;

--
-- Name: loyalty_programs loyalty_programs_app_be_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY loyalty_programs_app_be_delete ON public.loyalty_programs FOR DELETE TO app_be USING ((workspace_id IS NOT NULL));

--
-- Name: loyalty_programs loyalty_programs_app_be_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY loyalty_programs_app_be_insert ON public.loyalty_programs FOR INSERT TO app_be WITH CHECK ((workspace_id IS NOT NULL));

--
-- Name: loyalty_programs loyalty_programs_app_be_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY loyalty_programs_app_be_select ON public.loyalty_programs FOR SELECT TO app_be USING ((workspace_id IS NOT NULL));

--
-- Name: loyalty_programs loyalty_programs_app_be_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY loyalty_programs_app_be_update ON public.loyalty_programs FOR UPDATE TO app_be USING ((workspace_id IS NOT NULL)) WITH CHECK ((workspace_id IS NOT NULL));

--
-- Name: loyalty_programs loyalty_programs_manager_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY loyalty_programs_manager_insert ON public.loyalty_programs FOR INSERT TO authenticated WITH CHECK (public.is_manager(workspace_id));

--
-- Name: loyalty_programs loyalty_programs_manager_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY loyalty_programs_manager_update ON public.loyalty_programs FOR UPDATE TO authenticated USING (public.is_manager(workspace_id)) WITH CHECK (public.is_manager(workspace_id));

--
-- Name: loyalty_programs loyalty_programs_member_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY loyalty_programs_member_select ON public.loyalty_programs FOR SELECT TO authenticated USING (public.is_member(workspace_id));

--
-- Name: loyalty_rewards; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.loyalty_rewards ENABLE ROW LEVEL SECURITY;

--
-- Name: loyalty_rewards loyalty_rewards_app_be_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY loyalty_rewards_app_be_delete ON public.loyalty_rewards FOR DELETE TO app_be USING ((workspace_id IS NOT NULL));

--
-- Name: loyalty_rewards loyalty_rewards_app_be_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY loyalty_rewards_app_be_insert ON public.loyalty_rewards FOR INSERT TO app_be WITH CHECK ((workspace_id IS NOT NULL));

--
-- Name: loyalty_rewards loyalty_rewards_app_be_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY loyalty_rewards_app_be_select ON public.loyalty_rewards FOR SELECT TO app_be USING ((workspace_id IS NOT NULL));

--
-- Name: loyalty_rewards loyalty_rewards_app_be_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY loyalty_rewards_app_be_update ON public.loyalty_rewards FOR UPDATE TO app_be USING ((workspace_id IS NOT NULL)) WITH CHECK ((workspace_id IS NOT NULL));

--
-- Name: loyalty_rewards loyalty_rewards_manager_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY loyalty_rewards_manager_delete ON public.loyalty_rewards FOR DELETE TO authenticated USING (public.is_manager(workspace_id));

--
-- Name: loyalty_rewards loyalty_rewards_manager_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY loyalty_rewards_manager_insert ON public.loyalty_rewards FOR INSERT TO authenticated WITH CHECK (public.is_manager(workspace_id));

--
-- Name: loyalty_rewards loyalty_rewards_manager_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY loyalty_rewards_manager_update ON public.loyalty_rewards FOR UPDATE TO authenticated USING (public.is_manager(workspace_id)) WITH CHECK (public.is_manager(workspace_id));

--
-- Name: loyalty_rewards loyalty_rewards_member_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY loyalty_rewards_member_select ON public.loyalty_rewards FOR SELECT TO authenticated USING (public.is_member(workspace_id));

--
-- Name: loyalty_sends; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.loyalty_sends ENABLE ROW LEVEL SECURITY;

--
-- Name: loyalty_sends loyalty_sends_app_be_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY loyalty_sends_app_be_delete ON public.loyalty_sends FOR DELETE TO app_be USING ((workspace_id IS NOT NULL));

--
-- Name: loyalty_sends loyalty_sends_app_be_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY loyalty_sends_app_be_insert ON public.loyalty_sends FOR INSERT TO app_be WITH CHECK ((workspace_id IS NOT NULL));

--
-- Name: loyalty_sends loyalty_sends_app_be_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY loyalty_sends_app_be_select ON public.loyalty_sends FOR SELECT TO app_be USING ((workspace_id IS NOT NULL));

--
-- Name: loyalty_sends loyalty_sends_app_be_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY loyalty_sends_app_be_update ON public.loyalty_sends FOR UPDATE TO app_be USING ((workspace_id IS NOT NULL)) WITH CHECK ((workspace_id IS NOT NULL));

--
-- Name: loyalty_sends loyalty_sends_member_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY loyalty_sends_member_select ON public.loyalty_sends FOR SELECT TO authenticated USING (public.is_member(workspace_id));

--
-- Name: messages; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

--
-- Name: messages messages_app_be_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY messages_app_be_delete ON public.messages FOR DELETE TO app_be USING ((workspace_id IS NOT NULL));

--
-- Name: messages messages_app_be_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY messages_app_be_insert ON public.messages FOR INSERT TO app_be WITH CHECK ((workspace_id IS NOT NULL));

--
-- Name: messages messages_app_be_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY messages_app_be_select ON public.messages FOR SELECT TO app_be USING ((workspace_id IS NOT NULL));

--
-- Name: messages messages_app_be_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY messages_app_be_update ON public.messages FOR UPDATE TO app_be USING ((workspace_id IS NOT NULL)) WITH CHECK ((workspace_id IS NOT NULL));

--
-- Name: messages messages_member_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY messages_member_all ON public.messages TO authenticated USING (public.is_member(workspace_id)) WITH CHECK (public.is_member(workspace_id));

--
-- Name: meta_comments; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.meta_comments ENABLE ROW LEVEL SECURITY;

--
-- Name: meta_comments meta_comments_app_be_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY meta_comments_app_be_delete ON public.meta_comments FOR DELETE TO app_be USING ((connection_id IS NOT NULL));

--
-- Name: meta_comments meta_comments_app_be_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY meta_comments_app_be_insert ON public.meta_comments FOR INSERT TO app_be WITH CHECK ((connection_id IS NOT NULL));

--
-- Name: meta_comments meta_comments_app_be_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY meta_comments_app_be_select ON public.meta_comments FOR SELECT TO app_be USING ((connection_id IS NOT NULL));

--
-- Name: meta_comments meta_comments_app_be_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY meta_comments_app_be_update ON public.meta_comments FOR UPDATE TO app_be USING ((connection_id IS NOT NULL)) WITH CHECK ((connection_id IS NOT NULL));

--
-- Name: meta_inbox; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.meta_inbox ENABLE ROW LEVEL SECURITY;

--
-- Name: meta_inbox meta_inbox_app_be_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY meta_inbox_app_be_insert ON public.meta_inbox FOR INSERT TO app_be WITH CHECK ((provider = 'meta'::text));

--
-- Name: meta_inbox meta_inbox_app_be_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY meta_inbox_app_be_select ON public.meta_inbox FOR SELECT TO app_be USING ((provider = 'meta'::text));

--
-- Name: meta_inbox meta_inbox_app_be_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY meta_inbox_app_be_update ON public.meta_inbox FOR UPDATE TO app_be USING ((provider = 'meta'::text)) WITH CHECK ((provider = 'meta'::text));

--
-- Name: meta_threads; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.meta_threads ENABLE ROW LEVEL SECURITY;

--
-- Name: meta_threads meta_threads_app_be_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY meta_threads_app_be_delete ON public.meta_threads FOR DELETE TO app_be USING ((connection_id IS NOT NULL));

--
-- Name: meta_threads meta_threads_app_be_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY meta_threads_app_be_insert ON public.meta_threads FOR INSERT TO app_be WITH CHECK ((connection_id IS NOT NULL));

--
-- Name: meta_threads meta_threads_app_be_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY meta_threads_app_be_select ON public.meta_threads FOR SELECT TO app_be USING ((connection_id IS NOT NULL));

--
-- Name: meta_threads meta_threads_app_be_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY meta_threads_app_be_update ON public.meta_threads FOR UPDATE TO app_be USING ((connection_id IS NOT NULL)) WITH CHECK ((connection_id IS NOT NULL));

--
-- Name: module_context_notes; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.module_context_notes ENABLE ROW LEVEL SECURITY;

--
-- Name: module_context_notes module_context_notes_app_be_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY module_context_notes_app_be_delete ON public.module_context_notes FOR DELETE TO app_be USING ((workspace_id IS NOT NULL));

--
-- Name: module_context_notes module_context_notes_app_be_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY module_context_notes_app_be_insert ON public.module_context_notes FOR INSERT TO app_be WITH CHECK ((workspace_id IS NOT NULL));

--
-- Name: module_context_notes module_context_notes_app_be_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY module_context_notes_app_be_select ON public.module_context_notes FOR SELECT TO app_be USING ((workspace_id IS NOT NULL));

--
-- Name: module_context_notes module_context_notes_app_be_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY module_context_notes_app_be_update ON public.module_context_notes FOR UPDATE TO app_be USING ((workspace_id IS NOT NULL)) WITH CHECK ((workspace_id IS NOT NULL));

--
-- Name: module_context_notes module_context_notes_manager_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY module_context_notes_manager_all ON public.module_context_notes TO authenticated USING (public.is_manager(workspace_id)) WITH CHECK (public.is_manager(workspace_id));

--
-- Name: module_context_versions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.module_context_versions ENABLE ROW LEVEL SECURITY;

--
-- Name: module_context_versions module_context_versions_app_be_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY module_context_versions_app_be_delete ON public.module_context_versions FOR DELETE TO app_be USING ((workspace_id IS NOT NULL));

--
-- Name: module_context_versions module_context_versions_app_be_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY module_context_versions_app_be_insert ON public.module_context_versions FOR INSERT TO app_be WITH CHECK ((workspace_id IS NOT NULL));

--
-- Name: module_context_versions module_context_versions_app_be_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY module_context_versions_app_be_select ON public.module_context_versions FOR SELECT TO app_be USING ((workspace_id IS NOT NULL));

--
-- Name: module_context_versions module_context_versions_app_be_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY module_context_versions_app_be_update ON public.module_context_versions FOR UPDATE TO app_be USING ((workspace_id IS NOT NULL)) WITH CHECK ((workspace_id IS NOT NULL));

--
-- Name: module_context_versions module_context_versions_manager_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY module_context_versions_manager_insert ON public.module_context_versions FOR INSERT TO authenticated WITH CHECK (public.is_manager(workspace_id));

--
-- Name: module_context_versions module_context_versions_member_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY module_context_versions_member_select ON public.module_context_versions FOR SELECT TO authenticated USING (public.is_member(workspace_id));

--
-- Name: module_context_versions module_context_versions_platform_admin_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY module_context_versions_platform_admin_select ON public.module_context_versions FOR SELECT TO authenticated USING (( SELECT public.is_platform_admin() AS is_platform_admin));

--
-- Name: module_installations; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.module_installations ENABLE ROW LEVEL SECURITY;

--
-- Name: module_installations module_installations_app_be_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY module_installations_app_be_delete ON public.module_installations FOR DELETE TO app_be USING ((workspace_id IS NOT NULL));

--
-- Name: module_installations module_installations_app_be_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY module_installations_app_be_insert ON public.module_installations FOR INSERT TO app_be WITH CHECK ((workspace_id IS NOT NULL));

--
-- Name: module_installations module_installations_app_be_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY module_installations_app_be_select ON public.module_installations FOR SELECT TO app_be USING ((workspace_id IS NOT NULL));

--
-- Name: module_installations module_installations_app_be_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY module_installations_app_be_update ON public.module_installations FOR UPDATE TO app_be USING ((workspace_id IS NOT NULL)) WITH CHECK ((workspace_id IS NOT NULL));

--
-- Name: module_installations module_installations_manager_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY module_installations_manager_delete ON public.module_installations FOR DELETE TO authenticated USING (public.is_manager(workspace_id));

--
-- Name: module_installations module_installations_manager_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY module_installations_manager_insert ON public.module_installations FOR INSERT TO authenticated WITH CHECK (public.is_manager(workspace_id));

--
-- Name: module_installations module_installations_manager_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY module_installations_manager_update ON public.module_installations FOR UPDATE TO authenticated USING (public.is_manager(workspace_id)) WITH CHECK (public.is_manager(workspace_id));

--
-- Name: module_installations module_installations_member_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY module_installations_member_select ON public.module_installations FOR SELECT TO authenticated USING (public.is_member(workspace_id));

--
-- Name: module_installations module_installations_platform_admin_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY module_installations_platform_admin_select ON public.module_installations FOR SELECT TO authenticated USING (( SELECT public.is_platform_admin() AS is_platform_admin));

--
-- Name: module_setup_messages; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.module_setup_messages ENABLE ROW LEVEL SECURITY;

--
-- Name: module_setup_messages module_setup_messages_app_be_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY module_setup_messages_app_be_delete ON public.module_setup_messages FOR DELETE TO app_be USING ((workspace_id IS NOT NULL));

--
-- Name: module_setup_messages module_setup_messages_app_be_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY module_setup_messages_app_be_insert ON public.module_setup_messages FOR INSERT TO app_be WITH CHECK ((workspace_id IS NOT NULL));

--
-- Name: module_setup_messages module_setup_messages_app_be_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY module_setup_messages_app_be_select ON public.module_setup_messages FOR SELECT TO app_be USING ((workspace_id IS NOT NULL));

--
-- Name: module_setup_messages module_setup_messages_app_be_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY module_setup_messages_app_be_update ON public.module_setup_messages FOR UPDATE TO app_be USING ((workspace_id IS NOT NULL)) WITH CHECK ((workspace_id IS NOT NULL));

--
-- Name: module_setup_messages module_setup_messages_manager_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY module_setup_messages_manager_all ON public.module_setup_messages TO authenticated USING (public.is_manager(workspace_id)) WITH CHECK (public.is_manager(workspace_id));

--
-- Name: module_setup_sessions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.module_setup_sessions ENABLE ROW LEVEL SECURITY;

--
-- Name: module_setup_sessions module_setup_sessions_app_be_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY module_setup_sessions_app_be_delete ON public.module_setup_sessions FOR DELETE TO app_be USING ((workspace_id IS NOT NULL));

--
-- Name: module_setup_sessions module_setup_sessions_app_be_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY module_setup_sessions_app_be_insert ON public.module_setup_sessions FOR INSERT TO app_be WITH CHECK ((workspace_id IS NOT NULL));

--
-- Name: module_setup_sessions module_setup_sessions_app_be_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY module_setup_sessions_app_be_select ON public.module_setup_sessions FOR SELECT TO app_be USING ((workspace_id IS NOT NULL));

--
-- Name: module_setup_sessions module_setup_sessions_app_be_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY module_setup_sessions_app_be_update ON public.module_setup_sessions FOR UPDATE TO app_be USING ((workspace_id IS NOT NULL)) WITH CHECK ((workspace_id IS NOT NULL));

--
-- Name: module_setup_sessions module_setup_sessions_manager_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY module_setup_sessions_manager_all ON public.module_setup_sessions TO authenticated USING (public.is_manager(workspace_id)) WITH CHECK (public.is_manager(workspace_id));

--
-- Name: module_setup_writes; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.module_setup_writes ENABLE ROW LEVEL SECURITY;

--
-- Name: module_setup_writes module_setup_writes_app_be_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY module_setup_writes_app_be_delete ON public.module_setup_writes FOR DELETE TO app_be USING ((workspace_id IS NOT NULL));

--
-- Name: module_setup_writes module_setup_writes_app_be_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY module_setup_writes_app_be_insert ON public.module_setup_writes FOR INSERT TO app_be WITH CHECK ((workspace_id IS NOT NULL));

--
-- Name: module_setup_writes module_setup_writes_app_be_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY module_setup_writes_app_be_select ON public.module_setup_writes FOR SELECT TO app_be USING ((workspace_id IS NOT NULL));

--
-- Name: module_setup_writes module_setup_writes_app_be_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY module_setup_writes_app_be_update ON public.module_setup_writes FOR UPDATE TO app_be USING ((workspace_id IS NOT NULL)) WITH CHECK ((workspace_id IS NOT NULL));

--
-- Name: module_setup_writes module_setup_writes_manager_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY module_setup_writes_manager_all ON public.module_setup_writes TO authenticated USING (public.is_manager(workspace_id)) WITH CHECK (public.is_manager(workspace_id));

--
-- Name: modules; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.modules ENABLE ROW LEVEL SECURITY;

--
-- Name: modules modules_app_be_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY modules_app_be_insert ON public.modules FOR INSERT TO app_be WITH CHECK ((key IS NOT NULL));

--
-- Name: modules modules_app_be_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY modules_app_be_select ON public.modules FOR SELECT TO app_be USING ((key IS NOT NULL));

--
-- Name: modules modules_app_be_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY modules_app_be_update ON public.modules FOR UPDATE TO app_be USING ((key IS NOT NULL)) WITH CHECK ((key IS NOT NULL));

--
-- Name: modules modules_authenticated_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY modules_authenticated_select ON public.modules FOR SELECT TO authenticated USING ((( SELECT auth.uid() AS uid) IS NOT NULL));

--
-- Name: n8n_pipelines; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.n8n_pipelines ENABLE ROW LEVEL SECURITY;

--
-- Name: n8n_pipelines n8n_pipelines_app_be_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY n8n_pipelines_app_be_delete ON public.n8n_pipelines FOR DELETE TO app_be USING ((workspace_id IS NOT NULL));

--
-- Name: n8n_pipelines n8n_pipelines_app_be_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY n8n_pipelines_app_be_insert ON public.n8n_pipelines FOR INSERT TO app_be WITH CHECK ((workspace_id IS NOT NULL));

--
-- Name: n8n_pipelines n8n_pipelines_app_be_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY n8n_pipelines_app_be_select ON public.n8n_pipelines FOR SELECT TO app_be USING ((workspace_id IS NOT NULL));

--
-- Name: n8n_pipelines n8n_pipelines_app_be_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY n8n_pipelines_app_be_update ON public.n8n_pipelines FOR UPDATE TO app_be USING ((workspace_id IS NOT NULL)) WITH CHECK ((workspace_id IS NOT NULL));

--
-- Name: n8n_pipelines n8n_pipelines_member_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY n8n_pipelines_member_select ON public.n8n_pipelines FOR SELECT TO authenticated USING (public.is_member(workspace_id));

--
-- Name: n8n_platform_config; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.n8n_platform_config ENABLE ROW LEVEL SECURITY;

--
-- Name: n8n_platform_config n8n_platform_config_app_be_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY n8n_platform_config_app_be_insert ON public.n8n_platform_config FOR INSERT TO app_be WITH CHECK ((key IS NOT NULL));

--
-- Name: n8n_platform_config n8n_platform_config_app_be_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY n8n_platform_config_app_be_select ON public.n8n_platform_config FOR SELECT TO app_be USING ((key IS NOT NULL));

--
-- Name: n8n_platform_config n8n_platform_config_app_be_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY n8n_platform_config_app_be_update ON public.n8n_platform_config FOR UPDATE TO app_be USING ((key IS NOT NULL)) WITH CHECK ((key IS NOT NULL));

--
-- Name: n8n_runs; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.n8n_runs ENABLE ROW LEVEL SECURITY;

--
-- Name: n8n_runs n8n_runs_app_be_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY n8n_runs_app_be_delete ON public.n8n_runs FOR DELETE TO app_be USING ((workspace_id IS NOT NULL));

--
-- Name: n8n_runs n8n_runs_app_be_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY n8n_runs_app_be_insert ON public.n8n_runs FOR INSERT TO app_be WITH CHECK ((workspace_id IS NOT NULL));

--
-- Name: n8n_runs n8n_runs_app_be_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY n8n_runs_app_be_select ON public.n8n_runs FOR SELECT TO app_be USING ((workspace_id IS NOT NULL));

--
-- Name: n8n_runs n8n_runs_app_be_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY n8n_runs_app_be_update ON public.n8n_runs FOR UPDATE TO app_be USING ((workspace_id IS NOT NULL)) WITH CHECK ((workspace_id IS NOT NULL));

--
-- Name: n8n_runs n8n_runs_member_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY n8n_runs_member_select ON public.n8n_runs FOR SELECT TO authenticated USING (public.is_member(workspace_id));

--
-- Name: nivo_knowledge; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.nivo_knowledge ENABLE ROW LEVEL SECURITY;

--
-- Name: nivo_knowledge nivo_knowledge_app_be_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY nivo_knowledge_app_be_delete ON public.nivo_knowledge FOR DELETE TO app_be USING ((id IS NOT NULL));

--
-- Name: nivo_knowledge nivo_knowledge_app_be_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY nivo_knowledge_app_be_insert ON public.nivo_knowledge FOR INSERT TO app_be WITH CHECK ((id IS NOT NULL));

--
-- Name: nivo_knowledge nivo_knowledge_app_be_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY nivo_knowledge_app_be_select ON public.nivo_knowledge FOR SELECT TO app_be USING ((id IS NOT NULL));

--
-- Name: nivo_knowledge nivo_knowledge_app_be_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY nivo_knowledge_app_be_update ON public.nivo_knowledge FOR UPDATE TO app_be USING ((id IS NOT NULL)) WITH CHECK ((id IS NOT NULL));

--
-- Name: nivo_knowledge nivo_knowledge_authenticated_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY nivo_knowledge_authenticated_select ON public.nivo_knowledge FOR SELECT TO authenticated USING ((( SELECT auth.uid() AS uid) IS NOT NULL));

--
-- Name: office_command_candidates; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.office_command_candidates ENABLE ROW LEVEL SECURITY;

--
-- Name: office_command_candidates office_command_candidates_app_be_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY office_command_candidates_app_be_delete ON public.office_command_candidates FOR DELETE TO app_be USING ((workspace_id IS NOT NULL));

--
-- Name: office_command_candidates office_command_candidates_app_be_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY office_command_candidates_app_be_insert ON public.office_command_candidates FOR INSERT TO app_be WITH CHECK ((workspace_id IS NOT NULL));

--
-- Name: office_command_candidates office_command_candidates_app_be_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY office_command_candidates_app_be_select ON public.office_command_candidates FOR SELECT TO app_be USING ((workspace_id IS NOT NULL));

--
-- Name: office_command_candidates office_command_candidates_app_be_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY office_command_candidates_app_be_update ON public.office_command_candidates FOR UPDATE TO app_be USING ((workspace_id IS NOT NULL)) WITH CHECK ((workspace_id IS NOT NULL));

--
-- Name: office_command_candidates office_command_candidates_manager_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY office_command_candidates_manager_all ON public.office_command_candidates TO authenticated USING (public.is_manager(workspace_id)) WITH CHECK (public.is_manager(workspace_id));

--
-- Name: office_command_candidates office_command_candidates_manager_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY office_command_candidates_manager_select ON public.office_command_candidates FOR SELECT TO authenticated USING (public.is_manager(workspace_id));

--
-- Name: openclaw_agent_sync; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.openclaw_agent_sync ENABLE ROW LEVEL SECURITY;

--
-- Name: openclaw_agent_sync openclaw_agent_sync_app_be_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY openclaw_agent_sync_app_be_delete ON public.openclaw_agent_sync FOR DELETE TO app_be USING ((workspace_id IS NOT NULL));

--
-- Name: openclaw_agent_sync openclaw_agent_sync_app_be_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY openclaw_agent_sync_app_be_insert ON public.openclaw_agent_sync FOR INSERT TO app_be WITH CHECK ((workspace_id IS NOT NULL));

--
-- Name: openclaw_agent_sync openclaw_agent_sync_app_be_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY openclaw_agent_sync_app_be_select ON public.openclaw_agent_sync FOR SELECT TO app_be USING ((workspace_id IS NOT NULL));

--
-- Name: openclaw_agent_sync openclaw_agent_sync_app_be_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY openclaw_agent_sync_app_be_update ON public.openclaw_agent_sync FOR UPDATE TO app_be USING ((workspace_id IS NOT NULL)) WITH CHECK ((workspace_id IS NOT NULL));

--
-- Name: openclaw_agent_sync openclaw_agent_sync_member_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY openclaw_agent_sync_member_select ON public.openclaw_agent_sync FOR SELECT TO authenticated USING (public.is_member(workspace_id));

--
-- Name: openclaw_agent_sync openclaw_agent_sync_platform_admin_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY openclaw_agent_sync_platform_admin_select ON public.openclaw_agent_sync FOR SELECT TO authenticated USING (( SELECT public.is_platform_admin() AS is_platform_admin));

--
-- Name: orders; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;

--
-- Name: orders orders_app_be_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY orders_app_be_delete ON public.orders FOR DELETE TO app_be USING ((workspace_id IS NOT NULL));

--
-- Name: orders orders_app_be_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY orders_app_be_insert ON public.orders FOR INSERT TO app_be WITH CHECK ((workspace_id IS NOT NULL));

--
-- Name: orders orders_app_be_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY orders_app_be_select ON public.orders FOR SELECT TO app_be USING ((workspace_id IS NOT NULL));

--
-- Name: orders orders_app_be_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY orders_app_be_update ON public.orders FOR UPDATE TO app_be USING ((workspace_id IS NOT NULL)) WITH CHECK ((workspace_id IS NOT NULL));

--
-- Name: orders orders_member_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY orders_member_all ON public.orders TO authenticated USING (public.is_member(workspace_id)) WITH CHECK (public.is_member(workspace_id));

--
-- Name: payment_order_requests; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.payment_order_requests ENABLE ROW LEVEL SECURITY;

--
-- Name: payment_order_requests payment_order_requests_app_be_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY payment_order_requests_app_be_insert ON public.payment_order_requests FOR INSERT TO app_be WITH CHECK (((workspace_id IS NOT NULL) AND (requested_by IS NOT NULL)));

--
-- Name: payment_order_requests payment_order_requests_app_be_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY payment_order_requests_app_be_select ON public.payment_order_requests FOR SELECT TO app_be USING ((workspace_id IS NOT NULL));

--
-- Name: payment_order_requests payment_order_requests_app_be_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY payment_order_requests_app_be_update ON public.payment_order_requests FOR UPDATE TO app_be USING ((workspace_id IS NOT NULL)) WITH CHECK ((workspace_id IS NOT NULL));

--
-- Name: payment_order_requests payment_order_requests_manager_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY payment_order_requests_manager_select ON public.payment_order_requests FOR SELECT TO authenticated USING ((public.is_manager(workspace_id) AND (requested_by = auth.uid())));

--
-- Name: payment_orders; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.payment_orders ENABLE ROW LEVEL SECURITY;

--
-- Name: payment_orders payment_orders_app_be_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY payment_orders_app_be_delete ON public.payment_orders FOR DELETE TO app_be USING ((workspace_id IS NOT NULL));

--
-- Name: payment_orders payment_orders_app_be_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY payment_orders_app_be_insert ON public.payment_orders FOR INSERT TO app_be WITH CHECK ((workspace_id IS NOT NULL));

--
-- Name: payment_orders payment_orders_app_be_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY payment_orders_app_be_select ON public.payment_orders FOR SELECT TO app_be USING ((workspace_id IS NOT NULL));

--
-- Name: payment_orders payment_orders_app_be_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY payment_orders_app_be_update ON public.payment_orders FOR UPDATE TO app_be USING ((workspace_id IS NOT NULL)) WITH CHECK ((workspace_id IS NOT NULL));

--
-- Name: payment_orders payment_orders_member_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY payment_orders_member_select ON public.payment_orders FOR SELECT TO authenticated USING ((public.is_member(workspace_id) OR (created_by = auth.uid())));

--
-- Name: payment_orders payment_orders_platform_admin_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY payment_orders_platform_admin_select ON public.payment_orders FOR SELECT TO authenticated USING (( SELECT public.is_platform_admin() AS is_platform_admin));

--
-- Name: plan_usage_tiers; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.plan_usage_tiers ENABLE ROW LEVEL SECURITY;

--
-- Name: plan_usage_tiers plan_usage_tiers_app_be_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY plan_usage_tiers_app_be_select ON public.plan_usage_tiers FOR SELECT TO app_be USING ((plan_code IS NOT NULL));

--
-- Name: plan_usage_tiers plan_usage_tiers_authenticated_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY plan_usage_tiers_authenticated_select ON public.plan_usage_tiers FOR SELECT TO authenticated USING ((auth.uid() IS NOT NULL));

--
-- Name: plans; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.plans ENABLE ROW LEVEL SECURITY;

--
-- Name: plans plans_app_be_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY plans_app_be_select ON public.plans FOR SELECT TO app_be USING ((code IS NOT NULL));

--
-- Name: plans plans_authenticated_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY plans_authenticated_select ON public.plans FOR SELECT TO authenticated USING ((auth.uid() IS NOT NULL));

--
-- Name: platform_admins; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.platform_admins ENABLE ROW LEVEL SECURITY;

--
-- Name: platform_audit; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.platform_audit ENABLE ROW LEVEL SECURITY;

--
-- Name: platform_audit platform_audit_app_be_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY platform_audit_app_be_insert ON public.platform_audit FOR INSERT TO app_be WITH CHECK ((workspace_id IS NOT NULL));

--
-- Name: platform_audit platform_audit_app_be_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY platform_audit_app_be_select ON public.platform_audit FOR SELECT TO app_be USING ((workspace_id IS NOT NULL));

--
-- Name: platform_audit platform_audit_platform_admin_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY platform_audit_platform_admin_select ON public.platform_audit FOR SELECT TO authenticated USING (( SELECT public.is_platform_admin() AS is_platform_admin));

--
-- Name: platform_flags; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.platform_flags ENABLE ROW LEVEL SECURITY;

--
-- Name: public_api; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.public_api ENABLE ROW LEVEL SECURITY;

--
-- Name: public_api public_api_app_be_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY public_api_app_be_insert ON public.public_api FOR INSERT TO app_be WITH CHECK ((workspace_id IS NOT NULL));

--
-- Name: public_api public_api_app_be_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY public_api_app_be_select ON public.public_api FOR SELECT TO app_be USING ((workspace_id IS NOT NULL));

--
-- Name: public_api public_api_app_be_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY public_api_app_be_update ON public.public_api FOR UPDATE TO app_be USING ((workspace_id IS NOT NULL)) WITH CHECK ((workspace_id IS NOT NULL));

--
-- Name: queue; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.queue ENABLE ROW LEVEL SECURITY;

--
-- Name: queue queue_app_be_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY queue_app_be_insert ON public.queue FOR INSERT TO app_be WITH CHECK ((queue IS NOT NULL));

--
-- Name: queue queue_app_be_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY queue_app_be_select ON public.queue FOR SELECT TO app_be USING ((queue IS NOT NULL));

--
-- Name: queue queue_app_be_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY queue_app_be_update ON public.queue FOR UPDATE TO app_be USING ((queue IS NOT NULL)) WITH CHECK ((queue IS NOT NULL));

--
-- Name: responsibilities; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.responsibilities ENABLE ROW LEVEL SECURITY;

--
-- Name: responsibilities responsibilities_app_be_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY responsibilities_app_be_delete ON public.responsibilities FOR DELETE TO app_be USING ((workspace_id IS NOT NULL));

--
-- Name: responsibilities responsibilities_app_be_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY responsibilities_app_be_insert ON public.responsibilities FOR INSERT TO app_be WITH CHECK ((workspace_id IS NOT NULL));

--
-- Name: responsibilities responsibilities_app_be_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY responsibilities_app_be_select ON public.responsibilities FOR SELECT TO app_be USING ((workspace_id IS NOT NULL));

--
-- Name: responsibilities responsibilities_app_be_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY responsibilities_app_be_update ON public.responsibilities FOR UPDATE TO app_be USING ((workspace_id IS NOT NULL)) WITH CHECK ((workspace_id IS NOT NULL));

--
-- Name: responsibilities responsibilities_member_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY responsibilities_member_all ON public.responsibilities TO authenticated USING (public.is_member(workspace_id)) WITH CHECK (public.is_member(workspace_id));

--
-- Name: sepay_transactions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.sepay_transactions ENABLE ROW LEVEL SECURITY;

--
-- Name: sepay_transactions sepay_transactions_app_be_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY sepay_transactions_app_be_insert ON public.sepay_transactions FOR INSERT TO app_be WITH CHECK ((id IS NOT NULL));

--
-- Name: sepay_transactions sepay_transactions_app_be_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY sepay_transactions_app_be_select ON public.sepay_transactions FOR SELECT TO app_be USING ((id IS NOT NULL));

--
-- Name: sepay_transactions sepay_transactions_app_be_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY sepay_transactions_app_be_update ON public.sepay_transactions FOR UPDATE TO app_be USING ((id IS NOT NULL)) WITH CHECK ((id IS NOT NULL));

--
-- Name: sepay_transactions sepay_transactions_manager_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY sepay_transactions_manager_select ON public.sepay_transactions FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.payment_orders o
  WHERE ((o.id = sepay_transactions.matched_order_id) AND public.is_manager(o.workspace_id)))));

--
-- Name: sepay_transactions sepay_transactions_platform_admin_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY sepay_transactions_platform_admin_select ON public.sepay_transactions FOR SELECT TO authenticated USING (( SELECT public.is_platform_admin() AS is_platform_admin));

--
-- Name: shifts_attendance; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.shifts_attendance ENABLE ROW LEVEL SECURITY;

--
-- Name: shifts_attendance shifts_attendance_app_be_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY shifts_attendance_app_be_delete ON public.shifts_attendance FOR DELETE TO app_be USING ((workspace_id IS NOT NULL));

--
-- Name: shifts_attendance shifts_attendance_app_be_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY shifts_attendance_app_be_insert ON public.shifts_attendance FOR INSERT TO app_be WITH CHECK ((workspace_id IS NOT NULL));

--
-- Name: shifts_attendance shifts_attendance_app_be_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY shifts_attendance_app_be_select ON public.shifts_attendance FOR SELECT TO app_be USING ((workspace_id IS NOT NULL));

--
-- Name: shifts_attendance shifts_attendance_app_be_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY shifts_attendance_app_be_update ON public.shifts_attendance FOR UPDATE TO app_be USING ((workspace_id IS NOT NULL)) WITH CHECK ((workspace_id IS NOT NULL));

--
-- Name: shifts_attendance shifts_attendance_manager_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY shifts_attendance_manager_all ON public.shifts_attendance TO authenticated USING (public.is_manager(workspace_id)) WITH CHECK (public.is_manager(workspace_id));

--
-- Name: shifts_attendance shifts_attendance_manager_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY shifts_attendance_manager_select ON public.shifts_attendance FOR SELECT TO authenticated USING ((public.is_manager(workspace_id) OR (public.is_member(workspace_id) AND (staff_id = public.shifts_my_profile(workspace_id)))));

--
-- Name: shifts_attendance shifts_attendance_own_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY shifts_attendance_own_insert ON public.shifts_attendance FOR INSERT TO authenticated WITH CHECK ((public.is_member(workspace_id) AND (staff_id = public.shifts_my_profile(workspace_id))));

--
-- Name: shifts_availability; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.shifts_availability ENABLE ROW LEVEL SECURITY;

--
-- Name: shifts_availability shifts_availability_app_be_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY shifts_availability_app_be_delete ON public.shifts_availability FOR DELETE TO app_be USING ((workspace_id IS NOT NULL));

--
-- Name: shifts_availability shifts_availability_app_be_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY shifts_availability_app_be_insert ON public.shifts_availability FOR INSERT TO app_be WITH CHECK ((workspace_id IS NOT NULL));

--
-- Name: shifts_availability shifts_availability_app_be_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY shifts_availability_app_be_select ON public.shifts_availability FOR SELECT TO app_be USING ((workspace_id IS NOT NULL));

--
-- Name: shifts_availability shifts_availability_app_be_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY shifts_availability_app_be_update ON public.shifts_availability FOR UPDATE TO app_be USING ((workspace_id IS NOT NULL)) WITH CHECK ((workspace_id IS NOT NULL));

--
-- Name: shifts_availability shifts_availability_manager_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY shifts_availability_manager_all ON public.shifts_availability TO authenticated USING (public.is_manager(workspace_id)) WITH CHECK (public.is_manager(workspace_id));

--
-- Name: shifts_availability shifts_availability_manager_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY shifts_availability_manager_select ON public.shifts_availability FOR SELECT TO authenticated USING ((public.is_manager(workspace_id) OR (public.is_member(workspace_id) AND (staff_id = public.shifts_my_profile(workspace_id)))));

--
-- Name: shifts_availability shifts_availability_own_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY shifts_availability_own_insert ON public.shifts_availability FOR INSERT TO authenticated WITH CHECK ((public.is_member(workspace_id) AND (staff_id = public.shifts_my_profile(workspace_id)) AND (status = 'pending'::text)));

--
-- Name: shifts_coverage; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.shifts_coverage ENABLE ROW LEVEL SECURITY;

--
-- Name: shifts_coverage shifts_coverage_app_be_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY shifts_coverage_app_be_delete ON public.shifts_coverage FOR DELETE TO app_be USING ((workspace_id IS NOT NULL));

--
-- Name: shifts_coverage shifts_coverage_app_be_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY shifts_coverage_app_be_insert ON public.shifts_coverage FOR INSERT TO app_be WITH CHECK ((workspace_id IS NOT NULL));

--
-- Name: shifts_coverage shifts_coverage_app_be_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY shifts_coverage_app_be_select ON public.shifts_coverage FOR SELECT TO app_be USING ((workspace_id IS NOT NULL));

--
-- Name: shifts_coverage shifts_coverage_app_be_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY shifts_coverage_app_be_update ON public.shifts_coverage FOR UPDATE TO app_be USING ((workspace_id IS NOT NULL)) WITH CHECK ((workspace_id IS NOT NULL));

--
-- Name: shifts_coverage shifts_coverage_manager_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY shifts_coverage_manager_all ON public.shifts_coverage TO authenticated USING (public.is_manager(workspace_id)) WITH CHECK (public.is_manager(workspace_id));

--
-- Name: shifts_coverage shifts_coverage_manager_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY shifts_coverage_manager_select ON public.shifts_coverage FOR SELECT TO authenticated USING (public.is_manager(workspace_id));

--
-- Name: shifts_leave_requests; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.shifts_leave_requests ENABLE ROW LEVEL SECURITY;

--
-- Name: shifts_leave_requests shifts_leave_requests_app_be_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY shifts_leave_requests_app_be_delete ON public.shifts_leave_requests FOR DELETE TO app_be USING ((workspace_id IS NOT NULL));

--
-- Name: shifts_leave_requests shifts_leave_requests_app_be_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY shifts_leave_requests_app_be_insert ON public.shifts_leave_requests FOR INSERT TO app_be WITH CHECK ((workspace_id IS NOT NULL));

--
-- Name: shifts_leave_requests shifts_leave_requests_app_be_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY shifts_leave_requests_app_be_select ON public.shifts_leave_requests FOR SELECT TO app_be USING ((workspace_id IS NOT NULL));

--
-- Name: shifts_leave_requests shifts_leave_requests_app_be_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY shifts_leave_requests_app_be_update ON public.shifts_leave_requests FOR UPDATE TO app_be USING ((workspace_id IS NOT NULL)) WITH CHECK ((workspace_id IS NOT NULL));

--
-- Name: shifts_leave_requests shifts_leave_requests_manager_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY shifts_leave_requests_manager_all ON public.shifts_leave_requests TO authenticated USING (public.is_manager(workspace_id)) WITH CHECK (public.is_manager(workspace_id));

--
-- Name: shifts_leave_requests shifts_leave_requests_manager_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY shifts_leave_requests_manager_select ON public.shifts_leave_requests FOR SELECT TO authenticated USING ((public.is_manager(workspace_id) OR (public.is_member(workspace_id) AND (staff_id = public.shifts_my_profile(workspace_id)))));

--
-- Name: shifts_leave_requests shifts_leave_requests_member_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY shifts_leave_requests_member_insert ON public.shifts_leave_requests FOR INSERT TO authenticated WITH CHECK ((public.is_member(workspace_id) AND (staff_id = public.shifts_my_profile(workspace_id)) AND (status = 'pending'::text)));

--
-- Name: shifts_notifications; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.shifts_notifications ENABLE ROW LEVEL SECURITY;

--
-- Name: shifts_notifications shifts_notifications_app_be_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY shifts_notifications_app_be_delete ON public.shifts_notifications FOR DELETE TO app_be USING ((workspace_id IS NOT NULL));

--
-- Name: shifts_notifications shifts_notifications_app_be_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY shifts_notifications_app_be_insert ON public.shifts_notifications FOR INSERT TO app_be WITH CHECK ((workspace_id IS NOT NULL));

--
-- Name: shifts_notifications shifts_notifications_app_be_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY shifts_notifications_app_be_select ON public.shifts_notifications FOR SELECT TO app_be USING ((workspace_id IS NOT NULL));

--
-- Name: shifts_notifications shifts_notifications_app_be_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY shifts_notifications_app_be_update ON public.shifts_notifications FOR UPDATE TO app_be USING ((workspace_id IS NOT NULL)) WITH CHECK ((workspace_id IS NOT NULL));

--
-- Name: shifts_notifications shifts_notifications_manager_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY shifts_notifications_manager_select ON public.shifts_notifications FOR SELECT TO authenticated USING ((public.is_manager(workspace_id) OR (public.is_member(workspace_id) AND (staff_id = public.shifts_my_profile(workspace_id)))));

--
-- Name: shifts_positions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.shifts_positions ENABLE ROW LEVEL SECURITY;

--
-- Name: shifts_positions shifts_positions_app_be_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY shifts_positions_app_be_delete ON public.shifts_positions FOR DELETE TO app_be USING ((workspace_id IS NOT NULL));

--
-- Name: shifts_positions shifts_positions_app_be_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY shifts_positions_app_be_insert ON public.shifts_positions FOR INSERT TO app_be WITH CHECK ((workspace_id IS NOT NULL));

--
-- Name: shifts_positions shifts_positions_app_be_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY shifts_positions_app_be_select ON public.shifts_positions FOR SELECT TO app_be USING ((workspace_id IS NOT NULL));

--
-- Name: shifts_positions shifts_positions_app_be_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY shifts_positions_app_be_update ON public.shifts_positions FOR UPDATE TO app_be USING ((workspace_id IS NOT NULL)) WITH CHECK ((workspace_id IS NOT NULL));

--
-- Name: shifts_positions shifts_positions_manager_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY shifts_positions_manager_all ON public.shifts_positions TO authenticated USING (public.is_manager(workspace_id)) WITH CHECK (public.is_manager(workspace_id));

--
-- Name: shifts_positions shifts_positions_member_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY shifts_positions_member_select ON public.shifts_positions FOR SELECT TO authenticated USING (public.is_member(workspace_id));

--
-- Name: shifts_schedules; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.shifts_schedules ENABLE ROW LEVEL SECURITY;

--
-- Name: shifts_schedules shifts_schedules_app_be_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY shifts_schedules_app_be_delete ON public.shifts_schedules FOR DELETE TO app_be USING ((workspace_id IS NOT NULL));

--
-- Name: shifts_schedules shifts_schedules_app_be_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY shifts_schedules_app_be_insert ON public.shifts_schedules FOR INSERT TO app_be WITH CHECK ((workspace_id IS NOT NULL));

--
-- Name: shifts_schedules shifts_schedules_app_be_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY shifts_schedules_app_be_select ON public.shifts_schedules FOR SELECT TO app_be USING ((workspace_id IS NOT NULL));

--
-- Name: shifts_schedules shifts_schedules_app_be_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY shifts_schedules_app_be_update ON public.shifts_schedules FOR UPDATE TO app_be USING ((workspace_id IS NOT NULL)) WITH CHECK ((workspace_id IS NOT NULL));

--
-- Name: shifts_schedules shifts_schedules_manager_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY shifts_schedules_manager_all ON public.shifts_schedules TO authenticated USING (public.is_manager(workspace_id)) WITH CHECK (public.is_manager(workspace_id));

--
-- Name: shifts_schedules shifts_schedules_manager_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY shifts_schedules_manager_select ON public.shifts_schedules FOR SELECT TO authenticated USING ((public.is_manager(workspace_id) OR (public.is_member(workspace_id) AND (status = 'published'::text))));

--
-- Name: shifts_settings; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.shifts_settings ENABLE ROW LEVEL SECURITY;

--
-- Name: shifts_settings shifts_settings_app_be_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY shifts_settings_app_be_delete ON public.shifts_settings FOR DELETE TO app_be USING ((workspace_id IS NOT NULL));

--
-- Name: shifts_settings shifts_settings_app_be_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY shifts_settings_app_be_insert ON public.shifts_settings FOR INSERT TO app_be WITH CHECK ((workspace_id IS NOT NULL));

--
-- Name: shifts_settings shifts_settings_app_be_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY shifts_settings_app_be_select ON public.shifts_settings FOR SELECT TO app_be USING ((workspace_id IS NOT NULL));

--
-- Name: shifts_settings shifts_settings_app_be_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY shifts_settings_app_be_update ON public.shifts_settings FOR UPDATE TO app_be USING ((workspace_id IS NOT NULL)) WITH CHECK ((workspace_id IS NOT NULL));

--
-- Name: shifts_settings shifts_settings_manager_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY shifts_settings_manager_all ON public.shifts_settings TO authenticated USING (public.is_manager(workspace_id)) WITH CHECK (public.is_manager(workspace_id));

--
-- Name: shifts_settings shifts_settings_member_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY shifts_settings_member_select ON public.shifts_settings FOR SELECT TO authenticated USING (public.is_member(workspace_id));

--
-- Name: shifts_shifts; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.shifts_shifts ENABLE ROW LEVEL SECURITY;

--
-- Name: shifts_shifts shifts_shifts_app_be_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY shifts_shifts_app_be_delete ON public.shifts_shifts FOR DELETE TO app_be USING ((workspace_id IS NOT NULL));

--
-- Name: shifts_shifts shifts_shifts_app_be_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY shifts_shifts_app_be_insert ON public.shifts_shifts FOR INSERT TO app_be WITH CHECK ((workspace_id IS NOT NULL));

--
-- Name: shifts_shifts shifts_shifts_app_be_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY shifts_shifts_app_be_select ON public.shifts_shifts FOR SELECT TO app_be USING ((workspace_id IS NOT NULL));

--
-- Name: shifts_shifts shifts_shifts_app_be_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY shifts_shifts_app_be_update ON public.shifts_shifts FOR UPDATE TO app_be USING ((workspace_id IS NOT NULL)) WITH CHECK ((workspace_id IS NOT NULL));

--
-- Name: shifts_shifts shifts_shifts_manager_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY shifts_shifts_manager_all ON public.shifts_shifts TO authenticated USING (public.is_manager(workspace_id)) WITH CHECK (public.is_manager(workspace_id));

--
-- Name: shifts_shifts shifts_shifts_manager_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY shifts_shifts_manager_select ON public.shifts_shifts FOR SELECT TO authenticated USING ((public.is_manager(workspace_id) OR (public.is_member(workspace_id) AND (status = ANY (ARRAY['published'::text, 'swapped'::text])))));

--
-- Name: shifts_staff; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.shifts_staff ENABLE ROW LEVEL SECURITY;

--
-- Name: shifts_staff shifts_staff_app_be_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY shifts_staff_app_be_delete ON public.shifts_staff FOR DELETE TO app_be USING ((workspace_id IS NOT NULL));

--
-- Name: shifts_staff shifts_staff_app_be_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY shifts_staff_app_be_insert ON public.shifts_staff FOR INSERT TO app_be WITH CHECK ((workspace_id IS NOT NULL));

--
-- Name: shifts_staff shifts_staff_app_be_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY shifts_staff_app_be_select ON public.shifts_staff FOR SELECT TO app_be USING ((workspace_id IS NOT NULL));

--
-- Name: shifts_staff shifts_staff_app_be_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY shifts_staff_app_be_update ON public.shifts_staff FOR UPDATE TO app_be USING ((workspace_id IS NOT NULL)) WITH CHECK ((workspace_id IS NOT NULL));

--
-- Name: shifts_staff shifts_staff_manager_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY shifts_staff_manager_all ON public.shifts_staff TO authenticated USING (public.is_manager(workspace_id)) WITH CHECK (public.is_manager(workspace_id));

--
-- Name: shifts_staff shifts_staff_member_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY shifts_staff_member_select ON public.shifts_staff FOR SELECT TO authenticated USING (public.is_member(workspace_id));

--
-- Name: shifts_staff_pay; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.shifts_staff_pay ENABLE ROW LEVEL SECURITY;

--
-- Name: shifts_staff_pay shifts_staff_pay_app_be_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY shifts_staff_pay_app_be_delete ON public.shifts_staff_pay FOR DELETE TO app_be USING ((workspace_id IS NOT NULL));

--
-- Name: shifts_staff_pay shifts_staff_pay_app_be_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY shifts_staff_pay_app_be_insert ON public.shifts_staff_pay FOR INSERT TO app_be WITH CHECK ((workspace_id IS NOT NULL));

--
-- Name: shifts_staff_pay shifts_staff_pay_app_be_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY shifts_staff_pay_app_be_select ON public.shifts_staff_pay FOR SELECT TO app_be USING ((workspace_id IS NOT NULL));

--
-- Name: shifts_staff_pay shifts_staff_pay_app_be_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY shifts_staff_pay_app_be_update ON public.shifts_staff_pay FOR UPDATE TO app_be USING ((workspace_id IS NOT NULL)) WITH CHECK ((workspace_id IS NOT NULL));

--
-- Name: shifts_staff_pay shifts_staff_pay_manager_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY shifts_staff_pay_manager_all ON public.shifts_staff_pay TO authenticated USING (public.is_manager(workspace_id)) WITH CHECK (public.is_manager(workspace_id));

--
-- Name: shifts_swap_requests; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.shifts_swap_requests ENABLE ROW LEVEL SECURITY;

--
-- Name: shifts_swap_requests shifts_swap_requests_app_be_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY shifts_swap_requests_app_be_delete ON public.shifts_swap_requests FOR DELETE TO app_be USING ((workspace_id IS NOT NULL));

--
-- Name: shifts_swap_requests shifts_swap_requests_app_be_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY shifts_swap_requests_app_be_insert ON public.shifts_swap_requests FOR INSERT TO app_be WITH CHECK ((workspace_id IS NOT NULL));

--
-- Name: shifts_swap_requests shifts_swap_requests_app_be_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY shifts_swap_requests_app_be_select ON public.shifts_swap_requests FOR SELECT TO app_be USING ((workspace_id IS NOT NULL));

--
-- Name: shifts_swap_requests shifts_swap_requests_app_be_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY shifts_swap_requests_app_be_update ON public.shifts_swap_requests FOR UPDATE TO app_be USING ((workspace_id IS NOT NULL)) WITH CHECK ((workspace_id IS NOT NULL));

--
-- Name: shifts_swap_requests shifts_swap_requests_manager_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY shifts_swap_requests_manager_all ON public.shifts_swap_requests TO authenticated USING (public.is_manager(workspace_id)) WITH CHECK (public.is_manager(workspace_id));

--
-- Name: shifts_swap_requests shifts_swap_requests_manager_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY shifts_swap_requests_manager_select ON public.shifts_swap_requests FOR SELECT TO authenticated USING ((public.is_manager(workspace_id) OR (public.is_member(workspace_id) AND ((from_staff_id = public.shifts_my_profile(workspace_id)) OR (to_staff_id = public.shifts_my_profile(workspace_id))))));

--
-- Name: shifts_swap_requests shifts_swap_requests_member_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY shifts_swap_requests_member_insert ON public.shifts_swap_requests FOR INSERT TO authenticated WITH CHECK ((public.is_member(workspace_id) AND (status = 'pending'::text) AND ((from_staff_id = public.shifts_my_profile(workspace_id)) OR ((kind = 'claim'::text) AND (to_staff_id = public.shifts_my_profile(workspace_id))))));

--
-- Name: staff; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.staff ENABLE ROW LEVEL SECURITY;

--
-- Name: staff staff_app_be_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY staff_app_be_delete ON public.staff FOR DELETE TO app_be USING ((workspace_id IS NOT NULL));

--
-- Name: staff staff_app_be_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY staff_app_be_insert ON public.staff FOR INSERT TO app_be WITH CHECK ((workspace_id IS NOT NULL));

--
-- Name: staff staff_app_be_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY staff_app_be_select ON public.staff FOR SELECT TO app_be USING ((workspace_id IS NOT NULL));

--
-- Name: staff staff_app_be_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY staff_app_be_update ON public.staff FOR UPDATE TO app_be USING ((workspace_id IS NOT NULL)) WITH CHECK ((workspace_id IS NOT NULL));

--
-- Name: staff staff_manager_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY staff_manager_delete ON public.staff FOR DELETE TO authenticated USING (public.is_manager(workspace_id));

--
-- Name: staff staff_manager_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY staff_manager_insert ON public.staff FOR INSERT TO authenticated WITH CHECK (public.is_manager(workspace_id));

--
-- Name: staff staff_manager_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY staff_manager_update ON public.staff FOR UPDATE TO authenticated USING (public.is_manager(workspace_id)) WITH CHECK (public.is_manager(workspace_id));

--
-- Name: staff staff_member_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY staff_member_select ON public.staff FOR SELECT TO authenticated USING (public.is_member(workspace_id));

--
-- Name: telegram_inbox; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.telegram_inbox ENABLE ROW LEVEL SECURITY;

--
-- Name: telegram_inbox telegram_inbox_app_be_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY telegram_inbox_app_be_insert ON public.telegram_inbox FOR INSERT TO app_be WITH CHECK ((provider = 'telegram'::text));

--
-- Name: telegram_inbox telegram_inbox_app_be_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY telegram_inbox_app_be_select ON public.telegram_inbox FOR SELECT TO app_be USING ((provider = 'telegram'::text));

--
-- Name: telegram_inbox telegram_inbox_app_be_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY telegram_inbox_app_be_update ON public.telegram_inbox FOR UPDATE TO app_be USING ((provider = 'telegram'::text)) WITH CHECK ((provider = 'telegram'::text));

--
-- Name: transactions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;

--
-- Name: transactions transactions_app_be_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY transactions_app_be_delete ON public.transactions FOR DELETE TO app_be USING ((workspace_id IS NOT NULL));

--
-- Name: transactions transactions_app_be_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY transactions_app_be_insert ON public.transactions FOR INSERT TO app_be WITH CHECK ((workspace_id IS NOT NULL));

--
-- Name: transactions transactions_app_be_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY transactions_app_be_select ON public.transactions FOR SELECT TO app_be USING ((workspace_id IS NOT NULL));

--
-- Name: transactions transactions_app_be_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY transactions_app_be_update ON public.transactions FOR UPDATE TO app_be USING ((workspace_id IS NOT NULL)) WITH CHECK ((workspace_id IS NOT NULL));

--
-- Name: transactions transactions_member_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY transactions_member_all ON public.transactions TO authenticated USING (public.is_member(workspace_id)) WITH CHECK (public.is_member(workspace_id));

--
-- Name: video_brand_kits; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.video_brand_kits ENABLE ROW LEVEL SECURITY;

--
-- Name: video_brand_kits video_brand_kits_app_be_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY video_brand_kits_app_be_delete ON public.video_brand_kits FOR DELETE TO app_be USING ((workspace_id IS NOT NULL));

--
-- Name: video_brand_kits video_brand_kits_app_be_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY video_brand_kits_app_be_insert ON public.video_brand_kits FOR INSERT TO app_be WITH CHECK ((workspace_id IS NOT NULL));

--
-- Name: video_brand_kits video_brand_kits_app_be_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY video_brand_kits_app_be_select ON public.video_brand_kits FOR SELECT TO app_be USING ((workspace_id IS NOT NULL));

--
-- Name: video_brand_kits video_brand_kits_app_be_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY video_brand_kits_app_be_update ON public.video_brand_kits FOR UPDATE TO app_be USING ((workspace_id IS NOT NULL)) WITH CHECK ((workspace_id IS NOT NULL));

--
-- Name: video_brand_kits video_brand_kits_manager_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY video_brand_kits_manager_all ON public.video_brand_kits TO authenticated USING (public.is_manager(workspace_id)) WITH CHECK (public.is_manager(workspace_id));

--
-- Name: video_brand_kits video_brand_kits_member_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY video_brand_kits_member_select ON public.video_brand_kits FOR SELECT TO authenticated USING (public.is_member(workspace_id));

--
-- Name: video_project_versions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.video_project_versions ENABLE ROW LEVEL SECURITY;

--
-- Name: video_project_versions video_project_versions_app_be_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY video_project_versions_app_be_delete ON public.video_project_versions FOR DELETE TO app_be USING ((workspace_id IS NOT NULL));

--
-- Name: video_project_versions video_project_versions_app_be_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY video_project_versions_app_be_insert ON public.video_project_versions FOR INSERT TO app_be WITH CHECK ((workspace_id IS NOT NULL));

--
-- Name: video_project_versions video_project_versions_app_be_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY video_project_versions_app_be_select ON public.video_project_versions FOR SELECT TO app_be USING ((workspace_id IS NOT NULL));

--
-- Name: video_project_versions video_project_versions_app_be_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY video_project_versions_app_be_update ON public.video_project_versions FOR UPDATE TO app_be USING ((workspace_id IS NOT NULL)) WITH CHECK ((workspace_id IS NOT NULL));

--
-- Name: video_project_versions video_project_versions_manager_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY video_project_versions_manager_all ON public.video_project_versions TO authenticated USING (public.is_manager(workspace_id)) WITH CHECK (public.is_manager(workspace_id));

--
-- Name: video_project_versions video_project_versions_member_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY video_project_versions_member_select ON public.video_project_versions FOR SELECT TO authenticated USING (public.is_member(workspace_id));

--
-- Name: video_projects; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.video_projects ENABLE ROW LEVEL SECURITY;

--
-- Name: video_projects video_projects_app_be_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY video_projects_app_be_delete ON public.video_projects FOR DELETE TO app_be USING ((workspace_id IS NOT NULL));

--
-- Name: video_projects video_projects_app_be_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY video_projects_app_be_insert ON public.video_projects FOR INSERT TO app_be WITH CHECK ((workspace_id IS NOT NULL));

--
-- Name: video_projects video_projects_app_be_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY video_projects_app_be_select ON public.video_projects FOR SELECT TO app_be USING ((workspace_id IS NOT NULL));

--
-- Name: video_projects video_projects_app_be_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY video_projects_app_be_update ON public.video_projects FOR UPDATE TO app_be USING ((workspace_id IS NOT NULL)) WITH CHECK ((workspace_id IS NOT NULL));

--
-- Name: video_projects video_projects_manager_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY video_projects_manager_all ON public.video_projects TO authenticated USING (public.is_manager(workspace_id)) WITH CHECK (public.is_manager(workspace_id));

--
-- Name: video_projects video_projects_member_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY video_projects_member_select ON public.video_projects FOR SELECT TO authenticated USING (public.is_member(workspace_id));

--
-- Name: video_renders; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.video_renders ENABLE ROW LEVEL SECURITY;

--
-- Name: video_renders video_renders_app_be_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY video_renders_app_be_delete ON public.video_renders FOR DELETE TO app_be USING ((workspace_id IS NOT NULL));

--
-- Name: video_renders video_renders_app_be_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY video_renders_app_be_insert ON public.video_renders FOR INSERT TO app_be WITH CHECK ((workspace_id IS NOT NULL));

--
-- Name: video_renders video_renders_app_be_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY video_renders_app_be_select ON public.video_renders FOR SELECT TO app_be USING ((workspace_id IS NOT NULL));

--
-- Name: video_renders video_renders_app_be_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY video_renders_app_be_update ON public.video_renders FOR UPDATE TO app_be USING ((workspace_id IS NOT NULL)) WITH CHECK ((workspace_id IS NOT NULL));

--
-- Name: video_renders video_renders_member_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY video_renders_member_select ON public.video_renders FOR SELECT TO authenticated USING (public.is_member(workspace_id));

--
-- Name: work_items; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.work_items ENABLE ROW LEVEL SECURITY;

--
-- Name: work_items work_items_app_be_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY work_items_app_be_delete ON public.work_items FOR DELETE TO app_be USING ((workspace_id IS NOT NULL));

--
-- Name: work_items work_items_app_be_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY work_items_app_be_insert ON public.work_items FOR INSERT TO app_be WITH CHECK ((workspace_id IS NOT NULL));

--
-- Name: work_items work_items_app_be_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY work_items_app_be_select ON public.work_items FOR SELECT TO app_be USING ((workspace_id IS NOT NULL));

--
-- Name: work_items work_items_app_be_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY work_items_app_be_update ON public.work_items FOR UPDATE TO app_be USING ((workspace_id IS NOT NULL)) WITH CHECK ((workspace_id IS NOT NULL));

--
-- Name: work_items work_items_manager_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY work_items_manager_delete ON public.work_items FOR DELETE TO authenticated USING (public.is_manager(workspace_id));

--
-- Name: work_items work_items_manager_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY work_items_manager_update ON public.work_items FOR UPDATE TO authenticated USING ((public.is_member(workspace_id) AND (public.is_manager(workspace_id) OR (status <> 'waiting_decision'::text) OR (assigned_staff_id = public.my_staff_id(workspace_id))))) WITH CHECK (public.is_member(workspace_id));

--
-- Name: work_items work_items_member_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY work_items_member_insert ON public.work_items FOR INSERT TO authenticated WITH CHECK (public.is_member(workspace_id));

--
-- Name: work_items work_items_member_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY work_items_member_select ON public.work_items FOR SELECT TO authenticated USING (public.is_member(workspace_id));

--
-- Name: api_keys workspace_api_keys_app_be_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY api_keys_app_be_delete ON public.api_keys FOR DELETE TO app_be USING ((workspace_id IS NOT NULL));

--
-- Name: api_keys workspace_api_keys_app_be_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY api_keys_app_be_insert ON public.api_keys FOR INSERT TO app_be WITH CHECK ((workspace_id IS NOT NULL));

--
-- Name: api_keys workspace_api_keys_app_be_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY api_keys_app_be_select ON public.api_keys FOR SELECT TO app_be USING ((workspace_id IS NOT NULL));

--
-- Name: api_keys workspace_api_keys_app_be_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY api_keys_app_be_update ON public.api_keys FOR UPDATE TO app_be USING ((workspace_id IS NOT NULL)) WITH CHECK ((workspace_id IS NOT NULL));

--
-- Name: workspace_invites; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.workspace_invites ENABLE ROW LEVEL SECURITY;

--
-- Name: workspace_invites workspace_invites_app_be_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY workspace_invites_app_be_delete ON public.workspace_invites FOR DELETE TO app_be USING ((workspace_id IS NOT NULL));

--
-- Name: workspace_invites workspace_invites_app_be_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY workspace_invites_app_be_insert ON public.workspace_invites FOR INSERT TO app_be WITH CHECK ((workspace_id IS NOT NULL));

--
-- Name: workspace_invites workspace_invites_app_be_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY workspace_invites_app_be_select ON public.workspace_invites FOR SELECT TO app_be USING ((workspace_id IS NOT NULL));

--
-- Name: workspace_invites workspace_invites_app_be_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY workspace_invites_app_be_update ON public.workspace_invites FOR UPDATE TO app_be USING ((workspace_id IS NOT NULL)) WITH CHECK ((workspace_id IS NOT NULL));

--
-- Name: workspace_invites workspace_invites_manager_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY workspace_invites_manager_all ON public.workspace_invites TO authenticated USING (public.is_manager(workspace_id)) WITH CHECK ((public.is_manager(workspace_id) AND (role = ANY (ARRAY['manager'::text, 'staff'::text]))));

--
-- Name: workspace_invites workspace_invites_platform_admin_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY workspace_invites_platform_admin_select ON public.workspace_invites FOR SELECT TO authenticated USING (( SELECT public.is_platform_admin() AS is_platform_admin));

--
-- Name: workspace_members; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.workspace_members ENABLE ROW LEVEL SECURITY;

--
-- Name: workspace_members workspace_members_app_be_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY workspace_members_app_be_delete ON public.workspace_members FOR DELETE TO app_be USING ((workspace_id IS NOT NULL));

--
-- Name: workspace_members workspace_members_app_be_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY workspace_members_app_be_insert ON public.workspace_members FOR INSERT TO app_be WITH CHECK ((workspace_id IS NOT NULL));

--
-- Name: workspace_members workspace_members_app_be_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY workspace_members_app_be_select ON public.workspace_members FOR SELECT TO app_be USING ((workspace_id IS NOT NULL));

--
-- Name: workspace_members workspace_members_app_be_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY workspace_members_app_be_update ON public.workspace_members FOR UPDATE TO app_be USING ((workspace_id IS NOT NULL)) WITH CHECK ((workspace_id IS NOT NULL));

--
-- Name: workspace_members workspace_members_member_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY workspace_members_member_select ON public.workspace_members FOR SELECT TO authenticated USING (((user_id = auth.uid()) OR public.is_member(workspace_id)));

--
-- Name: workspace_members workspace_members_owner_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY workspace_members_owner_delete ON public.workspace_members FOR DELETE TO authenticated USING ((public.is_manager(workspace_id) AND ((role <> 'owner'::text) OR (public.member_role(workspace_id) = 'owner'::text))));

--
-- Name: workspace_members workspace_members_owner_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY workspace_members_owner_insert ON public.workspace_members FOR INSERT TO authenticated WITH CHECK ((public.is_manager(workspace_id) AND ((role <> 'owner'::text) OR (public.member_role(workspace_id) = 'owner'::text))));

--
-- Name: workspace_members workspace_members_owner_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY workspace_members_owner_update ON public.workspace_members FOR UPDATE TO authenticated USING ((public.is_manager(workspace_id) AND ((role <> 'owner'::text) OR (public.member_role(workspace_id) = 'owner'::text)))) WITH CHECK ((public.is_manager(workspace_id) AND ((role <> 'owner'::text) OR (public.member_role(workspace_id) = 'owner'::text))));

--
-- Name: workspace_members workspace_members_platform_admin_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY workspace_members_platform_admin_select ON public.workspace_members FOR SELECT TO authenticated USING (( SELECT public.is_platform_admin() AS is_platform_admin));

--
-- Name: workspaces; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.workspaces ENABLE ROW LEVEL SECURITY;

--
-- Name: workspaces workspaces_app_be_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY workspaces_app_be_delete ON public.workspaces FOR DELETE TO app_be USING ((id IS NOT NULL));

--
-- Name: workspaces workspaces_app_be_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY workspaces_app_be_insert ON public.workspaces FOR INSERT TO app_be WITH CHECK ((id IS NOT NULL));

--
-- Name: workspaces workspaces_app_be_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY workspaces_app_be_select ON public.workspaces FOR SELECT TO app_be USING ((id IS NOT NULL));

--
-- Name: workspaces workspaces_app_be_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY workspaces_app_be_update ON public.workspaces FOR UPDATE TO app_be USING ((id IS NOT NULL)) WITH CHECK ((id IS NOT NULL));

--
-- Name: workspaces workspaces_member_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY workspaces_member_select ON public.workspaces FOR SELECT TO authenticated USING (((owner_id = auth.uid()) OR public.is_member(id)));

--
-- Name: workspaces workspaces_owner_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY workspaces_owner_delete ON public.workspaces FOR DELETE TO authenticated USING ((public.member_role(id) = 'owner'::text));

--
-- Name: workspaces workspaces_owner_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY workspaces_owner_update ON public.workspaces FOR UPDATE TO authenticated USING ((public.member_role(id) = 'owner'::text)) WITH CHECK ((public.member_role(id) = 'owner'::text));

--
-- Name: workspaces workspaces_platform_admin_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY workspaces_platform_admin_select ON public.workspaces FOR SELECT TO authenticated USING (( SELECT public.is_platform_admin() AS is_platform_admin));

--
-- Name: zalo_inbox; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.zalo_inbox ENABLE ROW LEVEL SECURITY;

--
-- Name: zalo_inbox zalo_inbox_app_be_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY zalo_inbox_app_be_insert ON public.zalo_inbox FOR INSERT TO app_be WITH CHECK ((provider = 'zalo'::text));

--
-- Name: zalo_inbox zalo_inbox_app_be_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY zalo_inbox_app_be_select ON public.zalo_inbox FOR SELECT TO app_be USING ((provider = 'zalo'::text));

--
-- Name: zalo_inbox zalo_inbox_app_be_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY zalo_inbox_app_be_update ON public.zalo_inbox FOR UPDATE TO app_be USING ((provider = 'zalo'::text)) WITH CHECK ((provider = 'zalo'::text));

--
-- Name: zalo_wizard_drafts; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.zalo_wizard_drafts ENABLE ROW LEVEL SECURITY;

--
-- Name: zalo_wizard_drafts zalo_wizard_drafts_app_be_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY zalo_wizard_drafts_app_be_delete ON public.zalo_wizard_drafts FOR DELETE TO app_be USING ((connection_id IS NOT NULL));

--
-- Name: zalo_wizard_drafts zalo_wizard_drafts_app_be_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY zalo_wizard_drafts_app_be_select ON public.zalo_wizard_drafts FOR SELECT TO app_be USING ((connection_id IS NOT NULL));

--
-- Name: SCHEMA be_access; Type: ACL; Schema: -; Owner: -
--

-- Table privileges are declared below in full: the default privileges of the schema grant anon and authenticated on every new
-- relation, so each one is cleared first and granted exactly what it needs. anon holds no table privilege.
REVOKE ALL ON TABLE public.accounting_adjustments FROM anon, authenticated;
REVOKE ALL ON TABLE public.agent_access_log FROM anon, authenticated;
REVOKE ALL ON TABLE public.agent_connections FROM anon, authenticated;
REVOKE ALL ON TABLE public.agent_conversations FROM anon, authenticated;
REVOKE ALL ON TABLE public.agent_messages FROM anon, authenticated;
REVOKE ALL ON TABLE public.agents FROM anon, authenticated;
REVOKE ALL ON TABLE public.ai_generations FROM anon, authenticated;
REVOKE ALL ON TABLE public.ai_quota_overrides FROM anon, authenticated;
REVOKE ALL ON TABLE public.ai_usage_daily FROM anon, authenticated;
REVOKE ALL ON TABLE public.ai_usage_events FROM anon, authenticated;
REVOKE ALL ON TABLE public.ai_usage_notices FROM anon, authenticated;
REVOKE ALL ON TABLE public.api_keys FROM anon, authenticated;
REVOKE ALL ON TABLE public.api_rate_limits FROM anon, authenticated;
REVOKE ALL ON TABLE public.app_commands FROM anon, authenticated;
REVOKE ALL ON TABLE public.app_errors FROM anon, authenticated;
REVOKE ALL ON TABLE public.authority FROM anon, authenticated;
REVOKE ALL ON TABLE public.authority_actions FROM anon, authenticated;
REVOKE ALL ON TABLE public.authority_rules FROM anon, authenticated;
REVOKE ALL ON TABLE public.automation_commands FROM anon, authenticated;
REVOKE ALL ON TABLE public.automation_pipelines FROM anon, authenticated;
REVOKE ALL ON TABLE public.automation_runs FROM anon, authenticated;
REVOKE ALL ON TABLE public.automation_templates FROM anon, authenticated;
REVOKE ALL ON TABLE public.billing_config FROM anon, authenticated;
REVOKE ALL ON TABLE public.billing_events FROM anon, authenticated;
REVOKE ALL ON TABLE public.booking_exceptions FROM anon, authenticated;
REVOKE ALL ON TABLE public.booking_hours FROM anon, authenticated;
REVOKE ALL ON TABLE public.booking_rate FROM anon, authenticated;
REVOKE ALL ON TABLE public.booking_reminders FROM anon, authenticated;
REVOKE ALL ON TABLE public.booking_resources FROM anon, authenticated;
REVOKE ALL ON TABLE public.booking_services FROM anon, authenticated;
REVOKE ALL ON TABLE public.booking_settings FROM anon, authenticated;
REVOKE ALL ON TABLE public.booking_waitlist FROM anon, authenticated;
REVOKE ALL ON TABLE public.bookings FROM anon, authenticated;
REVOKE ALL ON TABLE public.brain_commands FROM anon, authenticated;
REVOKE ALL ON TABLE public.brain_eval_cases FROM anon, authenticated;
REVOKE ALL ON TABLE public.brain_extractions FROM anon, authenticated;
REVOKE ALL ON TABLE public.brain_facts FROM anon, authenticated;
REVOKE ALL ON TABLE public.brain_lessons FROM anon, authenticated;
REVOKE ALL ON TABLE public.brain_source_profiles FROM anon, authenticated;
REVOKE ALL ON TABLE public.channel_receipts FROM anon, authenticated;
REVOKE ALL ON TABLE public.connection_commands FROM anon, authenticated;
REVOKE ALL ON TABLE public.connection_secrets FROM anon, authenticated;
REVOKE ALL ON TABLE public.connections FROM anon, authenticated;
REVOKE ALL ON TABLE public.connector_interest FROM anon, authenticated;
REVOKE ALL ON TABLE public.content_cadence FROM anon, authenticated;
REVOKE ALL ON TABLE public.content_items FROM anon, authenticated;
REVOKE ALL ON TABLE public.content_pillars FROM anon, authenticated;
REVOKE ALL ON TABLE public.content_plans FROM anon, authenticated;
REVOKE ALL ON TABLE public.content_settings FROM anon, authenticated;
REVOKE ALL ON TABLE public.contracts FROM anon, authenticated;
REVOKE ALL ON TABLE public.credit_pack_purchases FROM anon, authenticated;
REVOKE ALL ON TABLE public.credit_packs FROM anon, authenticated;
REVOKE ALL ON TABLE public.credit_topup_draws FROM anon, authenticated;
REVOKE ALL ON TABLE public.credit_topups FROM anon, authenticated;

REVOKE ALL ON TABLE public.data_records FROM anon, authenticated;
REVOKE ALL ON TABLE public.data_sync_runs FROM anon, authenticated;
REVOKE ALL ON TABLE public.decisions FROM anon, authenticated;
REVOKE ALL ON TABLE public.email_messages FROM anon, authenticated;

REVOKE ALL ON TABLE public.events FROM anon, authenticated;
REVOKE ALL ON TABLE public.executions FROM anon, authenticated;
REVOKE ALL ON TABLE public.hiring_apply_hits FROM anon, authenticated;
REVOKE ALL ON SEQUENCE public.hiring_apply_hits_id_seq FROM anon, authenticated;
REVOKE ALL ON TABLE public.hiring_availability FROM anon, authenticated;
REVOKE ALL ON TABLE public.hiring_candidates FROM anon, authenticated;
REVOKE ALL ON TABLE public.hiring_consents FROM anon, authenticated;
REVOKE ALL ON TABLE public.hiring_events FROM anon, authenticated;
REVOKE ALL ON TABLE public.hiring_interviews FROM anon, authenticated;
REVOKE ALL ON TABLE public.hiring_jobs FROM anon, authenticated;
REVOKE ALL ON TABLE public.hiring_offers FROM anon, authenticated;
REVOKE ALL ON TABLE public.hiring_onboarding FROM anon, authenticated;
REVOKE ALL ON TABLE public.hiring_retention_log FROM anon, authenticated;
REVOKE ALL ON TABLE public.hiring_settings FROM anon, authenticated;
REVOKE ALL ON TABLE public.inbound_events FROM anon, authenticated;
REVOKE ALL ON TABLE public.inventory_items FROM anon, authenticated;
REVOKE ALL ON TABLE public.inventory_locations FROM anon, authenticated;
REVOKE ALL ON TABLE public.inventory_movements FROM anon, authenticated;
REVOKE ALL ON TABLE public.inventory_po_lines FROM anon, authenticated;
REVOKE ALL ON TABLE public.inventory_purchase_orders FROM anon, authenticated;
REVOKE ALL ON TABLE public.inventory_receipts FROM anon, authenticated;
REVOKE ALL ON TABLE public.inventory_recipe_lines FROM anon, authenticated;
REVOKE ALL ON TABLE public.inventory_recipes FROM anon, authenticated;
REVOKE ALL ON TABLE public.inventory_stock_levels FROM anon, authenticated;
REVOKE ALL ON TABLE public.inventory_suppliers FROM anon, authenticated;
REVOKE ALL ON TABLE public.invoices FROM anon, authenticated;
REVOKE ALL ON TABLE public.job_outbox FROM anon, authenticated;
REVOKE ALL ON TABLE public.job_slots FROM anon, authenticated;
REVOKE ALL ON TABLE public.jobs FROM anon, authenticated;
REVOKE ALL ON TABLE public.knowledge_chunks FROM anon, authenticated;
REVOKE ALL ON TABLE public.knowledge_gaps FROM anon, authenticated;
REVOKE ALL ON TABLE public.knowledge_sources FROM anon, authenticated;
REVOKE ALL ON TABLE public.knowledge_suggestion_state FROM anon, authenticated;
REVOKE ALL ON TABLE public.lead_actions FROM anon, authenticated;
REVOKE ALL ON TABLE public.lead_flows FROM anon, authenticated;
REVOKE ALL ON TABLE public.leads FROM anon, authenticated;
REVOKE ALL ON TABLE public.loyalty_balances FROM anon, authenticated;
REVOKE ALL ON TABLE public.loyalty_campaigns FROM anon, authenticated;
REVOKE ALL ON TABLE public.loyalty_customer_links FROM anon, authenticated;
REVOKE ALL ON TABLE public.loyalty_customers FROM anon, authenticated;
REVOKE ALL ON TABLE public.loyalty_ledger FROM anon, authenticated;
REVOKE ALL ON TABLE public.loyalty_otps FROM anon, authenticated;
REVOKE ALL ON TABLE public.loyalty_programs FROM anon, authenticated;
REVOKE ALL ON TABLE public.loyalty_rewards FROM anon, authenticated;
REVOKE ALL ON TABLE public.loyalty_sends FROM anon, authenticated;
REVOKE ALL ON TABLE public.messages FROM anon, authenticated;
REVOKE ALL ON TABLE public.meta_comments FROM anon, authenticated;
REVOKE ALL ON TABLE public.meta_inbox FROM anon, authenticated;
REVOKE ALL ON TABLE public.meta_threads FROM anon, authenticated;
REVOKE ALL ON TABLE public.module_context_notes FROM anon, authenticated;
REVOKE ALL ON TABLE public.module_context_versions FROM anon, authenticated;
REVOKE ALL ON TABLE public.module_installations FROM anon, authenticated;
REVOKE ALL ON TABLE public.module_setup_messages FROM anon, authenticated;
REVOKE ALL ON TABLE public.module_setup_sessions FROM anon, authenticated;
REVOKE ALL ON TABLE public.module_setup_writes FROM anon, authenticated;
REVOKE ALL ON TABLE public.modules FROM anon, authenticated;
REVOKE ALL ON TABLE public.n8n_pipelines FROM anon, authenticated;
REVOKE ALL ON TABLE public.n8n_platform_config FROM anon, authenticated;
REVOKE ALL ON TABLE public.n8n_runs FROM anon, authenticated;
REVOKE ALL ON TABLE public.nivo_knowledge FROM anon, authenticated;
REVOKE ALL ON TABLE public.office_command_candidates FROM anon, authenticated;
REVOKE ALL ON TABLE public.openclaw_agent_sync FROM anon, authenticated;
REVOKE ALL ON TABLE public.orders FROM anon, authenticated;
REVOKE ALL ON TABLE public.payment_order_requests FROM anon, authenticated;
REVOKE ALL ON TABLE public.payment_orders FROM anon, authenticated;
REVOKE ALL ON TABLE public.plan_usage_tiers FROM anon, authenticated;
REVOKE ALL ON TABLE public.plans FROM anon, authenticated;
REVOKE ALL ON TABLE public.platform_admins FROM anon, authenticated;
REVOKE ALL ON TABLE public.platform_audit FROM anon, authenticated;
REVOKE ALL ON TABLE public.platform_flags FROM anon, authenticated;
REVOKE ALL ON TABLE public.public_api FROM anon, authenticated;
REVOKE ALL ON TABLE public.queue FROM anon, authenticated;
REVOKE ALL ON TABLE public.responsibilities FROM anon, authenticated;
REVOKE ALL ON TABLE public.sepay_transactions FROM anon, authenticated;
REVOKE ALL ON TABLE public.shifts_attendance FROM anon, authenticated;
REVOKE ALL ON TABLE public.shifts_availability FROM anon, authenticated;
REVOKE ALL ON TABLE public.shifts_coverage FROM anon, authenticated;
REVOKE ALL ON TABLE public.shifts_leave_requests FROM anon, authenticated;
REVOKE ALL ON TABLE public.shifts_notifications FROM anon, authenticated;
REVOKE ALL ON TABLE public.shifts_positions FROM anon, authenticated;
REVOKE ALL ON TABLE public.shifts_schedules FROM anon, authenticated;
REVOKE ALL ON TABLE public.shifts_settings FROM anon, authenticated;
REVOKE ALL ON TABLE public.shifts_shifts FROM anon, authenticated;
REVOKE ALL ON TABLE public.shifts_staff FROM anon, authenticated;
REVOKE ALL ON TABLE public.shifts_staff_pay FROM anon, authenticated;
REVOKE ALL ON TABLE public.shifts_swap_requests FROM anon, authenticated;
REVOKE ALL ON TABLE public.staff FROM anon, authenticated;
REVOKE ALL ON TABLE public.telegram_inbox FROM anon, authenticated;
REVOKE ALL ON TABLE public.transactions FROM anon, authenticated;
REVOKE ALL ON TABLE public.video_brand_kits FROM anon, authenticated;
REVOKE ALL ON TABLE public.video_project_versions FROM anon, authenticated;
REVOKE ALL ON TABLE public.video_projects FROM anon, authenticated;
REVOKE ALL ON TABLE public.video_renders FROM anon, authenticated;
REVOKE ALL ON TABLE public.work_items FROM anon, authenticated;
REVOKE ALL ON TABLE public.workspace_invites FROM anon, authenticated;
REVOKE ALL ON TABLE public.workspace_members FROM anon, authenticated;
REVOKE ALL ON TABLE public.workspaces FROM anon, authenticated;
REVOKE ALL ON TABLE public.zalo_inbox FROM anon, authenticated;
REVOKE ALL ON TABLE public.zalo_wizard_drafts FROM anon, authenticated;

GRANT USAGE ON SCHEMA be_access TO app_be;

--
-- Name: SCHEMA public; Type: ACL; Schema: -; Owner: -
--

GRANT USAGE ON SCHEMA public TO postgres;
GRANT USAGE ON SCHEMA public TO anon;
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT USAGE ON SCHEMA public TO app_be;

--
-- Name: FUNCTION user_emails(p_ids uuid[]); Type: ACL; Schema: be_access; Owner: -
--

REVOKE EXECUTE ON FUNCTION be_access.user_emails(p_ids uuid[]) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION be_access.user_emails(p_ids uuid[]) TO app_be;

--
-- Name: FUNCTION accept_invite(token text); Type: ACL; Schema: public; Owner: -
--

REVOKE EXECUTE ON FUNCTION public.accept_invite(token text) FROM PUBLIC, anon, authenticated;
GRANT ALL ON FUNCTION public.accept_invite(token text) TO authenticated;

--
-- Name: FUNCTION add_lead_responsibility(p_workspace uuid, p_lead uuid, p_title text, p_owner text, p_next_action text, p_due timestamp with time zone, p_locale text); Type: ACL; Schema: public; Owner: -
--

REVOKE EXECUTE ON FUNCTION public.add_lead_responsibility(p_workspace uuid, p_lead uuid, p_title text, p_owner text, p_next_action text, p_due timestamp with time zone, p_locale text) FROM PUBLIC, anon, authenticated;
GRANT ALL ON FUNCTION public.add_lead_responsibility(p_workspace uuid, p_lead uuid, p_title text, p_owner text, p_next_action text, p_due timestamp with time zone, p_locale text) TO authenticated;

--
-- Name: FUNCTION admin_console_audit(p_action text, p_workspace uuid, p_data jsonb); Type: ACL; Schema: public; Owner: -
--

REVOKE EXECUTE ON FUNCTION public.admin_console_audit(p_action text, p_workspace uuid, p_data jsonb) FROM PUBLIC, anon, authenticated;
GRANT ALL ON FUNCTION public.admin_console_audit(p_action text, p_workspace uuid, p_data jsonb) TO authenticated;

--
-- Name: FUNCTION admin_console_quota(p_workspace uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE EXECUTE ON FUNCTION public.admin_console_quota(p_workspace uuid) FROM PUBLIC, anon, authenticated;
GRANT ALL ON FUNCTION public.admin_console_quota(p_workspace uuid) TO authenticated;

--
-- Name: FUNCTION admin_console_signups(p_days integer); Type: ACL; Schema: public; Owner: -
--

REVOKE EXECUTE ON FUNCTION public.admin_console_signups(p_days integer) FROM PUBLIC, anon, authenticated;
GRANT ALL ON FUNCTION public.admin_console_signups(p_days integer) TO authenticated;

--
-- Name: FUNCTION admin_console_user_emails(p_ids uuid[]); Type: ACL; Schema: public; Owner: -
--

REVOKE EXECUTE ON FUNCTION public.admin_console_user_emails(p_ids uuid[]) FROM PUBLIC, anon, authenticated;
GRANT ALL ON FUNCTION public.admin_console_user_emails(p_ids uuid[]) TO authenticated;

--
-- Name: FUNCTION admin_console_workspace_stats(); Type: ACL; Schema: public; Owner: -
--

REVOKE EXECUTE ON FUNCTION public.admin_console_workspace_stats() FROM PUBLIC, anon, authenticated;
GRANT ALL ON FUNCTION public.admin_console_workspace_stats() TO authenticated;

--
-- Name: FUNCTION admin_extend_subscription(p_workspace uuid, p_days integer); Type: ACL; Schema: public; Owner: -
--

REVOKE EXECUTE ON FUNCTION public.admin_extend_subscription(p_workspace uuid, p_days integer) FROM PUBLIC, anon, authenticated;
GRANT ALL ON FUNCTION public.admin_extend_subscription(p_workspace uuid, p_days integer) TO authenticated;

--
-- Name: FUNCTION admin_set_workspace_plan(p_workspace uuid, p_plan text, p_credits bigint); Type: ACL; Schema: public; Owner: -
--

REVOKE EXECUTE ON FUNCTION public.admin_set_workspace_plan(p_workspace uuid, p_plan text, p_credits bigint) FROM PUBLIC, anon, authenticated;
GRANT ALL ON FUNCTION public.admin_set_workspace_plan(p_workspace uuid, p_plan text, p_credits bigint) TO authenticated;

--
-- Name: FUNCTION admin_set_workspace_status(p_workspace uuid, p_status text); Type: ACL; Schema: public; Owner: -
--

REVOKE EXECUTE ON FUNCTION public.admin_set_workspace_status(p_workspace uuid, p_status text) FROM PUBLIC, anon, authenticated;
GRANT ALL ON FUNCTION public.admin_set_workspace_status(p_workspace uuid, p_status text) TO authenticated;

--
-- Name: FUNCTION admin_signups_per_day(p_days integer); Type: ACL; Schema: public; Owner: -
--

REVOKE EXECUTE ON FUNCTION public.admin_signups_per_day(p_days integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_signups_per_day(p_days integer) TO app_be;

--
-- Name: FUNCTION admin_workspace_stats(); Type: ACL; Schema: public; Owner: -
--

REVOKE EXECUTE ON FUNCTION public.admin_workspace_stats() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_workspace_stats() TO app_be;

--
-- Name: FUNCTION agent_chat_send(p_conversation uuid, p_body text); Type: ACL; Schema: public; Owner: -
--

REVOKE EXECUTE ON FUNCTION public.agent_chat_send(p_conversation uuid, p_body text) FROM PUBLIC, anon, authenticated;
GRANT ALL ON FUNCTION public.agent_chat_send(p_conversation uuid, p_body text) TO authenticated;

--
-- Name: FUNCTION agent_chat_start(p_agent uuid, p_kind text, p_visitor text); Type: ACL; Schema: public; Owner: -
--

REVOKE EXECUTE ON FUNCTION public.agent_chat_start(p_agent uuid, p_kind text, p_visitor text) FROM PUBLIC, anon, authenticated;
GRANT ALL ON FUNCTION public.agent_chat_start(p_agent uuid, p_kind text, p_visitor text) TO authenticated;

--
-- Name: FUNCTION agent_chat_take_over(p_conversation uuid, p_take boolean, p_line text); Type: ACL; Schema: public; Owner: -
--

REVOKE EXECUTE ON FUNCTION public.agent_chat_take_over(p_conversation uuid, p_take boolean, p_line text) FROM PUBLIC, anon, authenticated;
GRANT ALL ON FUNCTION public.agent_chat_take_over(p_conversation uuid, p_take boolean, p_line text) TO authenticated;

--
-- Name: FUNCTION agent_connections_same_workspace(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.agent_connections_same_workspace() TO anon;
GRANT ALL ON FUNCTION public.agent_connections_same_workspace() TO authenticated;

--
-- Name: FUNCTION agent_conversations_attribute_lead(); Type: ACL; Schema: public; Owner: -
--

REVOKE EXECUTE ON FUNCTION public.agent_conversations_attribute_lead() FROM PUBLIC, anon, authenticated;

--
-- Name: FUNCTION agent_conversations_fill_installation(); Type: ACL; Schema: public; Owner: -
--

REVOKE EXECUTE ON FUNCTION public.agent_conversations_fill_installation() FROM PUBLIC, anon, authenticated;

--
-- Name: FUNCTION ai_credit_period(p_workspace uuid, p_period date); Type: ACL; Schema: public; Owner: -
--

REVOKE EXECUTE ON FUNCTION public.ai_credit_period(p_workspace uuid, p_period date) FROM PUBLIC, anon, authenticated;

--
-- Name: FUNCTION ai_quota_status(p_workspace uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE EXECUTE ON FUNCTION public.ai_quota_status(p_workspace uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ai_quota_status(p_workspace uuid) TO app_be;

--
-- Name: FUNCTION ai_usage_events_settle(); Type: ACL; Schema: public; Owner: -
--

REVOKE EXECUTE ON FUNCTION public.ai_usage_events_settle() FROM PUBLIC, anon, authenticated;

--
-- Name: FUNCTION api_key_auth(p_hash text); Type: ACL; Schema: public; Owner: -
--

REVOKE EXECUTE ON FUNCTION public.api_key_auth(p_hash text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.api_key_auth(p_hash text) TO app_be;

--
-- Name: FUNCTION api_key_create(p_workspace uuid, p_name text); Type: ACL; Schema: public; Owner: -
--

REVOKE EXECUTE ON FUNCTION public.api_key_create(p_workspace uuid, p_name text) FROM PUBLIC, anon, authenticated;
GRANT ALL ON FUNCTION public.api_key_create(p_workspace uuid, p_name text) TO authenticated;

--
-- Name: FUNCTION api_key_revoke(p_workspace uuid, p_key uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE EXECUTE ON FUNCTION public.api_key_revoke(p_workspace uuid, p_key uuid) FROM PUBLIC, anon, authenticated;
GRANT ALL ON FUNCTION public.api_key_revoke(p_workspace uuid, p_key uuid) TO authenticated;

--
-- Name: FUNCTION api_rate_hit(p_key uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE EXECUTE ON FUNCTION public.api_rate_hit(p_key uuid) FROM PUBLIC, anon, authenticated;

--
-- Name: FUNCTION app_errors_record(p_scope text, p_message text, p_stack text, p_ws uuid, p_connection uuid, p_ctx jsonb); Type: ACL; Schema: public; Owner: -
--

REVOKE EXECUTE ON FUNCTION public.app_errors_record(p_scope text, p_message text, p_stack text, p_ws uuid, p_connection uuid, p_ctx jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.app_errors_record(p_scope text, p_message text, p_stack text, p_ws uuid, p_connection uuid, p_ctx jsonb) TO app_be;

--
-- Name: FUNCTION assign_lead_responsibility(p_workspace uuid, p_responsibility uuid, p_owner text, p_next_action text, p_due timestamp with time zone, p_title text, p_locale text); Type: ACL; Schema: public; Owner: -
--

REVOKE EXECUTE ON FUNCTION public.assign_lead_responsibility(p_workspace uuid, p_responsibility uuid, p_owner text, p_next_action text, p_due timestamp with time zone, p_title text, p_locale text) FROM PUBLIC, anon, authenticated;
GRANT ALL ON FUNCTION public.assign_lead_responsibility(p_workspace uuid, p_responsibility uuid, p_owner text, p_next_action text, p_due timestamp with time zone, p_title text, p_locale text) TO authenticated;

--
-- Name: FUNCTION automation_command_enqueue(p_workspace uuid, p_kind text, p_template text); Type: ACL; Schema: public; Owner: -
--

REVOKE EXECUTE ON FUNCTION public.automation_command_enqueue(p_workspace uuid, p_kind text, p_template text) FROM PUBLIC, anon, authenticated;
GRANT ALL ON FUNCTION public.automation_command_enqueue(p_workspace uuid, p_kind text, p_template text) TO authenticated;

--
-- Name: FUNCTION automations_data(ws uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE EXECUTE ON FUNCTION public.automations_data(ws uuid) FROM PUBLIC, anon, authenticated;
GRANT ALL ON FUNCTION public.automations_data(ws uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.automations_data(ws uuid) TO app_be;

--
-- Name: FUNCTION be_account_providers(p_user uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE EXECUTE ON FUNCTION public.be_account_providers(p_user uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.be_account_providers(p_user uuid) TO app_be;

--
-- Name: FUNCTION be_account_sessions(p_user uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE EXECUTE ON FUNCTION public.be_account_sessions(p_user uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.be_account_sessions(p_user uuid) TO app_be;

--
-- Name: FUNCTION be_revoke_session(p_user uuid, p_session uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE EXECUTE ON FUNCTION public.be_revoke_session(p_user uuid, p_session uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.be_revoke_session(p_user uuid, p_session uuid) TO app_be;

--
-- Name: FUNCTION booking_peak_load(p_resource uuid, p_start timestamp with time zone, p_block_end timestamp with time zone, p_exclude uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE EXECUTE ON FUNCTION public.booking_peak_load(p_resource uuid, p_start timestamp with time zone, p_block_end timestamp with time zone, p_exclude uuid) FROM PUBLIC, anon, authenticated;

--
-- Name: FUNCTION booking_rate_hit(p_key text, p_limit integer, p_window_sec integer); Type: ACL; Schema: public; Owner: -
--

REVOKE EXECUTE ON FUNCTION public.booking_rate_hit(p_key text, p_limit integer, p_window_sec integer) FROM PUBLIC, anon, authenticated;

--
-- Name: FUNCTION booking_relocate(p_booking uuid, p_resource uuid, p_start timestamp with time zone, p_end timestamp with time zone, p_block_end timestamp with time zone, p_force boolean); Type: ACL; Schema: public; Owner: -
--

REVOKE EXECUTE ON FUNCTION public.booking_relocate(p_booking uuid, p_resource uuid, p_start timestamp with time zone, p_end timestamp with time zone, p_block_end timestamp with time zone, p_force boolean) FROM PUBLIC, anon, authenticated;

--
-- Name: FUNCTION booking_reserve(p jsonb, p_force boolean); Type: ACL; Schema: public; Owner: -
--

REVOKE EXECUTE ON FUNCTION public.booking_reserve(p jsonb, p_force boolean) FROM PUBLIC, anon, authenticated;

--
-- Name: FUNCTION bookings_fill_installation(); Type: ACL; Schema: public; Owner: -
--

REVOKE EXECUTE ON FUNCTION public.bookings_fill_installation() FROM PUBLIC, anon, authenticated;

--
-- Name: FUNCTION bookings_notify(); Type: ACL; Schema: public; Owner: -
--

REVOKE EXECUTE ON FUNCTION public.bookings_notify() FROM PUBLIC, anon, authenticated;

--
-- Name: FUNCTION brain_command(p_workspace uuid, p_kind text, p_payload jsonb); Type: ACL; Schema: public; Owner: -
--

REVOKE EXECUTE ON FUNCTION public.brain_command(p_workspace uuid, p_kind text, p_payload jsonb) FROM PUBLIC, anon, authenticated;
GRANT ALL ON FUNCTION public.brain_command(p_workspace uuid, p_kind text, p_payload jsonb) TO authenticated;

--
-- Name: FUNCTION brain_command_wait(p_id uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE EXECUTE ON FUNCTION public.brain_command_wait(p_id uuid) FROM PUBLIC, anon, authenticated;
GRANT ALL ON FUNCTION public.brain_command_wait(p_id uuid) TO authenticated;

--
-- Name: FUNCTION connection_command_submit(p_workspace uuid, p_kind text, p_input jsonb); Type: ACL; Schema: public; Owner: -
--

REVOKE EXECUTE ON FUNCTION public.connection_command_submit(p_workspace uuid, p_kind text, p_input jsonb) FROM PUBLIC, anon, authenticated;
GRANT ALL ON FUNCTION public.connection_command_submit(p_workspace uuid, p_kind text, p_input jsonb) TO authenticated;

--
-- Name: FUNCTION connection_command_take(p_id uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE EXECUTE ON FUNCTION public.connection_command_take(p_id uuid) FROM PUBLIC, anon, authenticated;
GRANT ALL ON FUNCTION public.connection_command_take(p_id uuid) TO authenticated;

--
-- Name: FUNCTION connection_mark_fed(p_connection uuid, p_at timestamp with time zone, p_first_event jsonb); Type: ACL; Schema: public; Owner: -
--

REVOKE EXECUTE ON FUNCTION public.connection_mark_fed(p_connection uuid, p_at timestamp with time zone, p_first_event jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.connection_mark_fed(p_connection uuid, p_at timestamp with time zone, p_first_event jsonb) TO app_be;

--
-- Name: FUNCTION content_items_touch(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.content_items_touch() TO anon;
GRANT ALL ON FUNCTION public.content_items_touch() TO authenticated;

--
-- Name: FUNCTION content_settings_touch(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.content_settings_touch() TO anon;
GRANT ALL ON FUNCTION public.content_settings_touch() TO authenticated;

--
-- Name: FUNCTION create_free_workspace(p_name text); Type: ACL; Schema: public; Owner: -
--

REVOKE EXECUTE ON FUNCTION public.create_free_workspace(p_name text) FROM PUBLIC, anon, authenticated;
GRANT ALL ON FUNCTION public.create_free_workspace(p_name text) TO authenticated;

--
-- Name: FUNCTION credit_usd_value(); Type: ACL; Schema: public; Owner: -
--

REVOKE EXECUTE ON FUNCTION public.credit_usd_value() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.credit_usd_value() TO app_be;

--
-- Name: FUNCTION dashboard_data(ws uuid, since7 timestamp with time zone, founding_from timestamp with time zone, founding_to timestamp with time zone); Type: ACL; Schema: public; Owner: -
--

REVOKE EXECUTE ON FUNCTION public.dashboard_data(ws uuid, since7 timestamp with time zone, founding_from timestamp with time zone, founding_to timestamp with time zone) FROM PUBLIC, anon, authenticated;
GRANT ALL ON FUNCTION public.dashboard_data(ws uuid, since7 timestamp with time zone, founding_from timestamp with time zone, founding_to timestamp with time zone) TO authenticated;

--
-- Name: FUNCTION display_name_of(uid uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE EXECUTE ON FUNCTION public.display_name_of(uid uuid) FROM PUBLIC, anon, authenticated;
GRANT ALL ON FUNCTION public.display_name_of(uid uuid) TO authenticated;

--
-- Name: FUNCTION exception_rows(ws uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE EXECUTE ON FUNCTION public.exception_rows(ws uuid) FROM PUBLIC, anon, authenticated;
GRANT ALL ON FUNCTION public.exception_rows(ws uuid) TO authenticated;

--
-- Name: FUNCTION governance_rows(ws uuid, since7 timestamp with time zone); Type: ACL; Schema: public; Owner: -
--

REVOKE EXECUTE ON FUNCTION public.governance_rows(ws uuid, since7 timestamp with time zone) FROM PUBLIC, anon, authenticated;
GRANT ALL ON FUNCTION public.governance_rows(ws uuid, since7 timestamp with time zone) TO authenticated;

--
-- Name: FUNCTION hiring_application_submit(p_ws uuid, p_job uuid, p_fields jsonb, p_consent text, p_ip text, p_lines text[]); Type: ACL; Schema: public; Owner: -
--

REVOKE EXECUTE ON FUNCTION public.hiring_application_submit(p_ws uuid, p_job uuid, p_fields jsonb, p_consent text, p_ip text, p_lines text[]) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.hiring_application_submit(p_ws uuid, p_job uuid, p_fields jsonb, p_consent text, p_ip text, p_lines text[]) TO app_be;

--
-- Name: FUNCTION hiring_availability_save(p_ws uuid, p_user uuid, p_windows jsonb); Type: ACL; Schema: public; Owner: -
--

REVOKE EXECUTE ON FUNCTION public.hiring_availability_save(p_ws uuid, p_user uuid, p_windows jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.hiring_availability_save(p_ws uuid, p_user uuid, p_windows jsonb) TO app_be;

--
-- Name: FUNCTION hiring_candidate_link_staff(p_ws uuid, p_id uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE EXECUTE ON FUNCTION public.hiring_candidate_link_staff(p_ws uuid, p_id uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.hiring_candidate_link_staff(p_ws uuid, p_id uuid) TO app_be;

--
-- Name: FUNCTION hiring_candidate_move(p_ws uuid, p_id uuid, p_stage text, p_reason text, p_actor text, p_summary text); Type: ACL; Schema: public; Owner: -
--

REVOKE EXECUTE ON FUNCTION public.hiring_candidate_move(p_ws uuid, p_id uuid, p_stage text, p_reason text, p_actor text, p_summary text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.hiring_candidate_move(p_ws uuid, p_id uuid, p_stage text, p_reason text, p_actor text, p_summary text) TO app_be;

--
-- Name: FUNCTION hiring_candidate_notes(p_ws uuid, p_id uuid, p_notes text, p_actor text, p_summary text); Type: ACL; Schema: public; Owner: -
--

REVOKE EXECUTE ON FUNCTION public.hiring_candidate_notes(p_ws uuid, p_id uuid, p_notes text, p_actor text, p_summary text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.hiring_candidate_notes(p_ws uuid, p_id uuid, p_notes text, p_actor text, p_summary text) TO app_be;

--
-- Name: FUNCTION hiring_candidate_screened(p_ws uuid, p_id uuid, p_score integer, p_label text, p_reasons jsonb, p_summary text, p_actor text, p_line text); Type: ACL; Schema: public; Owner: -
--

REVOKE EXECUTE ON FUNCTION public.hiring_candidate_screened(p_ws uuid, p_id uuid, p_score integer, p_label text, p_reasons jsonb, p_summary text, p_actor text, p_line text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.hiring_candidate_screened(p_ws uuid, p_id uuid, p_score integer, p_label text, p_reasons jsonb, p_summary text, p_actor text, p_line text) TO app_be;

--
-- Name: FUNCTION hiring_candidates_delete(p_ws uuid, p_ids uuid[]); Type: ACL; Schema: public; Owner: -
--

REVOKE EXECUTE ON FUNCTION public.hiring_candidates_delete(p_ws uuid, p_ids uuid[]) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.hiring_candidates_delete(p_ws uuid, p_ids uuid[]) TO app_be;

--
-- Name: FUNCTION hiring_event_log(p_ws uuid, p_candidate uuid, p_kind text, p_actor text, p_summary text); Type: ACL; Schema: public; Owner: -
--

REVOKE EXECUTE ON FUNCTION public.hiring_event_log(p_ws uuid, p_candidate uuid, p_kind text, p_actor text, p_summary text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.hiring_event_log(p_ws uuid, p_candidate uuid, p_kind text, p_actor text, p_summary text) TO app_be;

--
-- Name: FUNCTION hiring_interview_confirm(p_token text, p_start timestamp with time zone, p_end timestamp with time zone, p_line text); Type: ACL; Schema: public; Owner: -
--

REVOKE EXECUTE ON FUNCTION public.hiring_interview_confirm(p_token text, p_start timestamp with time zone, p_end timestamp with time zone, p_line text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.hiring_interview_confirm(p_token text, p_start timestamp with time zone, p_end timestamp with time zone, p_line text) TO app_be;

--
-- Name: FUNCTION hiring_interview_create(p_ws uuid, p_candidate uuid, p_job uuid, p_fields jsonb, p_token text, p_work uuid, p_actor text, p_line text); Type: ACL; Schema: public; Owner: -
--

REVOKE EXECUTE ON FUNCTION public.hiring_interview_create(p_ws uuid, p_candidate uuid, p_job uuid, p_fields jsonb, p_token text, p_work uuid, p_actor text, p_line text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.hiring_interview_create(p_ws uuid, p_candidate uuid, p_job uuid, p_fields jsonb, p_token text, p_work uuid, p_actor text, p_line text) TO app_be;

--
-- Name: FUNCTION hiring_interview_none_fit(p_token text, p_note text, p_line text); Type: ACL; Schema: public; Owner: -
--

REVOKE EXECUTE ON FUNCTION public.hiring_interview_none_fit(p_token text, p_note text, p_line text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.hiring_interview_none_fit(p_token text, p_note text, p_line text) TO app_be;

--
-- Name: FUNCTION hiring_interview_remind_claim(p_id uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE EXECUTE ON FUNCTION public.hiring_interview_remind_claim(p_id uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.hiring_interview_remind_claim(p_id uuid) TO app_be;

--
-- Name: FUNCTION hiring_interview_status(p_ws uuid, p_id uuid, p_status text, p_actor text, p_line text); Type: ACL; Schema: public; Owner: -
--

REVOKE EXECUTE ON FUNCTION public.hiring_interview_status(p_ws uuid, p_id uuid, p_status text, p_actor text, p_line text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.hiring_interview_status(p_ws uuid, p_id uuid, p_status text, p_actor text, p_line text) TO app_be;

--
-- Name: FUNCTION hiring_job_ads(p_ws uuid, p_id uuid, p_ads jsonb); Type: ACL; Schema: public; Owner: -
--

REVOKE EXECUTE ON FUNCTION public.hiring_job_ads(p_ws uuid, p_id uuid, p_ads jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.hiring_job_ads(p_ws uuid, p_id uuid, p_ads jsonb) TO app_be;

--
-- Name: FUNCTION hiring_job_create(p_ws uuid, p_user uuid, p_slug text, p_fields jsonb); Type: ACL; Schema: public; Owner: -
--

REVOKE EXECUTE ON FUNCTION public.hiring_job_create(p_ws uuid, p_user uuid, p_slug text, p_fields jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.hiring_job_create(p_ws uuid, p_user uuid, p_slug text, p_fields jsonb) TO app_be;

--
-- Name: FUNCTION hiring_job_fill_check(p_ws uuid, p_job uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE EXECUTE ON FUNCTION public.hiring_job_fill_check(p_ws uuid, p_job uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.hiring_job_fill_check(p_ws uuid, p_job uuid) TO app_be;

--
-- Name: FUNCTION hiring_job_status(p_ws uuid, p_id uuid, p_status text); Type: ACL; Schema: public; Owner: -
--

REVOKE EXECUTE ON FUNCTION public.hiring_job_status(p_ws uuid, p_id uuid, p_status text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.hiring_job_status(p_ws uuid, p_id uuid, p_status text) TO app_be;

--
-- Name: FUNCTION hiring_job_update(p_ws uuid, p_id uuid, p_fields jsonb); Type: ACL; Schema: public; Owner: -
--

REVOKE EXECUTE ON FUNCTION public.hiring_job_update(p_ws uuid, p_id uuid, p_fields jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.hiring_job_update(p_ws uuid, p_id uuid, p_fields jsonb) TO app_be;

--
-- Name: FUNCTION hiring_jobs_expire(p_ws uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE EXECUTE ON FUNCTION public.hiring_jobs_expire(p_ws uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.hiring_jobs_expire(p_ws uuid) TO app_be;

--
-- Name: FUNCTION hiring_new_token(); Type: ACL; Schema: public; Owner: -
--

REVOKE EXECUTE ON FUNCTION public.hiring_new_token() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.hiring_new_token() TO app_be;

--
-- Name: FUNCTION hiring_offer_answer(p_token text, p_accept boolean, p_items text[], p_actor text, p_line text); Type: ACL; Schema: public; Owner: -
--

REVOKE EXECUTE ON FUNCTION public.hiring_offer_answer(p_token text, p_accept boolean, p_items text[], p_actor text, p_line text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.hiring_offer_answer(p_token text, p_accept boolean, p_items text[], p_actor text, p_line text) TO app_be;

--
-- Name: FUNCTION hiring_offer_cancel(p_ws uuid, p_id uuid, p_statuses text[], p_actor text, p_line text); Type: ACL; Schema: public; Owner: -
--

REVOKE EXECUTE ON FUNCTION public.hiring_offer_cancel(p_ws uuid, p_id uuid, p_statuses text[], p_actor text, p_line text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.hiring_offer_cancel(p_ws uuid, p_id uuid, p_statuses text[], p_actor text, p_line text) TO app_be;

--
-- Name: FUNCTION hiring_offer_create(p_ws uuid, p_candidate uuid, p_job uuid, p_terms jsonb, p_token text, p_user uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE EXECUTE ON FUNCTION public.hiring_offer_create(p_ws uuid, p_candidate uuid, p_job uuid, p_terms jsonb, p_token text, p_user uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.hiring_offer_create(p_ws uuid, p_candidate uuid, p_job uuid, p_terms jsonb, p_token text, p_user uuid) TO app_be;

--
-- Name: FUNCTION hiring_offer_link(p_ws uuid, p_id uuid, p_work uuid, p_status text); Type: ACL; Schema: public; Owner: -
--

REVOKE EXECUTE ON FUNCTION public.hiring_offer_link(p_ws uuid, p_id uuid, p_work uuid, p_status text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.hiring_offer_link(p_ws uuid, p_id uuid, p_work uuid, p_status text) TO app_be;

--
-- Name: FUNCTION hiring_offer_sent(p_ws uuid, p_id uuid, p_draft text, p_via text, p_expires timestamp with time zone, p_actor text, p_line text); Type: ACL; Schema: public; Owner: -
--

REVOKE EXECUTE ON FUNCTION public.hiring_offer_sent(p_ws uuid, p_id uuid, p_draft text, p_via text, p_expires timestamp with time zone, p_actor text, p_line text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.hiring_offer_sent(p_ws uuid, p_id uuid, p_draft text, p_via text, p_expires timestamp with time zone, p_actor text, p_line text) TO app_be;

--
-- Name: FUNCTION hiring_offers_expire(p_ws uuid, p_line text); Type: ACL; Schema: public; Owner: -
--

REVOKE EXECUTE ON FUNCTION public.hiring_offers_expire(p_ws uuid, p_line text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.hiring_offers_expire(p_ws uuid, p_line text) TO app_be;

--
-- Name: FUNCTION hiring_onboarding_toggle(p_ws uuid, p_id uuid, p_done boolean); Type: ACL; Schema: public; Owner: -
--

REVOKE EXECUTE ON FUNCTION public.hiring_onboarding_toggle(p_ws uuid, p_id uuid, p_done boolean) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.hiring_onboarding_toggle(p_ws uuid, p_id uuid, p_done boolean) TO app_be;

--
-- Name: FUNCTION hiring_ops_status(); Type: ACL; Schema: public; Owner: -
--

REVOKE EXECUTE ON FUNCTION public.hiring_ops_status() FROM PUBLIC, anon, authenticated;

--
-- Name: FUNCTION hiring_retention_log_add(p_ws uuid, p_candidates integer, p_files integer, p_days integer); Type: ACL; Schema: public; Owner: -
--

REVOKE EXECUTE ON FUNCTION public.hiring_retention_log_add(p_ws uuid, p_candidates integer, p_files integer, p_days integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.hiring_retention_log_add(p_ws uuid, p_candidates integer, p_files integer, p_days integer) TO app_be;

--
-- Name: FUNCTION hiring_settings_init(p_ws uuid, p_slug text); Type: ACL; Schema: public; Owner: -
--

REVOKE EXECUTE ON FUNCTION public.hiring_settings_init(p_ws uuid, p_slug text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.hiring_settings_init(p_ws uuid, p_slug text) TO app_be;

--
-- Name: FUNCTION hiring_settings_save(p_ws uuid, p_patch jsonb); Type: ACL; Schema: public; Owner: -
--

REVOKE EXECUTE ON FUNCTION public.hiring_settings_save(p_ws uuid, p_patch jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.hiring_settings_save(p_ws uuid, p_patch jsonb) TO app_be;

--
-- Name: FUNCTION hiring_tick(); Type: ACL; Schema: public; Owner: -
--

REVOKE EXECUTE ON FUNCTION public.hiring_tick() FROM PUBLIC, anon, authenticated;

--
-- Name: FUNCTION inventory_add_po_lines(p_ws uuid, p_po uuid, p_item_ids uuid[], p_qtys numeric[], p_costs numeric[]); Type: ACL; Schema: public; Owner: -
--

REVOKE EXECUTE ON FUNCTION public.inventory_add_po_lines(p_ws uuid, p_po uuid, p_item_ids uuid[], p_qtys numeric[], p_costs numeric[]) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.inventory_add_po_lines(p_ws uuid, p_po uuid, p_item_ids uuid[], p_qtys numeric[], p_costs numeric[]) TO app_be;

--
-- Name: FUNCTION inventory_apply_movement(p_ws uuid, p_item uuid, p_loc uuid, p_kind text, p_delta numeric, p_reason text, p_ref_type text, p_ref_id text, p_ref_label text, p_by text, p_evidence text, p_dedupe text, p_unit_cost numeric); Type: ACL; Schema: public; Owner: -
--

REVOKE EXECUTE ON FUNCTION public.inventory_apply_movement(p_ws uuid, p_item uuid, p_loc uuid, p_kind text, p_delta numeric, p_reason text, p_ref_type text, p_ref_id text, p_ref_label text, p_by text, p_evidence text, p_dedupe text, p_unit_cost numeric) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.inventory_apply_movement(p_ws uuid, p_item uuid, p_loc uuid, p_kind text, p_delta numeric, p_reason text, p_ref_type text, p_ref_id text, p_ref_label text, p_by text, p_evidence text, p_dedupe text, p_unit_cost numeric) TO app_be;

--
-- Name: FUNCTION inventory_cancel_po(p_ws uuid, p_po uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE EXECUTE ON FUNCTION public.inventory_cancel_po(p_ws uuid, p_po uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.inventory_cancel_po(p_ws uuid, p_po uuid) TO app_be;

--
-- Name: FUNCTION inventory_close_receipt(p_receipt uuid, p_total numeric); Type: ACL; Schema: public; Owner: -
--

REVOKE EXECUTE ON FUNCTION public.inventory_close_receipt(p_receipt uuid, p_total numeric) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.inventory_close_receipt(p_receipt uuid, p_total numeric) TO app_be;

--
-- Name: FUNCTION inventory_default_location(p_ws uuid, p_name text); Type: ACL; Schema: public; Owner: -
--

REVOKE EXECUTE ON FUNCTION public.inventory_default_location(p_ws uuid, p_name text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.inventory_default_location(p_ws uuid, p_name text) TO app_be;

--
-- Name: FUNCTION inventory_delete_recipe(p_ws uuid, p_id uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE EXECUTE ON FUNCTION public.inventory_delete_recipe(p_ws uuid, p_id uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.inventory_delete_recipe(p_ws uuid, p_id uuid) TO app_be;

--
-- Name: FUNCTION inventory_discard_receipt(p_receipt uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE EXECUTE ON FUNCTION public.inventory_discard_receipt(p_receipt uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.inventory_discard_receipt(p_receipt uuid) TO app_be;

--
-- Name: FUNCTION inventory_edit_po_draft(p_po uuid, p_supplier uuid, p_expected date, p_line_ids uuid[], p_qtys numeric[], p_costs numeric[]); Type: ACL; Schema: public; Owner: -
--

REVOKE EXECUTE ON FUNCTION public.inventory_edit_po_draft(p_po uuid, p_supplier uuid, p_expected date, p_line_ids uuid[], p_qtys numeric[], p_costs numeric[]) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.inventory_edit_po_draft(p_po uuid, p_supplier uuid, p_expected date, p_line_ids uuid[], p_qtys numeric[], p_costs numeric[]) TO app_be;

--
-- Name: FUNCTION inventory_import_item(p_ws uuid, p_id uuid, p_sku text, p_name text, p_unit text, p_category text, p_cost numeric, p_sell numeric, p_reorder_point numeric, p_reorder_qty numeric, p_supplier uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE EXECUTE ON FUNCTION public.inventory_import_item(p_ws uuid, p_id uuid, p_sku text, p_name text, p_unit text, p_category text, p_cost numeric, p_sell numeric, p_reorder_point numeric, p_reorder_qty numeric, p_supplier uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.inventory_import_item(p_ws uuid, p_id uuid, p_sku text, p_name text, p_unit text, p_category text, p_cost numeric, p_sell numeric, p_reorder_point numeric, p_reorder_qty numeric, p_supplier uuid) TO app_be;

--
-- Name: FUNCTION inventory_insert_po(p_ws uuid, p_po_no text, p_supplier uuid, p_expected date, p_note text, p_source text, p_by text); Type: ACL; Schema: public; Owner: -
--

REVOKE EXECUTE ON FUNCTION public.inventory_insert_po(p_ws uuid, p_po_no text, p_supplier uuid, p_expected date, p_note text, p_source text, p_by text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.inventory_insert_po(p_ws uuid, p_po_no text, p_supplier uuid, p_expected date, p_note text, p_source text, p_by text) TO app_be;

--
-- Name: FUNCTION inventory_mark_po_reminded(p_po uuid, p_note text); Type: ACL; Schema: public; Owner: -
--

REVOKE EXECUTE ON FUNCTION public.inventory_mark_po_reminded(p_po uuid, p_note text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.inventory_mark_po_reminded(p_po uuid, p_note text) TO app_be;

--
-- Name: FUNCTION inventory_mark_po_sent(p_po uuid, p_via text, p_message text, p_work_item uuid, p_note text); Type: ACL; Schema: public; Owner: -
--

REVOKE EXECUTE ON FUNCTION public.inventory_mark_po_sent(p_po uuid, p_via text, p_message text, p_work_item uuid, p_note text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.inventory_mark_po_sent(p_po uuid, p_via text, p_message text, p_work_item uuid, p_note text) TO app_be;

--
-- Name: FUNCTION inventory_mark_po_waiting(p_po uuid, p_work_item uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE EXECUTE ON FUNCTION public.inventory_mark_po_waiting(p_po uuid, p_work_item uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.inventory_mark_po_waiting(p_po uuid, p_work_item uuid) TO app_be;

--
-- Name: FUNCTION inventory_open_receipt(p_ws uuid, p_po uuid, p_invoice text, p_note text, p_by text); Type: ACL; Schema: public; Owner: -
--

REVOKE EXECUTE ON FUNCTION public.inventory_open_receipt(p_ws uuid, p_po uuid, p_invoice text, p_note text, p_by text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.inventory_open_receipt(p_ws uuid, p_po uuid, p_invoice text, p_note text, p_by text) TO app_be;

--
-- Name: FUNCTION inventory_receive_po_line(p_line uuid, p_qty numeric, p_cost numeric); Type: ACL; Schema: public; Owner: -
--

REVOKE EXECUTE ON FUNCTION public.inventory_receive_po_line(p_line uuid, p_qty numeric, p_cost numeric) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.inventory_receive_po_line(p_line uuid, p_qty numeric, p_cost numeric) TO app_be;

--
-- Name: FUNCTION inventory_recompute_po_total(p_po uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE EXECUTE ON FUNCTION public.inventory_recompute_po_total(p_po uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.inventory_recompute_po_total(p_po uuid) TO app_be;

--
-- Name: FUNCTION inventory_refuse_po(p_ws uuid, p_po uuid, p_note text); Type: ACL; Schema: public; Owner: -
--

REVOKE EXECUTE ON FUNCTION public.inventory_refuse_po(p_ws uuid, p_po uuid, p_note text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.inventory_refuse_po(p_ws uuid, p_po uuid, p_note text) TO app_be;

--
-- Name: FUNCTION inventory_save_item(p_ws uuid, p_id uuid, p_sku text, p_name text, p_unit text, p_units jsonb, p_category text, p_cost numeric, p_sell numeric, p_reorder_point numeric, p_reorder_qty numeric, p_supplier uuid, p_aliases text[]); Type: ACL; Schema: public; Owner: -
--

REVOKE EXECUTE ON FUNCTION public.inventory_save_item(p_ws uuid, p_id uuid, p_sku text, p_name text, p_unit text, p_units jsonb, p_category text, p_cost numeric, p_sell numeric, p_reorder_point numeric, p_reorder_qty numeric, p_supplier uuid, p_aliases text[]) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.inventory_save_item(p_ws uuid, p_id uuid, p_sku text, p_name text, p_unit text, p_units jsonb, p_category text, p_cost numeric, p_sell numeric, p_reorder_point numeric, p_reorder_qty numeric, p_supplier uuid, p_aliases text[]) TO app_be;

--
-- Name: FUNCTION inventory_save_location(p_ws uuid, p_id uuid, p_name text); Type: ACL; Schema: public; Owner: -
--

REVOKE EXECUTE ON FUNCTION public.inventory_save_location(p_ws uuid, p_id uuid, p_name text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.inventory_save_location(p_ws uuid, p_id uuid, p_name text) TO app_be;

--
-- Name: FUNCTION inventory_save_recipe(p_ws uuid, p_id uuid, p_name text, p_aliases text[], p_item_ids uuid[], p_qtys numeric[]); Type: ACL; Schema: public; Owner: -
--

REVOKE EXECUTE ON FUNCTION public.inventory_save_recipe(p_ws uuid, p_id uuid, p_name text, p_aliases text[], p_item_ids uuid[], p_qtys numeric[]) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.inventory_save_recipe(p_ws uuid, p_id uuid, p_name text, p_aliases text[], p_item_ids uuid[], p_qtys numeric[]) TO app_be;

--
-- Name: FUNCTION inventory_save_supplier(p_ws uuid, p_id uuid, p_name text, p_contact text, p_email text, p_phone text, p_zalo text, p_channel text, p_lead_time integer, p_terms text, p_note text); Type: ACL; Schema: public; Owner: -
--

REVOKE EXECUTE ON FUNCTION public.inventory_save_supplier(p_ws uuid, p_id uuid, p_name text, p_contact text, p_email text, p_phone text, p_zalo text, p_channel text, p_lead_time integer, p_terms text, p_note text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.inventory_save_supplier(p_ws uuid, p_id uuid, p_name text, p_contact text, p_email text, p_phone text, p_zalo text, p_channel text, p_lead_time integer, p_terms text, p_note text) TO app_be;

--
-- Name: FUNCTION inventory_set_item_active(p_ws uuid, p_id uuid, p_active boolean); Type: ACL; Schema: public; Owner: -
--

REVOKE EXECUTE ON FUNCTION public.inventory_set_item_active(p_ws uuid, p_id uuid, p_active boolean) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.inventory_set_item_active(p_ws uuid, p_id uuid, p_active boolean) TO app_be;

--
-- Name: FUNCTION inventory_set_po_message(p_po uuid, p_message text); Type: ACL; Schema: public; Owner: -
--

REVOKE EXECUTE ON FUNCTION public.inventory_set_po_message(p_po uuid, p_message text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.inventory_set_po_message(p_po uuid, p_message text) TO app_be;

--
-- Name: FUNCTION inventory_set_po_status(p_po uuid, p_status text); Type: ACL; Schema: public; Owner: -
--

REVOKE EXECUTE ON FUNCTION public.inventory_set_po_status(p_po uuid, p_status text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.inventory_set_po_status(p_po uuid, p_status text) TO app_be;

--
-- Name: FUNCTION invite_preview(token text); Type: ACL; Schema: public; Owner: -
--

REVOKE EXECUTE ON FUNCTION public.invite_preview(token text) FROM PUBLIC, anon, authenticated;
GRANT ALL ON FUNCTION public.invite_preview(token text) TO authenticated;

--
-- Name: FUNCTION is_manager(ws uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE EXECUTE ON FUNCTION public.is_manager(ws uuid) FROM PUBLIC, anon, authenticated;
GRANT ALL ON FUNCTION public.is_manager(ws uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_manager(ws uuid) TO app_be;

--
-- Name: FUNCTION is_member(ws uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE EXECUTE ON FUNCTION public.is_member(ws uuid) FROM PUBLIC, anon, authenticated;
GRANT ALL ON FUNCTION public.is_member(ws uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_member(ws uuid) TO app_be;

--
-- Name: FUNCTION is_owner(ws uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE EXECUTE ON FUNCTION public.is_owner(ws uuid) FROM PUBLIC, anon, authenticated;
GRANT ALL ON FUNCTION public.is_owner(ws uuid) TO authenticated;

--
-- Name: FUNCTION is_platform_admin(); Type: ACL; Schema: public; Owner: -
--

REVOKE EXECUTE ON FUNCTION public.is_platform_admin() FROM PUBLIC, anon, authenticated;
GRANT ALL ON FUNCTION public.is_platform_admin() TO authenticated;

--
-- Name: FUNCTION job_ack(p_queue text, p_msg_id bigint); Type: ACL; Schema: public; Owner: -
--

REVOKE EXECUTE ON FUNCTION public.job_ack(p_queue text, p_msg_id bigint) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.job_ack(p_queue text, p_msg_id bigint) TO app_be;

--
-- Name: FUNCTION job_archive(p_queue text, p_msg_id bigint, p_error text); Type: ACL; Schema: public; Owner: -
--

REVOKE EXECUTE ON FUNCTION public.job_archive(p_queue text, p_msg_id bigint, p_error text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.job_archive(p_queue text, p_msg_id bigint, p_error text) TO app_be;

--
-- Name: FUNCTION job_enqueue(p_workspace uuid, p_queue text, p_name text, p_payload jsonb, p_dedupe text); Type: ACL; Schema: public; Owner: -
--

REVOKE EXECUTE ON FUNCTION public.job_enqueue(p_workspace uuid, p_queue text, p_name text, p_payload jsonb, p_dedupe text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.job_enqueue(p_workspace uuid, p_queue text, p_name text, p_payload jsonb, p_dedupe text) TO app_be;

--
-- Name: FUNCTION job_fail(p_queue text, p_msg_id bigint, p_delay_s integer, p_error text); Type: ACL; Schema: public; Owner: -
--

REVOKE EXECUTE ON FUNCTION public.job_fail(p_queue text, p_msg_id bigint, p_delay_s integer, p_error text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.job_fail(p_queue text, p_msg_id bigint, p_delay_s integer, p_error text) TO app_be;

--
-- Name: FUNCTION job_message(p_name text, p_payload jsonb, p_dedupe text, p_outbox uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE EXECUTE ON FUNCTION public.job_message(p_name text, p_payload jsonb, p_dedupe text, p_outbox uuid) FROM PUBLIC, anon, authenticated;

--
-- Name: FUNCTION job_read(p_queue text, p_vt integer, p_qty integer, p_ws_limit integer); Type: ACL; Schema: public; Owner: -
--

REVOKE EXECUTE ON FUNCTION public.job_read(p_queue text, p_vt integer, p_qty integer, p_ws_limit integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.job_read(p_queue text, p_vt integer, p_qty integer, p_ws_limit integer) TO app_be;

--
-- Name: FUNCTION job_requeue(p_outbox uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE EXECUTE ON FUNCTION public.job_requeue(p_outbox uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.job_requeue(p_outbox uuid) TO app_be;

--
-- Name: FUNCTION job_stats(); Type: ACL; Schema: public; Owner: -
--

REVOKE EXECUTE ON FUNCTION public.job_stats() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.job_stats() TO app_be;

--
-- Name: FUNCTION job_status(p_workspace uuid, p_queue text, p_dedupe text); Type: ACL; Schema: public; Owner: -
--

REVOKE EXECUTE ON FUNCTION public.job_status(p_workspace uuid, p_queue text, p_dedupe text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.job_status(p_workspace uuid, p_queue text, p_dedupe text) TO app_be;

--
-- Name: FUNCTION job_status(p_workspace_id uuid, p_queue text, p_name text, p_dedupe_key text); Type: ACL; Schema: public; Owner: -
--

REVOKE EXECUTE ON FUNCTION public.job_status(p_workspace_id uuid, p_queue text, p_name text, p_dedupe_key text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.job_status(p_workspace_id uuid, p_queue text, p_name text, p_dedupe_key text) TO app_be;

--
-- Name: FUNCTION job_touch(p_queue text, p_msg_id bigint, p_vt integer); Type: ACL; Schema: public; Owner: -
--

REVOKE EXECUTE ON FUNCTION public.job_touch(p_queue text, p_msg_id bigint, p_vt integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.job_touch(p_queue text, p_msg_id bigint, p_vt integer) TO app_be;

--
-- Name: FUNCTION knowledge_chunk_visibility_sync(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.knowledge_chunk_visibility_sync() TO anon;
GRANT ALL ON FUNCTION public.knowledge_chunk_visibility_sync() TO authenticated;

--
-- Name: FUNCTION knowledge_enqueue_source(p_workspace uuid, p_kind text, p_title text, p_storage_path text, p_url text, p_meta jsonb); Type: ACL; Schema: public; Owner: -
--

REVOKE EXECUTE ON FUNCTION public.knowledge_enqueue_source(p_workspace uuid, p_kind text, p_title text, p_storage_path text, p_url text, p_meta jsonb) FROM PUBLIC, anon, authenticated;
GRANT ALL ON FUNCTION public.knowledge_enqueue_source(p_workspace uuid, p_kind text, p_title text, p_storage_path text, p_url text, p_meta jsonb) TO authenticated;

--
-- Name: FUNCTION knowledge_fold(t text); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.knowledge_fold(t text) TO anon;
GRANT ALL ON FUNCTION public.knowledge_fold(t text) TO authenticated;

--
-- Name: FUNCTION knowledge_retry_source(p_source uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE EXECUTE ON FUNCTION public.knowledge_retry_source(p_source uuid) FROM PUBLIC, anon, authenticated;
GRANT ALL ON FUNCTION public.knowledge_retry_source(p_source uuid) TO authenticated;

--
-- Name: FUNCTION lead_actor_name(p_workspace uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE EXECUTE ON FUNCTION public.lead_actor_name(p_workspace uuid) FROM PUBLIC, anon, authenticated;

--
-- Name: FUNCTION lead_flows_fill_installation(); Type: ACL; Schema: public; Owner: -
--

REVOKE EXECUTE ON FUNCTION public.lead_flows_fill_installation() FROM PUBLIC, anon, authenticated;

--
-- Name: TABLE responsibilities; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.responsibilities TO authenticated;
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.responsibilities TO app_be;

--
-- Name: FUNCTION lead_step_json(r public.responsibilities); Type: ACL; Schema: public; Owner: -
--

REVOKE EXECUTE ON FUNCTION public.lead_step_json(r public.responsibilities) FROM PUBLIC, anon, authenticated;

--
-- Name: FUNCTION lead_step_owner(p_workspace uuid, p_owner text, p_actor text, OUT o_kind text, OUT o_agent uuid, OUT o_name text); Type: ACL; Schema: public; Owner: -
--

REVOKE EXECUTE ON FUNCTION public.lead_step_owner(p_workspace uuid, p_owner text, p_actor text, OUT o_kind text, OUT o_agent uuid, OUT o_name text) FROM PUBLIC, anon, authenticated;

--
-- Name: FUNCTION loyalty_ledger_immutable(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.loyalty_ledger_immutable() TO anon;
GRANT ALL ON FUNCTION public.loyalty_ledger_immutable() TO authenticated;

--
-- Name: FUNCTION loyalty_post(p_workspace uuid, p_customer uuid, p_kind text, p_points integer, p_ref text, p_by text, p_amount_vnd bigint, p_order_id uuid, p_invoice_id uuid, p_reward_id uuid, p_work_item_id uuid, p_evidence text, p_expires_at timestamp with time zone, p_occurred_at timestamp with time zone); Type: ACL; Schema: public; Owner: -
--

REVOKE EXECUTE ON FUNCTION public.loyalty_post(p_workspace uuid, p_customer uuid, p_kind text, p_points integer, p_ref text, p_by text, p_amount_vnd bigint, p_order_id uuid, p_invoice_id uuid, p_reward_id uuid, p_work_item_id uuid, p_evidence text, p_expires_at timestamp with time zone, p_occurred_at timestamp with time zone) FROM PUBLIC, anon, authenticated;

--
-- Name: FUNCTION match_knowledge(p_workspace uuid, p_module text, p_query_embedding extensions.vector, p_query text, p_limit integer, p_audience text, p_query_model text, p_installation uuid); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.match_knowledge(p_workspace uuid, p_module text, p_query_embedding extensions.vector, p_query text, p_limit integer, p_audience text, p_query_model text, p_installation uuid) TO anon;
GRANT ALL ON FUNCTION public.match_knowledge(p_workspace uuid, p_module text, p_query_embedding extensions.vector, p_query text, p_limit integer, p_audience text, p_query_model text, p_installation uuid) TO authenticated;

--
-- Name: FUNCTION member_role(ws uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE EXECUTE ON FUNCTION public.member_role(ws uuid) FROM PUBLIC, anon, authenticated;
GRANT ALL ON FUNCTION public.member_role(ws uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.member_role(ws uuid) TO app_be;

--
-- Name: FUNCTION module_context_versions_immutable(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.module_context_versions_immutable() TO anon;
GRANT ALL ON FUNCTION public.module_context_versions_immutable() TO authenticated;

--
-- Name: FUNCTION module_installations_fill(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.module_installations_fill() TO anon;
GRANT ALL ON FUNCTION public.module_installations_fill() TO authenticated;

--
-- Name: FUNCTION module_type_name(p_key text); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.module_type_name(p_key text) TO anon;
GRANT ALL ON FUNCTION public.module_type_name(p_key text) TO authenticated;

--
-- Name: FUNCTION my_sessions(); Type: ACL; Schema: public; Owner: -
--

REVOKE EXECUTE ON FUNCTION public.my_sessions() FROM PUBLIC, anon, authenticated;
GRANT ALL ON FUNCTION public.my_sessions() TO authenticated;

--
-- Name: FUNCTION my_staff_id(ws uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE EXECUTE ON FUNCTION public.my_staff_id(ws uuid) FROM PUBLIC, anon, authenticated;
GRANT ALL ON FUNCTION public.my_staff_id(ws uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.my_staff_id(ws uuid) TO app_be;

--
-- Name: FUNCTION n8n_runs_mirror(); Type: ACL; Schema: public; Owner: -
--

REVOKE EXECUTE ON FUNCTION public.n8n_runs_mirror() FROM PUBLIC, anon, authenticated;

--
-- Name: FUNCTION office_data(ws uuid, since7 timestamp with time zone); Type: ACL; Schema: public; Owner: -
--

REVOKE EXECUTE ON FUNCTION public.office_data(ws uuid, since7 timestamp with time zone) FROM PUBLIC, anon, authenticated;
GRANT ALL ON FUNCTION public.office_data(ws uuid, since7 timestamp with time zone) TO authenticated;

--
-- Name: FUNCTION owns_workspace(ws uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE EXECUTE ON FUNCTION public.owns_workspace(ws uuid) FROM PUBLIC, anon, authenticated;
GRANT ALL ON FUNCTION public.owns_workspace(ws uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.owns_workspace(ws uuid) TO app_be;

--
-- Name: FUNCTION payment_order_request(p_workspace uuid, p_kind text, p_target text); Type: ACL; Schema: public; Owner: -
--

REVOKE EXECUTE ON FUNCTION public.payment_order_request(p_workspace uuid, p_kind text, p_target text) FROM PUBLIC, anon, authenticated;
GRANT ALL ON FUNCTION public.payment_order_request(p_workspace uuid, p_kind text, p_target text) TO authenticated;

--
-- Name: FUNCTION post_ai_usage_notice(p_workspace uuid, p_period date, p_level text, p_body text); Type: ACL; Schema: public; Owner: -
--

REVOKE EXECUTE ON FUNCTION public.post_ai_usage_notice(p_workspace uuid, p_period date, p_level text, p_body text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.post_ai_usage_notice(p_workspace uuid, p_period date, p_level text, p_body text) TO app_be;

--
-- Name: FUNCTION post_office_notice(p_workspace uuid, p_body text); Type: ACL; Schema: public; Owner: -
--

REVOKE EXECUTE ON FUNCTION public.post_office_notice(p_workspace uuid, p_body text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.post_office_notice(p_workspace uuid, p_body text) TO app_be;

--
-- Name: FUNCTION promo_state(ws uuid, founding_from timestamp with time zone, founding_to timestamp with time zone); Type: ACL; Schema: public; Owner: -
--

REVOKE EXECUTE ON FUNCTION public.promo_state(ws uuid, founding_from timestamp with time zone, founding_to timestamp with time zone) FROM PUBLIC, anon, authenticated;
GRANT ALL ON FUNCTION public.promo_state(ws uuid, founding_from timestamp with time zone, founding_to timestamp with time zone) TO authenticated;

--
-- Name: FUNCTION read_app_command(p_id uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE EXECUTE ON FUNCTION public.read_app_command(p_id uuid) FROM PUBLIC, anon, authenticated;
GRANT ALL ON FUNCTION public.read_app_command(p_id uuid) TO authenticated;

--
-- Name: FUNCTION record_ai_usage(p_workspace uuid, p_kind text, p_module text, p_model text, p_prompt integer, p_completion integer, p_cost numeric, p_estimated boolean); Type: ACL; Schema: public; Owner: -
--

REVOKE EXECUTE ON FUNCTION public.record_ai_usage(p_workspace uuid, p_kind text, p_module text, p_model text, p_prompt integer, p_completion integer, p_cost numeric, p_estimated boolean) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_ai_usage(p_workspace uuid, p_kind text, p_module text, p_model text, p_prompt integer, p_completion integer, p_cost numeric, p_estimated boolean) TO app_be;

--
-- Name: FUNCTION record_lead_outcome(p_workspace uuid, p_lead uuid, p_stage text, p_evidence text, p_locale text); Type: ACL; Schema: public; Owner: -
--

REVOKE EXECUTE ON FUNCTION public.record_lead_outcome(p_workspace uuid, p_lead uuid, p_stage text, p_evidence text, p_locale text) FROM PUBLIC, anon, authenticated;
GRANT ALL ON FUNCTION public.record_lead_outcome(p_workspace uuid, p_lead uuid, p_stage text, p_evidence text, p_locale text) TO authenticated;

--
-- Name: FUNCTION request_admin_invite_resend(p_workspace uuid, p_invite uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE EXECUTE ON FUNCTION public.request_admin_invite_resend(p_workspace uuid, p_invite uuid) FROM PUBLIC, anon, authenticated;
GRANT ALL ON FUNCTION public.request_admin_invite_resend(p_workspace uuid, p_invite uuid) TO authenticated;

--
-- Name: FUNCTION request_agent_sync(p_workspace uuid, p_installation uuid, p_force boolean); Type: ACL; Schema: public; Owner: -
--

REVOKE EXECUTE ON FUNCTION public.request_agent_sync(p_workspace uuid, p_installation uuid, p_force boolean) FROM PUBLIC, anon, authenticated;
GRANT ALL ON FUNCTION public.request_agent_sync(p_workspace uuid, p_installation uuid, p_force boolean) TO authenticated;

--
-- Name: FUNCTION request_execution_decision(p_workspace uuid, p_execution uuid, p_decision text, p_edited_draft text, p_locale text); Type: ACL; Schema: public; Owner: -
--

REVOKE EXECUTE ON FUNCTION public.request_execution_decision(p_workspace uuid, p_execution uuid, p_decision text, p_edited_draft text, p_locale text) FROM PUBLIC, anon, authenticated;
GRANT ALL ON FUNCTION public.request_execution_decision(p_workspace uuid, p_execution uuid, p_decision text, p_edited_draft text, p_locale text) TO authenticated;

--
-- Name: FUNCTION request_invite_command(p_workspace uuid, p_action text, p_invite uuid, p_email text, p_role text, p_staff uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE EXECUTE ON FUNCTION public.request_invite_command(p_workspace uuid, p_action text, p_invite uuid, p_email text, p_role text, p_staff uuid) FROM PUBLIC, anon, authenticated;
GRANT ALL ON FUNCTION public.request_invite_command(p_workspace uuid, p_action text, p_invite uuid, p_email text, p_role text, p_staff uuid) TO authenticated;

--
-- Name: FUNCTION request_office_confirm(p_workspace uuid, p_candidate uuid, p_locale text); Type: ACL; Schema: public; Owner: -
--

REVOKE EXECUTE ON FUNCTION public.request_office_confirm(p_workspace uuid, p_candidate uuid, p_locale text) FROM PUBLIC, anon, authenticated;
GRANT ALL ON FUNCTION public.request_office_confirm(p_workspace uuid, p_candidate uuid, p_locale text) TO authenticated;

--
-- Name: FUNCTION request_office_propose(p_workspace uuid, p_message uuid, p_locale text); Type: ACL; Schema: public; Owner: -
--

REVOKE EXECUTE ON FUNCTION public.request_office_propose(p_workspace uuid, p_message uuid, p_locale text) FROM PUBLIC, anon, authenticated;
GRANT ALL ON FUNCTION public.request_office_propose(p_workspace uuid, p_message uuid, p_locale text) TO authenticated;

--
-- Name: FUNCTION request_video_render(p_project uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE EXECUTE ON FUNCTION public.request_video_render(p_project uuid) FROM PUBLIC, anon, authenticated;
GRANT ALL ON FUNCTION public.request_video_render(p_project uuid) TO authenticated;

--
-- Name: FUNCTION request_work_decision(p_workspace uuid, p_work_item uuid, p_decision text, p_edits jsonb, p_note text, p_basis text, p_locale text); Type: ACL; Schema: public; Owner: -
--

REVOKE EXECUTE ON FUNCTION public.request_work_decision(p_workspace uuid, p_work_item uuid, p_decision text, p_edits jsonb, p_note text, p_basis text, p_locale text) FROM PUBLIC, anon, authenticated;
GRANT ALL ON FUNCTION public.request_work_decision(p_workspace uuid, p_work_item uuid, p_decision text, p_edits jsonb, p_note text, p_basis text, p_locale text) TO authenticated;

--
-- Name: FUNCTION resolve_installation(p_ws uuid, p_module text, p_conversation uuid, p_lead uuid, p_chain uuid); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.resolve_installation(p_ws uuid, p_module text, p_conversation uuid, p_lead uuid, p_chain uuid) TO anon;
GRANT ALL ON FUNCTION public.resolve_installation(p_ws uuid, p_module text, p_conversation uuid, p_lead uuid, p_chain uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.resolve_installation(p_ws uuid, p_module text, p_conversation uuid, p_lead uuid, p_chain uuid) TO app_be;

--
-- Name: FUNCTION responsibility_rows(ws uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE EXECUTE ON FUNCTION public.responsibility_rows(ws uuid) FROM PUBLIC, anon, authenticated;
GRANT ALL ON FUNCTION public.responsibility_rows(ws uuid) TO authenticated;

--
-- Name: FUNCTION revoke_my_session(session_id uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE EXECUTE ON FUNCTION public.revoke_my_session(session_id uuid) FROM PUBLIC, anon, authenticated;
GRANT ALL ON FUNCTION public.revoke_my_session(session_id uuid) TO authenticated;

--
-- Name: FUNCTION revoke_workspace_invite(p_workspace uuid, p_invite uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE EXECUTE ON FUNCTION public.revoke_workspace_invite(p_workspace uuid, p_invite uuid) FROM PUBLIC, anon, authenticated;
GRANT ALL ON FUNCTION public.revoke_workspace_invite(p_workspace uuid, p_invite uuid) TO authenticated;

--
-- Name: FUNCTION session_bootstrap(); Type: ACL; Schema: public; Owner: -
--

REVOKE EXECUTE ON FUNCTION public.session_bootstrap() FROM PUBLIC, anon, authenticated;
GRANT ALL ON FUNCTION public.session_bootstrap() TO authenticated;

--
-- Name: FUNCTION settle_credit_topups(p_workspace uuid, p_force boolean); Type: ACL; Schema: public; Owner: -
--

REVOKE EXECUTE ON FUNCTION public.settle_credit_topups(p_workspace uuid, p_force boolean) FROM PUBLIC, anon, authenticated;

--
-- Name: FUNCTION settle_payment_order(p_order_code text, p_amount bigint, p_sepay_id bigint); Type: ACL; Schema: public; Owner: -
--

REVOKE EXECUTE ON FUNCTION public.settle_payment_order(p_order_code text, p_amount bigint, p_sepay_id bigint) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.settle_payment_order(p_order_code text, p_amount bigint, p_sepay_id bigint) TO app_be;

--
-- Name: FUNCTION shell_data(ws uuid, founding_from timestamp with time zone, founding_to timestamp with time zone); Type: ACL; Schema: public; Owner: -
--

REVOKE EXECUTE ON FUNCTION public.shell_data(ws uuid, founding_from timestamp with time zone, founding_to timestamp with time zone) FROM PUBLIC, anon, authenticated;
GRANT ALL ON FUNCTION public.shell_data(ws uuid, founding_from timestamp with time zone, founding_to timestamp with time zone) TO authenticated;
GRANT EXECUTE ON FUNCTION public.shell_data(ws uuid, founding_from timestamp with time zone, founding_to timestamp with time zone) TO app_be;

--
-- Name: FUNCTION shifts_add_availability(p_ws uuid, p_staff uuid, p_weekday smallint, p_date date, p_start time without time zone, p_end time without time zone, p_available boolean, p_note text, p_status text, p_decider text); Type: ACL; Schema: public; Owner: -
--

REVOKE EXECUTE ON FUNCTION public.shifts_add_availability(p_ws uuid, p_staff uuid, p_weekday smallint, p_date date, p_start time without time zone, p_end time without time zone, p_available boolean, p_note text, p_status text, p_decider text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.shifts_add_availability(p_ws uuid, p_staff uuid, p_weekday smallint, p_date date, p_start time without time zone, p_end time without time zone, p_available boolean, p_note text, p_status text, p_decider text) TO app_be;

--
-- Name: FUNCTION shifts_add_shifts(p_ws uuid, p_schedule uuid, p_dates date[], p_starts time without time zone[], p_ends time without time zone[], p_positions uuid[], p_staff uuid[], p_source text); Type: ACL; Schema: public; Owner: -
--

REVOKE EXECUTE ON FUNCTION public.shifts_add_shifts(p_ws uuid, p_schedule uuid, p_dates date[], p_starts time without time zone[], p_ends time without time zone[], p_positions uuid[], p_staff uuid[], p_source text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.shifts_add_shifts(p_ws uuid, p_schedule uuid, p_dates date[], p_starts time without time zone[], p_ends time without time zone[], p_positions uuid[], p_staff uuid[], p_source text) TO app_be;

--
-- Name: FUNCTION shifts_check_in(p_ws uuid, p_shift uuid, p_staff uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE EXECUTE ON FUNCTION public.shifts_check_in(p_ws uuid, p_shift uuid, p_staff uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.shifts_check_in(p_ws uuid, p_shift uuid, p_staff uuid) TO app_be;

--
-- Name: FUNCTION shifts_create_leave(p_ws uuid, p_staff uuid, p_from date, p_to date, p_reason text); Type: ACL; Schema: public; Owner: -
--

REVOKE EXECUTE ON FUNCTION public.shifts_create_leave(p_ws uuid, p_staff uuid, p_from date, p_to date, p_reason text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.shifts_create_leave(p_ws uuid, p_staff uuid, p_from date, p_to date, p_reason text) TO app_be;

--
-- Name: FUNCTION shifts_create_swap(p_ws uuid, p_kind text, p_shift uuid, p_from uuid, p_to uuid, p_reason text); Type: ACL; Schema: public; Owner: -
--

REVOKE EXECUTE ON FUNCTION public.shifts_create_swap(p_ws uuid, p_kind text, p_shift uuid, p_from uuid, p_to uuid, p_reason text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.shifts_create_swap(p_ws uuid, p_kind text, p_shift uuid, p_from uuid, p_to uuid, p_reason text) TO app_be;

--
-- Name: FUNCTION shifts_decide_availability(p_ws uuid, p_id uuid, p_status text, p_decider text); Type: ACL; Schema: public; Owner: -
--

REVOKE EXECUTE ON FUNCTION public.shifts_decide_availability(p_ws uuid, p_id uuid, p_status text, p_decider text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.shifts_decide_availability(p_ws uuid, p_id uuid, p_status text, p_decider text) TO app_be;

--
-- Name: FUNCTION shifts_decide_leave(p_ws uuid, p_leave uuid, p_status text, p_by text, p_work uuid, p_note text); Type: ACL; Schema: public; Owner: -
--

REVOKE EXECUTE ON FUNCTION public.shifts_decide_leave(p_ws uuid, p_leave uuid, p_status text, p_by text, p_work uuid, p_note text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.shifts_decide_leave(p_ws uuid, p_leave uuid, p_status text, p_by text, p_work uuid, p_note text) TO app_be;

--
-- Name: FUNCTION shifts_decide_swap(p_ws uuid, p_swap uuid, p_status text, p_by text, p_checks jsonb, p_work uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE EXECUTE ON FUNCTION public.shifts_decide_swap(p_ws uuid, p_swap uuid, p_status text, p_by text, p_checks jsonb, p_work uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.shifts_decide_swap(p_ws uuid, p_swap uuid, p_status text, p_by text, p_checks jsonb, p_work uuid) TO app_be;

--
-- Name: FUNCTION shifts_import_apply(p_ws uuid, p_positions jsonb, p_staff jsonb, p_blocks jsonb); Type: ACL; Schema: public; Owner: -
--

REVOKE EXECUTE ON FUNCTION public.shifts_import_apply(p_ws uuid, p_positions jsonb, p_staff jsonb, p_blocks jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.shifts_import_apply(p_ws uuid, p_positions jsonb, p_staff jsonb, p_blocks jsonb) TO app_be;

--
-- Name: FUNCTION shifts_link_leave(p_ws uuid, p_leave uuid, p_work uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE EXECUTE ON FUNCTION public.shifts_link_leave(p_ws uuid, p_leave uuid, p_work uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.shifts_link_leave(p_ws uuid, p_leave uuid, p_work uuid) TO app_be;

--
-- Name: FUNCTION shifts_link_schedule(p_ws uuid, p_schedule uuid, p_work uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE EXECUTE ON FUNCTION public.shifts_link_schedule(p_ws uuid, p_schedule uuid, p_work uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.shifts_link_schedule(p_ws uuid, p_schedule uuid, p_work uuid) TO app_be;

--
-- Name: FUNCTION shifts_link_swap(p_ws uuid, p_swap uuid, p_checks jsonb, p_work uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE EXECUTE ON FUNCTION public.shifts_link_swap(p_ws uuid, p_swap uuid, p_checks jsonb, p_work uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.shifts_link_swap(p_ws uuid, p_swap uuid, p_checks jsonb, p_work uuid) TO app_be;

--
-- Name: FUNCTION shifts_my_profile(ws uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE EXECUTE ON FUNCTION public.shifts_my_profile(ws uuid) FROM PUBLIC, anon, authenticated;
GRANT ALL ON FUNCTION public.shifts_my_profile(ws uuid) TO authenticated;

--
-- Name: FUNCTION shifts_publish(p_ws uuid, p_schedule uuid, p_evidence jsonb, p_work uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE EXECUTE ON FUNCTION public.shifts_publish(p_ws uuid, p_schedule uuid, p_evidence jsonb, p_work uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.shifts_publish(p_ws uuid, p_schedule uuid, p_evidence jsonb, p_work uuid) TO app_be;

--
-- Name: FUNCTION shifts_reassign(p_ws uuid, p_shift uuid, p_staff uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE EXECUTE ON FUNCTION public.shifts_reassign(p_ws uuid, p_shift uuid, p_staff uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.shifts_reassign(p_ws uuid, p_shift uuid, p_staff uuid) TO app_be;

--
-- Name: FUNCTION shifts_record_notice(p_ws uuid, p_staff uuid, p_schedule uuid, p_shift uuid, p_kind text, p_channel text, p_status text, p_body text, p_error text); Type: ACL; Schema: public; Owner: -
--

REVOKE EXECUTE ON FUNCTION public.shifts_record_notice(p_ws uuid, p_staff uuid, p_schedule uuid, p_shift uuid, p_kind text, p_channel text, p_status text, p_body text, p_error text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.shifts_record_notice(p_ws uuid, p_staff uuid, p_schedule uuid, p_shift uuid, p_kind text, p_channel text, p_status text, p_body text, p_error text) TO app_be;

--
-- Name: FUNCTION shifts_record_notification(p_ws uuid, p_staff uuid, p_schedule uuid, p_shift uuid, p_kind text, p_channel text, p_status text, p_body text); Type: ACL; Schema: public; Owner: -
--

REVOKE EXECUTE ON FUNCTION public.shifts_record_notification(p_ws uuid, p_staff uuid, p_schedule uuid, p_shift uuid, p_kind text, p_channel text, p_status text, p_body text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.shifts_record_notification(p_ws uuid, p_staff uuid, p_schedule uuid, p_shift uuid, p_kind text, p_channel text, p_status text, p_body text) TO app_be;

--
-- Name: FUNCTION shifts_remove_availability(p_ws uuid, p_id uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE EXECUTE ON FUNCTION public.shifts_remove_availability(p_ws uuid, p_id uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.shifts_remove_availability(p_ws uuid, p_id uuid) TO app_be;

--
-- Name: FUNCTION shifts_remove_coverage(p_ws uuid, p_id uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE EXECUTE ON FUNCTION public.shifts_remove_coverage(p_ws uuid, p_id uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.shifts_remove_coverage(p_ws uuid, p_id uuid) TO app_be;

--
-- Name: FUNCTION shifts_remove_position(p_ws uuid, p_id uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE EXECUTE ON FUNCTION public.shifts_remove_position(p_ws uuid, p_id uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.shifts_remove_position(p_ws uuid, p_id uuid) TO app_be;

--
-- Name: FUNCTION shifts_remove_shift(p_ws uuid, p_shift uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE EXECUTE ON FUNCTION public.shifts_remove_shift(p_ws uuid, p_shift uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.shifts_remove_shift(p_ws uuid, p_shift uuid) TO app_be;

--
-- Name: FUNCTION shifts_save_coverage(p_ws uuid, p_id uuid, p_weekdays smallint[], p_start time without time zone, p_end time without time zone, p_position uuid, p_min integer, p_ideal integer, p_peak boolean); Type: ACL; Schema: public; Owner: -
--

REVOKE EXECUTE ON FUNCTION public.shifts_save_coverage(p_ws uuid, p_id uuid, p_weekdays smallint[], p_start time without time zone, p_end time without time zone, p_position uuid, p_min integer, p_ideal integer, p_peak boolean) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.shifts_save_coverage(p_ws uuid, p_id uuid, p_weekdays smallint[], p_start time without time zone, p_end time without time zone, p_position uuid, p_min integer, p_ideal integer, p_peak boolean) TO app_be;

--
-- Name: FUNCTION shifts_save_pay(p_ws uuid, p_staff uuid, p_wage integer); Type: ACL; Schema: public; Owner: -
--

REVOKE EXECUTE ON FUNCTION public.shifts_save_pay(p_ws uuid, p_staff uuid, p_wage integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.shifts_save_pay(p_ws uuid, p_staff uuid, p_wage integer) TO app_be;

--
-- Name: FUNCTION shifts_save_position(p_ws uuid, p_id uuid, p_name text, p_color text); Type: ACL; Schema: public; Owner: -
--

REVOKE EXECUTE ON FUNCTION public.shifts_save_position(p_ws uuid, p_id uuid, p_name text, p_color text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.shifts_save_position(p_ws uuid, p_id uuid, p_name text, p_color text) TO app_be;

--
-- Name: FUNCTION shifts_save_schedule(p_ws uuid, p_week date, p_cost bigint, p_summary jsonb, p_evidence jsonb, p_ms integer, p_by text); Type: ACL; Schema: public; Owner: -
--

REVOKE EXECUTE ON FUNCTION public.shifts_save_schedule(p_ws uuid, p_week date, p_cost bigint, p_summary jsonb, p_evidence jsonb, p_ms integer, p_by text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.shifts_save_schedule(p_ws uuid, p_week date, p_cost bigint, p_summary jsonb, p_evidence jsonb, p_ms integer, p_by text) TO app_be;

--
-- Name: FUNCTION shifts_save_settings(p_ws uuid, p_opening jsonb, p_swap integer, p_leave integer, p_remind integer, p_noshow integer, p_overtime numeric); Type: ACL; Schema: public; Owner: -
--

REVOKE EXECUTE ON FUNCTION public.shifts_save_settings(p_ws uuid, p_opening jsonb, p_swap integer, p_leave integer, p_remind integer, p_noshow integer, p_overtime numeric) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.shifts_save_settings(p_ws uuid, p_opening jsonb, p_swap integer, p_leave integer, p_remind integer, p_noshow integer, p_overtime numeric) TO app_be;

--
-- Name: FUNCTION shifts_save_staff(p_ws uuid, p_id uuid, p_row jsonb); Type: ACL; Schema: public; Owner: -
--

REVOKE EXECUTE ON FUNCTION public.shifts_save_staff(p_ws uuid, p_id uuid, p_row jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.shifts_save_staff(p_ws uuid, p_id uuid, p_row jsonb) TO app_be;

--
-- Name: FUNCTION shifts_set_explanation(p_ws uuid, p_schedule uuid, p_text text, p_evidence jsonb); Type: ACL; Schema: public; Owner: -
--

REVOKE EXECUTE ON FUNCTION public.shifts_set_explanation(p_ws uuid, p_schedule uuid, p_text text, p_evidence jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.shifts_set_explanation(p_ws uuid, p_schedule uuid, p_text text, p_evidence jsonb) TO app_be;

--
-- Name: FUNCTION storage_ws_manager(p_name text); Type: ACL; Schema: public; Owner: -
--

REVOKE EXECUTE ON FUNCTION public.storage_ws_manager(p_name text) FROM PUBLIC, anon, authenticated;
GRANT ALL ON FUNCTION public.storage_ws_manager(p_name text) TO authenticated;

--
-- Name: FUNCTION storage_ws_member(p_name text); Type: ACL; Schema: public; Owner: -
--

REVOKE EXECUTE ON FUNCTION public.storage_ws_member(p_name text) FROM PUBLIC, anon, authenticated;
GRANT ALL ON FUNCTION public.storage_ws_member(p_name text) TO authenticated;

--
-- Name: FUNCTION update_my_profile(ws uuid, new_display_name text); Type: ACL; Schema: public; Owner: -
--

REVOKE EXECUTE ON FUNCTION public.update_my_profile(ws uuid, new_display_name text) FROM PUBLIC, anon, authenticated;
GRANT ALL ON FUNCTION public.update_my_profile(ws uuid, new_display_name text) TO authenticated;

--
-- Name: FUNCTION usage_notice_post(p_workspace uuid, p_period date, p_level text, p_body text); Type: ACL; Schema: public; Owner: -
--

REVOKE EXECUTE ON FUNCTION public.usage_notice_post(p_workspace uuid, p_period date, p_level text, p_body text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.usage_notice_post(p_workspace uuid, p_period date, p_level text, p_body text) TO app_be;

--
-- Name: FUNCTION usage_quota_status(p_workspace uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE EXECUTE ON FUNCTION public.usage_quota_status(p_workspace uuid) FROM PUBLIC, anon, authenticated;
GRANT ALL ON FUNCTION public.usage_quota_status(p_workspace uuid) TO authenticated;

--
-- Name: FUNCTION video_renders_reap(); Type: ACL; Schema: public; Owner: -
--

REVOKE EXECUTE ON FUNCTION public.video_renders_reap() FROM PUBLIC, anon, authenticated;

--
-- Name: FUNCTION video_renders_touch(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.video_renders_touch() TO anon;
GRANT ALL ON FUNCTION public.video_renders_touch() TO authenticated;

--
-- Name: FUNCTION video_touch(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.video_touch() TO anon;
GRANT ALL ON FUNCTION public.video_touch() TO authenticated;

--
-- Name: FUNCTION work_items_fill_installation(); Type: ACL; Schema: public; Owner: -
--

REVOKE EXECUTE ON FUNCTION public.work_items_fill_installation() FROM PUBLIC, anon, authenticated;

--
-- Name: FUNCTION workspace_member_contacts(p_workspace uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE EXECUTE ON FUNCTION public.workspace_member_contacts(p_workspace uuid) FROM PUBLIC, anon, authenticated;
GRANT ALL ON FUNCTION public.workspace_member_contacts(p_workspace uuid) TO authenticated;

--
-- Name: FUNCTION workspace_members_directory(ws uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE EXECUTE ON FUNCTION public.workspace_members_directory(ws uuid) FROM PUBLIC, anon, authenticated;
GRANT ALL ON FUNCTION public.workspace_members_directory(ws uuid) TO authenticated;

--
-- Name: FUNCTION workspace_members_guard(); Type: ACL; Schema: public; Owner: -
--

REVOKE EXECUTE ON FUNCTION public.workspace_members_guard() FROM PUBLIC, anon, authenticated;

--
-- Name: FUNCTION workspace_storage_bytes(p_workspace uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE EXECUTE ON FUNCTION public.workspace_storage_bytes(p_workspace uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.workspace_storage_bytes(p_workspace uuid) TO app_be;

--
-- Name: FUNCTION workspaces_add_owner_member(); Type: ACL; Schema: public; Owner: -
--

REVOKE EXECUTE ON FUNCTION public.workspaces_add_owner_member() FROM PUBLIC, anon, authenticated;

--
-- Name: FUNCTION workspaces_billing_guard(); Type: ACL; Schema: public; Owner: -
--

REVOKE EXECUTE ON FUNCTION public.workspaces_billing_guard() FROM PUBLIC, anon, authenticated;

--
-- Name: FUNCTION zalo_authorization_return(p_state text, p_code text, p_oa_id text); Type: ACL; Schema: public; Owner: -
--

REVOKE EXECUTE ON FUNCTION public.zalo_authorization_return(p_state text, p_code text, p_oa_id text) FROM PUBLIC, anon, authenticated;
GRANT ALL ON FUNCTION public.zalo_authorization_return(p_state text, p_code text, p_oa_id text) TO authenticated;

--
-- Name: FUNCTION zalo_wizard_begin(p_connection uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE EXECUTE ON FUNCTION public.zalo_wizard_begin(p_connection uuid) FROM PUBLIC, anon, authenticated;
GRANT ALL ON FUNCTION public.zalo_wizard_begin(p_connection uuid) TO authenticated;

--
-- Name: FUNCTION zalo_wizard_oa_secret(p_connection uuid, p_oa_secret text); Type: ACL; Schema: public; Owner: -
--

REVOKE EXECUTE ON FUNCTION public.zalo_wizard_oa_secret(p_connection uuid, p_oa_secret text) FROM PUBLIC, anon, authenticated;
GRANT ALL ON FUNCTION public.zalo_wizard_oa_secret(p_connection uuid, p_oa_secret text) TO authenticated;

--
-- Name: FUNCTION zalo_wizard_start(p_workspace uuid, p_name text, p_app_id text, p_app_secret text); Type: ACL; Schema: public; Owner: -
--

REVOKE EXECUTE ON FUNCTION public.zalo_wizard_start(p_workspace uuid, p_name text, p_app_id text, p_app_secret text) FROM PUBLIC, anon, authenticated;
GRANT ALL ON FUNCTION public.zalo_wizard_start(p_workspace uuid, p_name text, p_app_id text, p_app_secret text) TO authenticated;

--
-- Name: TABLE accounting_adjustments; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.accounting_adjustments TO authenticated;
GRANT SELECT,INSERT ON TABLE public.accounting_adjustments TO app_be;

--
-- Name: TABLE agent_access_log; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.agent_access_log TO authenticated;
GRANT SELECT,INSERT ON TABLE public.agent_access_log TO app_be;

--
-- Name: TABLE agent_connections; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.agent_connections TO authenticated;
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.agent_connections TO app_be;

--
-- Name: TABLE agent_conversations; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.agent_conversations TO authenticated;
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.agent_conversations TO app_be;

--
-- Name: TABLE agent_messages; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.agent_messages TO authenticated;
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.agent_messages TO app_be;

--
-- Name: TABLE agents; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.agents TO authenticated;
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.agents TO app_be;

--
-- Name: TABLE ai_generations; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT ON TABLE public.ai_generations TO authenticated;
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.ai_generations TO app_be;

--
-- Name: TABLE ai_quota_overrides; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.ai_quota_overrides TO authenticated;
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.ai_quota_overrides TO app_be;

--
-- Name: TABLE ai_usage_events; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.ai_usage_events TO authenticated;
GRANT SELECT,INSERT ON TABLE public.ai_usage_events TO app_be;

--
-- Name: TABLE ai_usage_daily; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.ai_usage_daily TO authenticated;

--
-- Name: TABLE ai_usage_notices; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.ai_usage_notices TO authenticated;
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.ai_usage_notices TO app_be;

--
-- Name: TABLE api_keys; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.api_keys TO app_be;

--
-- Name: COLUMN api_keys.id; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT(id) ON TABLE public.api_keys TO authenticated;

--
-- Name: COLUMN api_keys.workspace_id; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT(workspace_id) ON TABLE public.api_keys TO authenticated;

--
-- Name: COLUMN api_keys.name; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT(name) ON TABLE public.api_keys TO authenticated;

--
-- Name: COLUMN api_keys.key_prefix; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT(key_prefix) ON TABLE public.api_keys TO authenticated;

--
-- Name: COLUMN api_keys.scopes; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT(scopes) ON TABLE public.api_keys TO authenticated;

--
-- Name: COLUMN api_keys.created_at; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT(created_at) ON TABLE public.api_keys TO authenticated;

--
-- Name: COLUMN api_keys.last_used_at; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT(last_used_at) ON TABLE public.api_keys TO authenticated;

--
-- Name: COLUMN api_keys.revoked_at; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT(revoked_at) ON TABLE public.api_keys TO authenticated;

--
-- Name: TABLE api_rate_limits; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.api_rate_limits TO app_be;

--
-- Name: TABLE app_commands; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT ON TABLE public.app_commands TO authenticated;
GRANT SELECT,UPDATE ON TABLE public.app_commands TO app_be;

--
-- Name: TABLE app_errors; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT ON TABLE public.app_errors TO app_be;
GRANT SELECT ON TABLE public.app_errors TO authenticated;

--
-- Name: TABLE authority; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.authority TO authenticated;
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.authority TO app_be;

--
-- Name: TABLE authority_actions; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT ON TABLE public.authority_actions TO authenticated;
GRANT SELECT,INSERT,UPDATE ON TABLE public.authority_actions TO app_be;

--
-- Name: TABLE authority_rules; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.authority_rules TO authenticated;
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.authority_rules TO app_be;

--
-- Name: TABLE automation_commands; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT ON TABLE public.automation_commands TO authenticated;
GRANT SELECT,UPDATE ON TABLE public.automation_commands TO app_be;

--
-- Name: TABLE automation_pipelines; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.automation_pipelines TO authenticated;
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.automation_pipelines TO app_be;

--
-- Name: TABLE automation_runs; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT ON TABLE public.automation_runs TO authenticated;
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.automation_runs TO app_be;

--
-- Name: TABLE automation_templates; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT ON TABLE public.automation_templates TO authenticated;
GRANT SELECT,INSERT,UPDATE ON TABLE public.automation_templates TO app_be;

--
-- Name: TABLE billing_config; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.billing_config TO authenticated;
GRANT SELECT ON TABLE public.billing_config TO app_be;

--
-- Name: TABLE billing_events; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.billing_events TO authenticated;
GRANT SELECT,INSERT ON TABLE public.billing_events TO app_be;

--
-- Name: TABLE booking_exceptions; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.booking_exceptions TO authenticated;
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.booking_exceptions TO app_be;

--
-- Name: TABLE booking_hours; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.booking_hours TO authenticated;
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.booking_hours TO app_be;

--
-- Name: TABLE booking_rate; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.booking_rate TO app_be;

--
-- Name: TABLE booking_reminders; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.booking_reminders TO authenticated;
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.booking_reminders TO app_be;

--
-- Name: TABLE booking_resources; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.booking_resources TO authenticated;
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.booking_resources TO app_be;

--
-- Name: TABLE booking_services; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.booking_services TO authenticated;
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.booking_services TO app_be;

--
-- Name: TABLE booking_settings; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.booking_settings TO authenticated;
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.booking_settings TO app_be;

--
-- Name: TABLE booking_waitlist; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.booking_waitlist TO authenticated;
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.booking_waitlist TO app_be;

--
-- Name: TABLE bookings; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.bookings TO authenticated;
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.bookings TO app_be;

--
-- Name: TABLE brain_commands; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.brain_commands TO authenticated;
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.brain_commands TO app_be;

--
-- Name: TABLE brain_eval_cases; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.brain_eval_cases TO authenticated;
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.brain_eval_cases TO app_be;

--
-- Name: TABLE brain_extractions; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.brain_extractions TO authenticated;
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.brain_extractions TO app_be;

--
-- Name: TABLE brain_facts; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.brain_facts TO authenticated;
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.brain_facts TO app_be;

--
-- Name: TABLE brain_lessons; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.brain_lessons TO authenticated;
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.brain_lessons TO app_be;

--
-- Name: TABLE brain_source_profiles; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.brain_source_profiles TO authenticated;
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.brain_source_profiles TO app_be;

--
-- Name: TABLE channel_receipts; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.channel_receipts TO authenticated;
GRANT SELECT,INSERT ON TABLE public.channel_receipts TO app_be;

--
-- Name: TABLE connection_commands; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT ON TABLE public.connection_commands TO app_be;

--
-- Name: COLUMN connection_commands.status; Type: ACL; Schema: public; Owner: -
--

GRANT UPDATE(status) ON TABLE public.connection_commands TO app_be;

--
-- Name: COLUMN connection_commands.outcome; Type: ACL; Schema: public; Owner: -
--

GRANT UPDATE(outcome) ON TABLE public.connection_commands TO app_be;

--
-- Name: COLUMN connection_commands.finished_at; Type: ACL; Schema: public; Owner: -
--

GRANT UPDATE(finished_at) ON TABLE public.connection_commands TO app_be;

--
-- Name: TABLE connection_secrets; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.connection_secrets TO app_be;

--
-- Name: TABLE connections; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.connections TO authenticated;
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.connections TO app_be;

--
-- Name: TABLE connector_interest; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.connector_interest TO authenticated;
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.connector_interest TO app_be;

--
-- Name: TABLE content_cadence; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.content_cadence TO authenticated;
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.content_cadence TO app_be;

--
-- Name: TABLE content_items; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.content_items TO authenticated;
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.content_items TO app_be;

--
-- Name: TABLE content_pillars; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.content_pillars TO authenticated;
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.content_pillars TO app_be;

--
-- Name: TABLE content_plans; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.content_plans TO authenticated;
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.content_plans TO app_be;

--
-- Name: TABLE content_settings; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.content_settings TO authenticated;
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.content_settings TO app_be;

--
-- Name: TABLE contracts; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,UPDATE ON TABLE public.contracts TO authenticated;
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.contracts TO app_be;

--
-- Name: TABLE credit_pack_purchases; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.credit_pack_purchases TO authenticated;
GRANT SELECT ON TABLE public.credit_pack_purchases TO app_be;

--
-- Name: TABLE credit_packs; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.credit_packs TO authenticated;
GRANT SELECT ON TABLE public.credit_packs TO app_be;

--
-- Name: TABLE credit_topup_draws; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.credit_topup_draws TO authenticated;
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.credit_topup_draws TO app_be;

--
-- Name: TABLE credit_topups; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.credit_topups TO authenticated;
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.credit_topups TO app_be;

--
-- Name: TABLE data_records; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.data_records TO authenticated;
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.data_records TO app_be;

--
-- Name: TABLE data_sync_runs; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.data_sync_runs TO authenticated;
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.data_sync_runs TO app_be;

--
-- Name: TABLE decisions; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.decisions TO authenticated;
GRANT SELECT,INSERT ON TABLE public.decisions TO app_be;

--
-- Name: TABLE email_messages; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT ON TABLE public.email_messages TO authenticated;
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.email_messages TO app_be;

--
-- Name: TABLE events; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.events TO authenticated;
GRANT SELECT,INSERT ON TABLE public.events TO app_be;

--
-- Name: TABLE executions; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.executions TO authenticated;
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.executions TO app_be;

--
-- Name: TABLE hiring_apply_hits; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.hiring_apply_hits TO app_be;

--
-- Name: SEQUENCE hiring_apply_hits_id_seq; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON SEQUENCE public.hiring_apply_hits_id_seq TO authenticated;
GRANT SELECT,USAGE ON SEQUENCE public.hiring_apply_hits_id_seq TO app_be;

--
-- Name: TABLE hiring_availability; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.hiring_availability TO authenticated;
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.hiring_availability TO app_be;

--
-- Name: TABLE hiring_candidates; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.hiring_candidates TO authenticated;
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.hiring_candidates TO app_be;

--
-- Name: TABLE hiring_consents; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE public.hiring_consents TO authenticated;
GRANT SELECT,INSERT ON TABLE public.hiring_consents TO app_be;

--
-- Name: TABLE hiring_events; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE public.hiring_events TO authenticated;
GRANT SELECT,INSERT ON TABLE public.hiring_events TO app_be;

--
-- Name: TABLE hiring_interviews; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.hiring_interviews TO authenticated;
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.hiring_interviews TO app_be;

--
-- Name: TABLE hiring_jobs; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.hiring_jobs TO authenticated;
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.hiring_jobs TO app_be;

--
-- Name: TABLE hiring_offers; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.hiring_offers TO authenticated;
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.hiring_offers TO app_be;

--
-- Name: TABLE hiring_onboarding; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.hiring_onboarding TO authenticated;
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.hiring_onboarding TO app_be;

--
-- Name: TABLE hiring_retention_log; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE public.hiring_retention_log TO authenticated;
GRANT SELECT,INSERT ON TABLE public.hiring_retention_log TO app_be;

--
-- Name: TABLE hiring_settings; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.hiring_settings TO authenticated;
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.hiring_settings TO app_be;

--
-- Name: TABLE inbound_events; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.inbound_events TO authenticated;
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.inbound_events TO app_be;

--
-- Name: TABLE inventory_items; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT ON TABLE public.inventory_items TO authenticated;
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.inventory_items TO app_be;

--
-- Name: TABLE inventory_locations; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT ON TABLE public.inventory_locations TO authenticated;
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.inventory_locations TO app_be;

--
-- Name: TABLE inventory_movements; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT ON TABLE public.inventory_movements TO authenticated;
GRANT SELECT,INSERT ON TABLE public.inventory_movements TO app_be;

--
-- Name: TABLE inventory_po_lines; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT ON TABLE public.inventory_po_lines TO authenticated;
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.inventory_po_lines TO app_be;

--
-- Name: TABLE inventory_purchase_orders; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT ON TABLE public.inventory_purchase_orders TO authenticated;
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.inventory_purchase_orders TO app_be;

--
-- Name: TABLE inventory_receipts; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT ON TABLE public.inventory_receipts TO authenticated;
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.inventory_receipts TO app_be;

--
-- Name: TABLE inventory_recipe_lines; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT ON TABLE public.inventory_recipe_lines TO authenticated;
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.inventory_recipe_lines TO app_be;

--
-- Name: TABLE inventory_recipes; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT ON TABLE public.inventory_recipes TO authenticated;
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.inventory_recipes TO app_be;

--
-- Name: TABLE inventory_stock_levels; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT ON TABLE public.inventory_stock_levels TO authenticated;
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.inventory_stock_levels TO app_be;

--
-- Name: TABLE inventory_suppliers; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT ON TABLE public.inventory_suppliers TO authenticated;
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.inventory_suppliers TO app_be;

--
-- Name: TABLE invoices; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.invoices TO authenticated;
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.invoices TO app_be;

--
-- Name: TABLE job_outbox; Type: ACL; Schema: public; Owner: -
--

--
-- Name: TABLE job_slots; Type: ACL; Schema: public; Owner: -
--

--
-- Name: TABLE jobs; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,UPDATE ON TABLE public.jobs TO app_be;

--
-- Name: TABLE knowledge_chunks; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.knowledge_chunks TO authenticated;
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.knowledge_chunks TO app_be;

--
-- Name: TABLE knowledge_gaps; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.knowledge_gaps TO authenticated;
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.knowledge_gaps TO app_be;

--
-- Name: TABLE knowledge_sources; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.knowledge_sources TO authenticated;
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.knowledge_sources TO app_be;

--
-- Name: TABLE knowledge_suggestion_state; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.knowledge_suggestion_state TO authenticated;
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.knowledge_suggestion_state TO app_be;

--
-- Name: TABLE lead_actions; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.lead_actions TO app_be;

--
-- Name: TABLE lead_flows; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.lead_flows TO authenticated;
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.lead_flows TO app_be;

--
-- Name: TABLE leads; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.leads TO authenticated;
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.leads TO app_be;

--
-- Name: TABLE loyalty_customers; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT ON TABLE public.loyalty_customers TO authenticated;
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.loyalty_customers TO app_be;

--
-- Name: COLUMN loyalty_customers.name; Type: ACL; Schema: public; Owner: -
--

GRANT UPDATE(name) ON TABLE public.loyalty_customers TO authenticated;

--
-- Name: COLUMN loyalty_customers.phone; Type: ACL; Schema: public; Owner: -
--

GRANT UPDATE(phone) ON TABLE public.loyalty_customers TO authenticated;

--
-- Name: COLUMN loyalty_customers.email; Type: ACL; Schema: public; Owner: -
--

GRANT UPDATE(email) ON TABLE public.loyalty_customers TO authenticated;

--
-- Name: COLUMN loyalty_customers.birthday; Type: ACL; Schema: public; Owner: -
--

GRANT UPDATE(birthday) ON TABLE public.loyalty_customers TO authenticated;

--
-- Name: COLUMN loyalty_customers.note; Type: ACL; Schema: public; Owner: -
--

GRANT UPDATE(note) ON TABLE public.loyalty_customers TO authenticated;

--
-- Name: COLUMN loyalty_customers.updated_at; Type: ACL; Schema: public; Owner: -
--

GRANT UPDATE(updated_at) ON TABLE public.loyalty_customers TO authenticated;

--
-- Name: TABLE loyalty_ledger; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT ON TABLE public.loyalty_ledger TO authenticated;
GRANT SELECT,INSERT ON TABLE public.loyalty_ledger TO app_be;

--
-- Name: TABLE loyalty_balances; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT ON TABLE public.loyalty_balances TO authenticated;

--
-- Name: TABLE loyalty_campaigns; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT ON TABLE public.loyalty_campaigns TO authenticated;
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.loyalty_campaigns TO app_be;

--
-- Name: TABLE loyalty_customer_links; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT ON TABLE public.loyalty_customer_links TO authenticated;
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.loyalty_customer_links TO app_be;

--
-- Name: TABLE loyalty_otps; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.loyalty_otps TO app_be;

--
-- Name: TABLE loyalty_programs; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,UPDATE ON TABLE public.loyalty_programs TO authenticated;
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.loyalty_programs TO app_be;

--
-- Name: TABLE loyalty_rewards; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.loyalty_rewards TO authenticated;
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.loyalty_rewards TO app_be;

--
-- Name: TABLE loyalty_sends; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT ON TABLE public.loyalty_sends TO authenticated;
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.loyalty_sends TO app_be;

--
-- Name: TABLE messages; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.messages TO authenticated;
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.messages TO app_be;

--
-- Name: TABLE meta_comments; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.meta_comments TO authenticated;
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.meta_comments TO app_be;

--
-- Name: TABLE meta_inbox; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,UPDATE ON TABLE public.meta_inbox TO app_be;

--
-- Name: TABLE meta_threads; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.meta_threads TO authenticated;
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.meta_threads TO app_be;

--
-- Name: TABLE module_context_notes; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.module_context_notes TO authenticated;
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.module_context_notes TO app_be;

--
-- Name: TABLE module_context_versions; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.module_context_versions TO authenticated;
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.module_context_versions TO app_be;

--
-- Name: TABLE module_installations; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.module_installations TO authenticated;
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.module_installations TO app_be;

--
-- Name: TABLE module_setup_messages; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.module_setup_messages TO authenticated;
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.module_setup_messages TO app_be;

--
-- Name: TABLE module_setup_sessions; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.module_setup_sessions TO authenticated;
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.module_setup_sessions TO app_be;

--
-- Name: TABLE module_setup_writes; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.module_setup_writes TO authenticated;
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.module_setup_writes TO app_be;

--
-- Name: TABLE modules; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT ON TABLE public.modules TO authenticated;
GRANT SELECT,INSERT,UPDATE ON TABLE public.modules TO app_be;

--
-- Name: TABLE n8n_pipelines; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT ON TABLE public.n8n_pipelines TO authenticated;
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.n8n_pipelines TO app_be;

--
-- Name: TABLE n8n_platform_config; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,UPDATE ON TABLE public.n8n_platform_config TO app_be;

--
-- Name: TABLE n8n_runs; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.n8n_runs TO app_be;

--
-- Name: COLUMN n8n_runs.id; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT(id) ON TABLE public.n8n_runs TO authenticated;

--
-- Name: COLUMN n8n_runs.workspace_id; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT(workspace_id) ON TABLE public.n8n_runs TO authenticated;

--
-- Name: COLUMN n8n_runs.template_key; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT(template_key) ON TABLE public.n8n_runs TO authenticated;

--
-- Name: COLUMN n8n_runs.status; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT(status) ON TABLE public.n8n_runs TO authenticated;

--
-- Name: COLUMN n8n_runs.summary; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT(summary) ON TABLE public.n8n_runs TO authenticated;

--
-- Name: COLUMN n8n_runs.created_at; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT(created_at) ON TABLE public.n8n_runs TO authenticated;

--
-- Name: COLUMN n8n_runs.finished_at; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT(finished_at) ON TABLE public.n8n_runs TO authenticated;

--
-- Name: TABLE nivo_knowledge; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.nivo_knowledge TO authenticated;
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.nivo_knowledge TO app_be;

--
-- Name: TABLE office_command_candidates; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.office_command_candidates TO authenticated;
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.office_command_candidates TO app_be;

--
-- Name: TABLE openclaw_agent_sync; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT ON TABLE public.openclaw_agent_sync TO authenticated;
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.openclaw_agent_sync TO app_be;

--
-- Name: TABLE orders; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.orders TO authenticated;
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.orders TO app_be;

--
-- Name: TABLE payment_order_requests; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT ON TABLE public.payment_order_requests TO authenticated;
GRANT SELECT,INSERT,UPDATE ON TABLE public.payment_order_requests TO app_be;

--
-- Name: TABLE payment_orders; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.payment_orders TO authenticated;
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.payment_orders TO app_be;

--
-- Name: TABLE plan_usage_tiers; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.plan_usage_tiers TO authenticated;
GRANT SELECT ON TABLE public.plan_usage_tiers TO app_be;

--
-- Name: TABLE plans; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.plans TO authenticated;
GRANT SELECT ON TABLE public.plans TO app_be;

--
-- Name: TABLE platform_admins; Type: ACL; Schema: public; Owner: -
--

--
-- Name: TABLE platform_audit; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT ON TABLE public.platform_audit TO app_be;
GRANT SELECT ON TABLE public.platform_audit TO authenticated;

--
-- Name: TABLE platform_flags; Type: ACL; Schema: public; Owner: -
--

--
-- Name: TABLE public_api; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,UPDATE ON TABLE public.public_api TO app_be;

--
-- Name: TABLE queue; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,UPDATE ON TABLE public.queue TO app_be;

--
-- Name: TABLE sepay_transactions; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.sepay_transactions TO authenticated;
GRANT SELECT,INSERT,UPDATE ON TABLE public.sepay_transactions TO app_be;

--
-- Name: TABLE shifts_attendance; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.shifts_attendance TO authenticated;
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.shifts_attendance TO app_be;

--
-- Name: TABLE shifts_availability; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.shifts_availability TO authenticated;
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.shifts_availability TO app_be;

--
-- Name: TABLE shifts_coverage; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.shifts_coverage TO authenticated;
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.shifts_coverage TO app_be;

--
-- Name: TABLE shifts_leave_requests; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.shifts_leave_requests TO authenticated;
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.shifts_leave_requests TO app_be;

--
-- Name: TABLE shifts_notifications; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT ON TABLE public.shifts_notifications TO authenticated;
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.shifts_notifications TO app_be;

--
-- Name: TABLE shifts_positions; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.shifts_positions TO authenticated;
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.shifts_positions TO app_be;

--
-- Name: TABLE shifts_schedules; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.shifts_schedules TO authenticated;
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.shifts_schedules TO app_be;

--
-- Name: TABLE shifts_settings; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.shifts_settings TO authenticated;
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.shifts_settings TO app_be;

--
-- Name: TABLE shifts_shifts; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.shifts_shifts TO authenticated;
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.shifts_shifts TO app_be;

--
-- Name: TABLE shifts_staff; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.shifts_staff TO authenticated;
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.shifts_staff TO app_be;

--
-- Name: TABLE shifts_staff_pay; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.shifts_staff_pay TO authenticated;
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.shifts_staff_pay TO app_be;

--
-- Name: TABLE shifts_swap_requests; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.shifts_swap_requests TO authenticated;
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.shifts_swap_requests TO app_be;

--
-- Name: TABLE staff; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.staff TO authenticated;
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.staff TO app_be;

--
-- Name: TABLE telegram_inbox; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,UPDATE ON TABLE public.telegram_inbox TO app_be;

--
-- Name: TABLE transactions; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.transactions TO authenticated;
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.transactions TO app_be;

--
-- Name: TABLE video_brand_kits; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.video_brand_kits TO authenticated;
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.video_brand_kits TO app_be;

--
-- Name: TABLE video_project_versions; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.video_project_versions TO authenticated;
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.video_project_versions TO app_be;

--
-- Name: TABLE video_projects; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.video_projects TO authenticated;
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.video_projects TO app_be;

--
-- Name: TABLE video_renders; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT ON TABLE public.video_renders TO authenticated;
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.video_renders TO app_be;

--
-- Name: TABLE work_items; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.work_items TO authenticated;
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.work_items TO app_be;

--
-- Name: TABLE workspace_invites; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.workspace_invites TO authenticated;
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.workspace_invites TO app_be;

--
-- Name: TABLE workspace_members; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.workspace_members TO authenticated;
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.workspace_members TO app_be;

--
-- Name: TABLE workspaces; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.workspaces TO authenticated;
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.workspaces TO app_be;

--
-- Name: TABLE zalo_inbox; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,UPDATE ON TABLE public.zalo_inbox TO app_be;

--
-- Name: TABLE zalo_wizard_drafts; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,DELETE ON TABLE public.zalo_wizard_drafts TO app_be;

--
-- Name: DEFAULT PRIVILEGES FOR SEQUENCES; Type: DEFAULT ACL; Schema: public; Owner: -
--

--
-- Name: DEFAULT PRIVILEGES FOR SEQUENCES; Type: DEFAULT ACL; Schema: public; Owner: -
--

--
-- Name: DEFAULT PRIVILEGES FOR FUNCTIONS; Type: DEFAULT ACL; Schema: public; Owner: -
--

--
-- Name: DEFAULT PRIVILEGES FOR FUNCTIONS; Type: DEFAULT ACL; Schema: public; Owner: -
--

--
-- Name: DEFAULT PRIVILEGES FOR TABLES; Type: DEFAULT ACL; Schema: public; Owner: -
--

--
-- Name: DEFAULT PRIVILEGES FOR TABLES; Type: DEFAULT ACL; Schema: public; Owner: -
--

--
-- PostgreSQL database dump complete
--

SET search_path = public, extensions;

-- pgmq queues and what the back end may do with them.
SELECT pgmq.create('agents');
SELECT pgmq.create('automation');
SELECT pgmq.create('bank_credit_received');
SELECT pgmq.create('booking_status');
SELECT pgmq.create('chat_turn');
SELECT pgmq.create('connection_commands');
SELECT pgmq.create('connection_health');
SELECT pgmq.create('content_tick');
SELECT pgmq.create('data_sync');
SELECT pgmq.create('decisions');
SELECT pgmq.create('hiring_tick');
SELECT pgmq.create('inventory_order');
SELECT pgmq.create('inventory_replenish');
SELECT pgmq.create('invite_command');
SELECT pgmq.create('knowledge');
SELECT pgmq.create('lead_actions');
SELECT pgmq.create('lead_gen');
SELECT pgmq.create('meta_inbound');
SELECT pgmq.create('n8n');
SELECT pgmq.create('payment_order_requested');
SELECT pgmq.create('public_api');
SELECT pgmq.create('render_request');
SELECT pgmq.create('shifts_alerts');
SELECT pgmq.create('video_render');
SELECT pgmq.create('zalo_authorization');
SELECT pgmq.create('zalo_refresh');
SELECT pgmq.create('zalo_wizard');
grant DELETE, INSERT, SELECT, UPDATE on table pgmq.a_connection_commands to app_be;
grant DELETE, INSERT, SELECT, UPDATE on table pgmq.a_lead_gen to app_be;
grant DELETE, INSERT, SELECT, UPDATE on table pgmq.a_meta_inbound to app_be;
grant DELETE, INSERT, SELECT, UPDATE on table pgmq.q_bank_credit_received to app_be;
grant DELETE, INSERT, SELECT, UPDATE on table pgmq.q_connection_commands to app_be;
grant DELETE, INSERT, SELECT, UPDATE on table pgmq.q_lead_gen to app_be;
grant DELETE, INSERT, SELECT, UPDATE on table pgmq.q_meta_inbound to app_be;
grant DELETE, INSERT, SELECT, UPDATE on table pgmq.q_payment_order_requested to app_be;
grant INSERT, SELECT on table pgmq.a_bank_credit_received to app_be;
grant INSERT, SELECT on table pgmq.a_payment_order_requested to app_be;

-- Realtime.
alter publication supabase_realtime add table public.agent_conversations;
alter publication supabase_realtime add table public.agent_messages;
alter publication supabase_realtime add table public.brain_extractions;
alter publication supabase_realtime add table public.brain_facts;
alter publication supabase_realtime add table public.brain_lessons;
alter publication supabase_realtime add table public.knowledge_gaps;
alter publication supabase_realtime add table public.knowledge_sources;
alter publication supabase_realtime add table public.messages;
alter publication supabase_realtime add table public.module_setup_messages;
alter publication supabase_realtime add table public.office_command_candidates;
alter publication supabase_realtime add table public.payment_orders;
alter publication supabase_realtime add table public.work_items;

-- Scheduled jobs: the queue ticks are declared by 20261026000300_job-ticks.sql (a cron command is one pgmq.send; the pruning and reaping jobs of the old
-- baseline run as queue jobs of the back end, not as cron SQL).

-- Storage buckets (private, size and type bounded) and their object policies.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types) VALUES ('hiring', 'hiring', false, 5242880, ARRAY['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'image/jpeg', 'image/png']) ON CONFLICT (id) DO NOTHING;
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types) VALUES ('knowledge-uploads', 'knowledge-uploads', false, 12582912, ARRAY['text/plain', 'text/markdown', 'text/x-markdown', 'text/csv', 'application/csv', 'application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'application/vnd.openxmlformats-officedocument.presentationml.presentation', 'application/zip', 'application/x-zip-compressed', 'application/octet-stream']) ON CONFLICT (id) DO NOTHING;
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types) VALUES ('media', 'media', false, 52428800, ARRAY['video/mp4', 'audio/mpeg', 'image/png', 'image/webp', 'image/jpeg', 'video/webm', 'video/quicktime']) ON CONFLICT (id) DO NOTHING;
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types) VALUES ('videos', 'videos', false, 52428800, ARRAY['video/mp4', 'image/jpeg']) ON CONFLICT (id) DO NOTHING;
CREATE POLICY objects_hiring_cv_manager_delete ON storage.objects AS PERMISSIVE FOR DELETE TO authenticated USING (((bucket_id = 'hiring'::text) AND public.storage_ws_manager(name)));
CREATE POLICY objects_hiring_cv_manager_select ON storage.objects AS PERMISSIVE FOR SELECT TO authenticated USING (((bucket_id = 'hiring'::text) AND public.storage_ws_manager(name)));
CREATE POLICY objects_knowledge_uploads_manager_insert ON storage.objects AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK (((bucket_id = 'knowledge-uploads'::text) AND public.storage_ws_manager(name)));
CREATE POLICY objects_media_manager_delete ON storage.objects AS PERMISSIVE FOR DELETE TO authenticated USING (((bucket_id = 'media'::text) AND public.storage_ws_manager(name)));
CREATE POLICY objects_media_member_insert ON storage.objects AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK (((bucket_id = 'media'::text) AND public.storage_ws_member(name)));
CREATE POLICY objects_media_member_select ON storage.objects AS PERMISSIVE FOR SELECT TO authenticated USING (((bucket_id = 'media'::text) AND public.storage_ws_member(name)));
CREATE POLICY objects_videos_manager_delete ON storage.objects AS PERMISSIVE FOR DELETE TO authenticated USING (((bucket_id = 'videos'::text) AND public.storage_ws_manager(name)));
CREATE POLICY objects_videos_member_select ON storage.objects AS PERMISSIVE FOR SELECT TO authenticated USING (((bucket_id = 'videos'::text) AND public.storage_ws_member(name)));

-- Reference data the product ships with.
--
-- PostgreSQL database dump
--

-- Dumped from database version 17.11
-- Dumped by pg_dump version 17.11

--
-- Data for Name: plans; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO public.plans (code, name_vi, name_en, price_vnd, period, seats, features, sort, active, ai_messages_per_month, ai_tokens_per_month, ai_credits_per_month, is_custom, credits_rollover, price_annual_vnd, annual_discount_pct, promo_price_vnd, promo_months, storage_gb, listed, individual, per_seat) VALUES
	('start', 'Start', 'Start', 490000, 'month', 1, '{"en": ["Connectors", "Workspace agents for custom workflows", "Extended memory", "Always-on automation agents", "Finance and data tools"], "vi": ["Kết nối (connectors)", "Workspace agent cho quy trình tùy chỉnh", "Bộ nhớ mở rộng", "Agent tự động chạy liên tục", "Công cụ tài chính và dữ liệu"]}', 1, true, NULL, NULL, 10000, false, false, 4998000, 15, 245000, 3, 10, true, true, false),
	('pro', 'Pro', 'Pro', 990000, 'month', 1, '{"en": ["Everything in Start", "Higher rate limits", "Deep research (set your own usage)", "Maximum memory"], "vi": ["Mọi thứ trong Start", "Giới hạn sử dụng cao hơn", "Nghiên cứu chuyên sâu (tự đặt mức dùng)", "Bộ nhớ tối đa"]}', 2, true, NULL, NULL, 20000, false, true, 10098000, 15, 792000, 3, 20, true, true, false),
	('max', 'Max', 'Max', 4990000, 'month', 1, '{"en": ["Everything in Pro", "Much higher usage", "1080p video", "Priority access", "End-to-end automation agents", "Early access to new features", "Deep research at scale"], "vi": ["Mọi thứ trong Pro", "Mức sử dụng cao hơn nhiều", "Video 1080p", "Truy cập ưu tiên", "Agent tự động từ đầu đến cuối", "Truy cập sớm tính năng mới", "Nghiên cứu chuyên sâu quy mô lớn"]}', 3, true, NULL, NULL, 100000, false, true, 50898000, 15, NULL, NULL, 100, true, true, false),
	('growth', 'Tăng trưởng', 'Growth', 2490000, 'month', 10, '{"en": ["Up to 10 members", "Chatbot + sales AI + accounting AI", "Owner, manager and staff roles"], "vi": ["Tối đa 10 thành viên", "Chatbot + AI bán hàng + AI kế toán", "Phân quyền chủ sở hữu, quản lý, nhân viên"]}', 2, false, 6000, 12000000, NULL, false, false, NULL, NULL, NULL, NULL, NULL, true, false, false),
	('pro_v1', 'Pro', 'Pro', 1499000, 'month', 10, '{"en": ["6,918 AI credits a month (20% bonus)", "Unused credits roll over to next month", "Up to 10 members", "Chatbot, sales AI and accounting AI"], "vi": ["6.918 credit AI mỗi tháng (tặng thêm 20%)", "Credit chưa dùng được cộng sang tháng sau", "Tối đa 10 thành viên", "Chatbot, AI bán hàng và AI kế toán"]}', 102, true, NULL, NULL, 6918, false, true, NULL, NULL, NULL, NULL, NULL, false, false, false),
	('max_v1', 'Max', 'Max', 4999000, 'month', 30, '{"en": ["24,034 AI credits a month (25% bonus)", "Unused credits roll over to next month", "Every NIVO module"], "vi": ["24.034 credit AI mỗi tháng (tặng thêm 25%)", "Credit chưa dùng được cộng sang tháng sau", "Mọi module của NIVO"]}', 103, true, NULL, NULL, 24034, false, true, NULL, NULL, NULL, NULL, NULL, false, false, false),
	('starter', 'Starter', 'Starter', 299000, 'month', 3, '{"en": ["1,150 AI credits a month", "Up to 3 members", "Chatbot and sales AI"], "vi": ["1.150 credit AI mỗi tháng", "Tối đa 3 thành viên", "Chatbot và AI bán hàng"]}', 101, true, NULL, NULL, 1150, false, false, NULL, NULL, NULL, NULL, NULL, false, false, false),
	('enterprise', 'Enterprise', 'Enterprise', 0, 'month', 1000, '{"en": ["Seats and usage by contract", "Spend limits per user and organisation", "Usage analytics and spend control", "Data-retention controls", "Dedicated onboarding"], "vi": ["Số ghế và mức dùng theo hợp đồng", "Giới hạn chi tiêu theo người dùng và tổ chức", "Phân tích sử dụng và kiểm soát chi tiêu", "Kiểm soát lưu giữ dữ liệu", "Hỗ trợ triển khai riêng"]}', 5, true, NULL, NULL, 100000, true, false, NULL, NULL, NULL, NULL, NULL, true, false, false),
	('team', 'Team', 'Team', 400000, 'month', 1000, '{"en": ["Seat management and RBAC", "Custom data storage", "Central billing and admin", "Mixed seat types in one team"], "vi": ["Quản lý ghế và phân quyền (RBAC)", "Lưu trữ dữ liệu tùy chỉnh", "Thanh toán và quản trị tập trung", "Nhiều loại ghế trong cùng một nhóm"]}', 4, true, NULL, NULL, 8000, false, false, NULL, NULL, NULL, NULL, NULL, true, false, true);

--
-- Data for Name: workspaces; Type: TABLE DATA; Schema: public; Owner: postgres
--

--
-- Data for Name: accounting_adjustments; Type: TABLE DATA; Schema: public; Owner: postgres
--

--
-- Data for Name: modules; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO public.modules (key, sort_order, status, category, audience, knowledge_folder, workbench, default_operating_mode, definition, updated_at, multi_instance) VALUES
	('sales', 20, 'stable', 'sales_customer', 'internal', 'sales', 'sales', 'assist', '{}', '2026-10-13 22:00:10.369993+00', false),
	('accounting', 30, 'stable', 'finance', 'internal', 'accounting', 'accounting', 'assist', '{}', '2026-10-13 22:00:10.369993+00', false),
	('shifts', 40, 'early', 'operations', 'internal', 'shifts', NULL, 'assist', '{}', '2026-10-13 22:00:10.369993+00', false),
	('inventory', 60, 'early', 'operations', 'internal', 'inventory', NULL, 'assist', '{}', '2026-10-13 22:00:10.369993+00', false),
	('loyalty', 70, 'early', 'sales_customer', 'customer', 'loyalty', NULL, 'assist', '{}', '2026-10-13 22:00:10.369993+00', false),
	('video', 80, 'early', 'marketing', 'internal', 'video', NULL, 'assist', '{}', '2026-10-13 22:00:10.369993+00', false),
	('content', 90, 'early', 'marketing', 'internal', 'content', NULL, 'assist', '{}', '2026-10-13 22:00:10.369993+00', false),
	('hiring', 100, 'early', 'hr', 'internal', 'hiring', NULL, 'assist', '{}', '2026-10-13 22:00:10.369993+00', false),
	('chatbot', 10, 'stable', 'sales_customer', 'customer', 'chatbot', 'chatbot', 'assist', '{}', '2026-10-13 22:00:10.369993+00', true),
	('booking', 50, 'early', 'operations', 'customer', 'booking', NULL, 'assist', '{}', '2026-10-13 22:00:10.369993+00', true),
	('lead_gen', 15, 'early', 'sales_customer', 'customer', 'lead_gen', 'lead_gen', 'assist', '{}', '2026-10-13 22:00:10.710036+00', true);

--
-- Data for Name: agents; Type: TABLE DATA; Schema: public; Owner: postgres
--

--
-- Data for Name: connections; Type: TABLE DATA; Schema: public; Owner: postgres
--

--
-- Data for Name: agent_access_log; Type: TABLE DATA; Schema: public; Owner: postgres
--

--
-- Data for Name: agent_connections; Type: TABLE DATA; Schema: public; Owner: postgres
--

--
-- Data for Name: module_installations; Type: TABLE DATA; Schema: public; Owner: postgres
--

--
-- Data for Name: agent_conversations; Type: TABLE DATA; Schema: public; Owner: postgres
--

--
-- Data for Name: agent_messages; Type: TABLE DATA; Schema: public; Owner: postgres
--

--
-- Data for Name: ai_generations; Type: TABLE DATA; Schema: public; Owner: postgres
--

--
-- Data for Name: ai_quota_overrides; Type: TABLE DATA; Schema: public; Owner: postgres
--

--
-- Data for Name: ai_usage_events; Type: TABLE DATA; Schema: public; Owner: postgres
--

--
-- Data for Name: ai_usage_notices; Type: TABLE DATA; Schema: public; Owner: postgres
--

--
-- Data for Name: api_keys; Type: TABLE DATA; Schema: public; Owner: postgres
--

--
-- Data for Name: api_rate_limits; Type: TABLE DATA; Schema: public; Owner: postgres
--

--
-- Data for Name: app_commands; Type: TABLE DATA; Schema: public; Owner: postgres
--

--
-- Data for Name: app_errors; Type: TABLE DATA; Schema: public; Owner: postgres
--

--
-- Data for Name: authority; Type: TABLE DATA; Schema: public; Owner: postgres
--

--
-- Data for Name: authority_actions; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO public.authority_actions (action, module_key, sort_order, default_mode, default_limit_vnd, default_required_fields, amount_limit, max_mode, label) VALUES
	('reply_customer', 'chatbot', 0, 'auto', NULL, '{}', false, NULL, '{"en": "Reply to customer", "vi": "Trả lời khách"}'),
	('handoff_lead', 'chatbot', 1, 'auto', NULL, '{contact_name,need}', false, NULL, '{"en": "Hand off lead", "vi": "Chuyển lead"}'),
	('classify_lead', 'sales', 0, 'auto', NULL, '{}', false, NULL, '{"en": "Classify lead", "vi": "Phân loại"}'),
	('send_follow_up', 'sales', 1, 'ask', NULL, '{contact}', false, NULL, '{"en": "Send follow-up", "vi": "Gửi theo dõi"}'),
	('send_quote', 'sales', 2, 'ask', NULL, '{amount_vnd}', true, NULL, '{"en": "Send quote", "vi": "Gửi báo giá"}'),
	('confirm_order', 'sales', 3, 'auto', 20000000, '{customer,items,amount_vnd}', true, NULL, '{"en": "Confirm order", "vi": "Xác nhận đơn hàng"}'),
	('send_care', 'sales', 4, 'auto', NULL, '{}', false, NULL, '{"en": "Send customer care", "vi": "Gửi chăm sóc"}'),
	('issue_invoice', 'accounting', 0, 'auto', 20000000, '{customer,amount_vnd}', true, NULL, '{"en": "Issue invoice", "vi": "Xuất hóa đơn"}'),
	('reconcile_payment', 'accounting', 1, 'auto', 50000000, '{amount_vnd}', true, NULL, '{"en": "Reconcile payment", "vi": "Đối soát thanh toán"}'),
	('send_email', 'accounting', 2, 'ask', NULL, '{contact}', false, NULL, '{"en": "Send email to a customer", "vi": "Gửi email cho khách"}'),
	('publish_schedule', 'shifts', 0, 'ask', NULL, '{}', false, NULL, '{"en": "Publish schedule", "vi": "Đăng lịch ca"}'),
	('approve_swap', 'shifts', 1, 'auto', NULL, '{}', false, NULL, '{"en": "Approve shift swap", "vi": "Duyệt đổi ca"}'),
	('approve_leave', 'shifts', 2, 'ask', NULL, '{}', false, NULL, '{"en": "Approve leave", "vi": "Duyệt xin nghỉ"}'),
	('remind_shift', 'shifts', 3, 'auto', NULL, '{}', false, NULL, '{"en": "Remind staff of a shift", "vi": "Nhắc ca làm"}'),
	('confirm_booking', 'booking', 0, 'auto', NULL, '{contact}', false, NULL, '{"en": "Confirm booking", "vi": "Xác nhận lịch hẹn"}'),
	('reschedule', 'booking', 1, 'auto', NULL, '{}', false, NULL, '{"en": "Reschedule", "vi": "Đổi lịch hẹn"}'),
	('cancel_with_fee', 'booking', 2, 'ask', NULL, '{}', true, NULL, '{"en": "Cancel with a fee", "vi": "Hủy lịch có thu phí"}'),
	('remind_booking', 'booking', 3, 'auto', NULL, '{}', false, NULL, '{"en": "Remind about a booking", "vi": "Nhắc lịch hẹn"}'),
	('draft_purchase_order', 'inventory', 0, 'auto', NULL, '{}', false, NULL, '{"en": "Draft a purchase order", "vi": "Soạn đơn nhập hàng"}'),
	('send_purchase_order', 'inventory', 1, 'ask', NULL, '{amount_vnd}', true, NULL, '{"en": "Send a purchase order", "vi": "Gửi đơn nhập cho nhà cung cấp"}'),
	('adjust_stock', 'inventory', 2, 'ask', NULL, '{}', false, NULL, '{"en": "Adjust stock", "vi": "Chỉnh số tồn kho"}'),
	('award_points', 'loyalty', 0, 'auto', NULL, '{}', false, NULL, '{"en": "Award points", "vi": "Cộng điểm"}'),
	('redeem_reward', 'loyalty', 1, 'auto', 500000, '{}', true, NULL, '{"en": "Redeem a reward", "vi": "Đổi quà"}'),
	('send_promo', 'loyalty', 2, 'ask', NULL, '{contact}', false, NULL, '{"en": "Send a promotion", "vi": "Gửi khuyến mãi"}'),
	('render_draft', 'video', 0, 'auto', NULL, '{}', false, NULL, '{"en": "Render a draft video", "vi": "Dựng bản nháp video"}'),
	('publish_video', 'video', 1, 'ask', NULL, '{}', false, 'ask', '{"en": "Publish a video", "vi": "Đăng video"}'),
	('draft_post', 'content', 0, 'auto', NULL, '{}', false, NULL, '{"en": "Draft a post", "vi": "Soạn bài đăng"}'),
	('publish_post', 'content', 1, 'ask', NULL, '{}', false, 'ask', '{"en": "Publish a post", "vi": "Đăng bài"}'),
	('screen_candidate', 'hiring', 0, 'auto', NULL, '{}', false, NULL, '{"en": "Screen a candidate", "vi": "Sàng lọc ứng viên"}'),
	('schedule_interview', 'hiring', 1, 'auto', NULL, '{contact}', false, NULL, '{"en": "Schedule an interview", "vi": "Xếp lịch phỏng vấn"}'),
	('send_offer', 'hiring', 2, 'ask', NULL, '{contact}', false, NULL, '{"en": "Send a job offer", "vi": "Gửi thư mời nhận việc"}'),
	('capture_lead', 'lead_gen', 0, 'auto', NULL, '{}', false, NULL, '{"en": "Capture lead", "vi": "Ghi nhận khách tiềm năng"}'),
	('greet_prospect', 'lead_gen', 1, 'auto', NULL, '{}', false, NULL, '{"en": "Greet prospect", "vi": "Chào khách"}'),
	('ask_qualifying', 'lead_gen', 2, 'auto', NULL, '{}', false, NULL, '{"en": "Ask qualifying questions", "vi": "Hỏi câu lọc khách"}'),
	('score_lead', 'lead_gen', 3, 'auto', NULL, '{}', false, NULL, '{"en": "Score lead", "vi": "Chấm điểm khách"}'),
	('reply_comment_public', 'lead_gen', 4, 'auto', NULL, '{}', false, NULL, '{"en": "Reply to a public comment", "vi": "Trả lời bình luận công khai"}'),
	('private_reply_comment', 'lead_gen', 5, 'auto', NULL, '{}', false, NULL, '{"en": "Private reply to a comment", "vi": "Nhắn riêng cho người bình luận"}'),
	('send_lead_offer', 'lead_gen', 6, 'ask', NULL, '{contact}', false, NULL, '{"en": "Send an offer to a lead", "vi": "Gửi ưu đãi cho khách"}'),
	('quote_custom_price', 'lead_gen', 7, 'ask', NULL, '{amount_vnd}', true, NULL, '{"en": "Quote a custom price", "vi": "Báo giá riêng"}'),
	('handoff_to_sales', 'lead_gen', 8, 'auto', NULL, '{contact,need}', false, NULL, '{"en": "Hand a hot lead to Sales", "vi": "Chuyển khách nóng cho Sales"}'),
	('message_with_human_agent_tag', 'lead_gen', 9, 'ask', NULL, '{contact}', false, 'ask', '{"en": "Message with the human agent tag", "vi": "Nhắn bằng thẻ nhân viên (ngoài 24 giờ)"}'),
	('message_outside_window', 'lead_gen', 10, 'never', NULL, '{}', false, 'never', '{"en": "Message outside the 24-hour window", "vi": "Nhắn ngoài khung 24 giờ"}'),
	('hide_or_delete_comment', 'lead_gen', 11, 'never', NULL, '{}', false, 'never', '{"en": "Hide or delete a customer comment", "vi": "Ẩn hoặc xóa bình luận của khách"}'),
	('follow_up_lead', 'lead_gen', 12, 'auto', NULL, '{}', false, NULL, '{"en": "Follow up a warm lead", "vi": "Nhắn lại khách ấm"}'),
	('close_lead', 'lead_gen', 13, 'auto', NULL, '{}', false, NULL, '{"en": "Politely close a cold lead", "vi": "Khép lại với khách lạnh"}');

--
-- Data for Name: authority_rules; Type: TABLE DATA; Schema: public; Owner: postgres
--

--
-- Data for Name: automation_commands; Type: TABLE DATA; Schema: public; Owner: postgres
--

--
-- Data for Name: automation_pipelines; Type: TABLE DATA; Schema: public; Owner: postgres
--

--
-- Data for Name: automation_runs; Type: TABLE DATA; Schema: public; Owner: postgres
--

--
-- Data for Name: automation_templates; Type: TABLE DATA; Schema: public; Owner: postgres
--

--
-- Data for Name: billing_config; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO public.billing_config (key, value, note) VALUES
	('credit_usd_value', 0.00113, 'USD of model token cost that one credit is worth (= 1/885). THE definition of a credit: credits = ceil(cost_usd / this) per call.'),
	('exchange_rate_vnd_per_usd', 26000, 'Input of credit_usd_value (documentation): VND per USD.'),
	('target_margin', 0.40, 'Input of credit_usd_value (documentation): gross margin kept on token cost at the lowest revenue per included credit.'),
	('min_revenue_vnd_per_credit', 49, 'Input of credit_usd_value (documentation): the lowest plan price / included credits, Start 490,000 / 10,000. Not shown to customers.');

--
-- Data for Name: billing_events; Type: TABLE DATA; Schema: public; Owner: postgres
--

--
-- Data for Name: staff; Type: TABLE DATA; Schema: public; Owner: postgres
--

--
-- Data for Name: booking_resources; Type: TABLE DATA; Schema: public; Owner: postgres
--

--
-- Data for Name: booking_exceptions; Type: TABLE DATA; Schema: public; Owner: postgres
--

--
-- Data for Name: booking_hours; Type: TABLE DATA; Schema: public; Owner: postgres
--

--
-- Data for Name: booking_rate; Type: TABLE DATA; Schema: public; Owner: postgres
--

--
-- Data for Name: booking_services; Type: TABLE DATA; Schema: public; Owner: postgres
--

--
-- Data for Name: leads; Type: TABLE DATA; Schema: public; Owner: postgres
--

--
-- Data for Name: responsibilities; Type: TABLE DATA; Schema: public; Owner: postgres
--

--
-- Data for Name: executions; Type: TABLE DATA; Schema: public; Owner: postgres
--

--
-- Data for Name: inbound_events; Type: TABLE DATA; Schema: public; Owner: postgres
--

--
-- Data for Name: orders; Type: TABLE DATA; Schema: public; Owner: postgres
--

--
-- Data for Name: work_items; Type: TABLE DATA; Schema: public; Owner: postgres
--

--
-- Data for Name: bookings; Type: TABLE DATA; Schema: public; Owner: postgres
--

--
-- Data for Name: booking_reminders; Type: TABLE DATA; Schema: public; Owner: postgres
--

--
-- Data for Name: booking_settings; Type: TABLE DATA; Schema: public; Owner: postgres
--

--
-- Data for Name: booking_waitlist; Type: TABLE DATA; Schema: public; Owner: postgres
--

--
-- Data for Name: brain_commands; Type: TABLE DATA; Schema: public; Owner: postgres
--

--
-- Data for Name: brain_eval_cases; Type: TABLE DATA; Schema: public; Owner: postgres
--

--
-- Data for Name: knowledge_sources; Type: TABLE DATA; Schema: public; Owner: postgres
--

--
-- Data for Name: brain_extractions; Type: TABLE DATA; Schema: public; Owner: postgres
--

--
-- Data for Name: brain_facts; Type: TABLE DATA; Schema: public; Owner: postgres
--

--
-- Data for Name: brain_lessons; Type: TABLE DATA; Schema: public; Owner: postgres
--

--
-- Data for Name: brain_source_profiles; Type: TABLE DATA; Schema: public; Owner: postgres
--

--
-- Data for Name: channel_receipts; Type: TABLE DATA; Schema: public; Owner: postgres
--

--
-- Data for Name: connection_commands; Type: TABLE DATA; Schema: public; Owner: postgres
--

--
-- Data for Name: connection_secrets; Type: TABLE DATA; Schema: public; Owner: postgres
--

--
-- Data for Name: connector_interest; Type: TABLE DATA; Schema: public; Owner: postgres
--

--
-- Data for Name: content_cadence; Type: TABLE DATA; Schema: public; Owner: postgres
--

--
-- Data for Name: content_pillars; Type: TABLE DATA; Schema: public; Owner: postgres
--

--
-- Data for Name: content_plans; Type: TABLE DATA; Schema: public; Owner: postgres
--

--
-- Data for Name: content_items; Type: TABLE DATA; Schema: public; Owner: postgres
--

--
-- Data for Name: content_settings; Type: TABLE DATA; Schema: public; Owner: postgres
--

--
-- Data for Name: contracts; Type: TABLE DATA; Schema: public; Owner: postgres
--

--
-- Data for Name: credit_packs; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO public.credit_packs (code, credits, price_vnd, sort, active) VALUES
	('credits_1000', 1000, 299000, 1, true),
	('credits_3000', 3000, 849000, 2, true),
	('credits_10000', 10000, 2690000, 3, true);

--
-- Data for Name: payment_orders; Type: TABLE DATA; Schema: public; Owner: postgres
--

--
-- Data for Name: credit_pack_purchases; Type: TABLE DATA; Schema: public; Owner: postgres
--

--
-- Data for Name: credit_topup_draws; Type: TABLE DATA; Schema: public; Owner: postgres
--

--
-- Data for Name: credit_topups; Type: TABLE DATA; Schema: public; Owner: postgres
--

--
-- Data for Name: data_records; Type: TABLE DATA; Schema: public; Owner: postgres
--

--
-- Data for Name: data_sync_runs; Type: TABLE DATA; Schema: public; Owner: postgres
--

--
-- Data for Name: decisions; Type: TABLE DATA; Schema: public; Owner: postgres
--

--
-- Data for Name: email_messages; Type: TABLE DATA; Schema: public; Owner: postgres
--

--
-- Data for Name: events; Type: TABLE DATA; Schema: public; Owner: postgres
--

--
-- Data for Name: hiring_apply_hits; Type: TABLE DATA; Schema: public; Owner: postgres
--

--
-- Data for Name: hiring_availability; Type: TABLE DATA; Schema: public; Owner: postgres
--

--
-- Data for Name: hiring_jobs; Type: TABLE DATA; Schema: public; Owner: postgres
--

--
-- Data for Name: hiring_candidates; Type: TABLE DATA; Schema: public; Owner: postgres
--

--
-- Data for Name: hiring_consents; Type: TABLE DATA; Schema: public; Owner: postgres
--

--
-- Data for Name: hiring_events; Type: TABLE DATA; Schema: public; Owner: postgres
--

--
-- Data for Name: hiring_interviews; Type: TABLE DATA; Schema: public; Owner: postgres
--

--
-- Data for Name: hiring_offers; Type: TABLE DATA; Schema: public; Owner: postgres
--

--
-- Data for Name: hiring_onboarding; Type: TABLE DATA; Schema: public; Owner: postgres
--

--
-- Data for Name: hiring_retention_log; Type: TABLE DATA; Schema: public; Owner: postgres
--

--
-- Data for Name: hiring_settings; Type: TABLE DATA; Schema: public; Owner: postgres
--

--
-- Data for Name: inventory_suppliers; Type: TABLE DATA; Schema: public; Owner: postgres
--

--
-- Data for Name: inventory_items; Type: TABLE DATA; Schema: public; Owner: postgres
--

--
-- Data for Name: inventory_locations; Type: TABLE DATA; Schema: public; Owner: postgres
--

--
-- Data for Name: inventory_movements; Type: TABLE DATA; Schema: public; Owner: postgres
--

--
-- Data for Name: inventory_purchase_orders; Type: TABLE DATA; Schema: public; Owner: postgres
--

--
-- Data for Name: inventory_po_lines; Type: TABLE DATA; Schema: public; Owner: postgres
--

--
-- Data for Name: inventory_receipts; Type: TABLE DATA; Schema: public; Owner: postgres
--

--
-- Data for Name: inventory_recipes; Type: TABLE DATA; Schema: public; Owner: postgres
--

--
-- Data for Name: inventory_recipe_lines; Type: TABLE DATA; Schema: public; Owner: postgres
--

--
-- Data for Name: inventory_stock_levels; Type: TABLE DATA; Schema: public; Owner: postgres
--

--
-- Data for Name: invoices; Type: TABLE DATA; Schema: public; Owner: postgres
--

--
-- Data for Name: job_outbox; Type: TABLE DATA; Schema: public; Owner: postgres
--

--
-- Data for Name: job_slots; Type: TABLE DATA; Schema: public; Owner: postgres
--

--
-- Data for Name: jobs; Type: TABLE DATA; Schema: public; Owner: postgres
--

--
-- Data for Name: knowledge_chunks; Type: TABLE DATA; Schema: public; Owner: postgres
--

--
-- Data for Name: knowledge_gaps; Type: TABLE DATA; Schema: public; Owner: postgres
--

--
-- Data for Name: knowledge_suggestion_state; Type: TABLE DATA; Schema: public; Owner: postgres
--

--
-- Data for Name: lead_actions; Type: TABLE DATA; Schema: public; Owner: postgres
--

--
-- Data for Name: lead_flows; Type: TABLE DATA; Schema: public; Owner: postgres
--

--
-- Data for Name: loyalty_campaigns; Type: TABLE DATA; Schema: public; Owner: postgres
--

--
-- Data for Name: loyalty_customers; Type: TABLE DATA; Schema: public; Owner: postgres
--

--
-- Data for Name: loyalty_customer_links; Type: TABLE DATA; Schema: public; Owner: postgres
--

--
-- Data for Name: loyalty_rewards; Type: TABLE DATA; Schema: public; Owner: postgres
--

--
-- Data for Name: loyalty_ledger; Type: TABLE DATA; Schema: public; Owner: postgres
--

--
-- Data for Name: loyalty_otps; Type: TABLE DATA; Schema: public; Owner: postgres
--

--
-- Data for Name: loyalty_programs; Type: TABLE DATA; Schema: public; Owner: postgres
--

--
-- Data for Name: loyalty_sends; Type: TABLE DATA; Schema: public; Owner: postgres
--

--
-- Data for Name: messages; Type: TABLE DATA; Schema: public; Owner: postgres
--

--
-- Data for Name: meta_comments; Type: TABLE DATA; Schema: public; Owner: postgres
--

--
-- Data for Name: meta_inbox; Type: TABLE DATA; Schema: public; Owner: postgres
--

--
-- Data for Name: meta_threads; Type: TABLE DATA; Schema: public; Owner: postgres
--

--
-- Data for Name: module_context_notes; Type: TABLE DATA; Schema: public; Owner: postgres
--

--
-- Data for Name: module_context_versions; Type: TABLE DATA; Schema: public; Owner: postgres
--

--
-- Data for Name: module_setup_sessions; Type: TABLE DATA; Schema: public; Owner: postgres
--

--
-- Data for Name: module_setup_messages; Type: TABLE DATA; Schema: public; Owner: postgres
--

--
-- Data for Name: module_setup_writes; Type: TABLE DATA; Schema: public; Owner: postgres
--

--
-- Data for Name: n8n_pipelines; Type: TABLE DATA; Schema: public; Owner: postgres
--

--
-- Data for Name: n8n_platform_config; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO public.n8n_platform_config (key, value) VALUES
	('api_base', 'https://nivo.vn');

--
-- Data for Name: n8n_runs; Type: TABLE DATA; Schema: public; Owner: postgres
--

--
-- Data for Name: nivo_knowledge; Type: TABLE DATA; Schema: public; Owner: postgres
--

--
-- Data for Name: office_command_candidates; Type: TABLE DATA; Schema: public; Owner: postgres
--

--
-- Data for Name: openclaw_agent_sync; Type: TABLE DATA; Schema: public; Owner: postgres
--

--
-- Data for Name: payment_order_requests; Type: TABLE DATA; Schema: public; Owner: postgres
--

--
-- Data for Name: plan_usage_tiers; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO public.plan_usage_tiers (plan_code, credits_per_month, price_vnd, per_seat, sort) VALUES
	('pro', 8000, 800000, false, 1),
	('pro', 12000, 1200000, false, 2),
	('pro', 16000, 1600000, false, 3),
	('pro', 20000, 2000000, false, 4),
	('max', 40000, 4000000, false, 1),
	('max', 63000, 6300000, false, 2),
	('max', 85000, 8500000, false, 3),
	('max', 110000, 11000000, false, 4),
	('max', 170000, 17000000, false, 5),
	('team', 8000, 400000, true, 1),
	('team', 16000, 800000, true, 2),
	('team', 24000, 1200000, true, 3),
	('team', 32000, 1600000, true, 4),
	('team', 40000, 2000000, true, 5),
	('team', 80000, 4000000, true, 6),
	('team', 126000, 6300000, true, 7),
	('team', 170000, 8500000, true, 8),
	('team', 220000, 11000000, true, 9),
	('team', 340000, 17000000, true, 10),
	('team', 460000, 23000000, true, 11),
	('team', 700000, 35000000, true, 12),
	('team', 960000, 48000000, true, 13),
	('team', 1600000, 80000000, true, 14);

--
-- Data for Name: platform_admins; Type: TABLE DATA; Schema: public; Owner: postgres
--

--
-- Data for Name: platform_audit; Type: TABLE DATA; Schema: public; Owner: postgres
--

--
-- Data for Name: platform_flags; Type: TABLE DATA; Schema: public; Owner: postgres
--

INSERT INTO public.platform_flags (key, enabled) VALUES
	('workspace_signup_enabled', false);

--
-- Data for Name: public_api; Type: TABLE DATA; Schema: public; Owner: postgres
--

--
-- Data for Name: queue; Type: TABLE DATA; Schema: public; Owner: postgres
--

--
-- Data for Name: sepay_transactions; Type: TABLE DATA; Schema: public; Owner: postgres
--

--
-- Data for Name: shifts_positions; Type: TABLE DATA; Schema: public; Owner: postgres
--

--
-- Data for Name: shifts_schedules; Type: TABLE DATA; Schema: public; Owner: postgres
--

--
-- Data for Name: shifts_staff; Type: TABLE DATA; Schema: public; Owner: postgres
--

--
-- Data for Name: shifts_shifts; Type: TABLE DATA; Schema: public; Owner: postgres
--

--
-- Data for Name: shifts_attendance; Type: TABLE DATA; Schema: public; Owner: postgres
--

--
-- Data for Name: shifts_availability; Type: TABLE DATA; Schema: public; Owner: postgres
--

--
-- Data for Name: shifts_coverage; Type: TABLE DATA; Schema: public; Owner: postgres
--

--
-- Data for Name: shifts_leave_requests; Type: TABLE DATA; Schema: public; Owner: postgres
--

--
-- Data for Name: shifts_notifications; Type: TABLE DATA; Schema: public; Owner: postgres
--

--
-- Data for Name: shifts_settings; Type: TABLE DATA; Schema: public; Owner: postgres
--

--
-- Data for Name: shifts_staff_pay; Type: TABLE DATA; Schema: public; Owner: postgres
--

--
-- Data for Name: shifts_swap_requests; Type: TABLE DATA; Schema: public; Owner: postgres
--

--
-- Data for Name: telegram_inbox; Type: TABLE DATA; Schema: public; Owner: postgres
--

--
-- Data for Name: transactions; Type: TABLE DATA; Schema: public; Owner: postgres
--

--
-- Data for Name: video_brand_kits; Type: TABLE DATA; Schema: public; Owner: postgres
--

--
-- Data for Name: video_renders; Type: TABLE DATA; Schema: public; Owner: postgres
--

--
-- Data for Name: video_projects; Type: TABLE DATA; Schema: public; Owner: postgres
--

--
-- Data for Name: video_project_versions; Type: TABLE DATA; Schema: public; Owner: postgres
--

--
-- Data for Name: workspace_invites; Type: TABLE DATA; Schema: public; Owner: postgres
--

--
-- Data for Name: workspace_members; Type: TABLE DATA; Schema: public; Owner: postgres
--

--
-- Data for Name: zalo_inbox; Type: TABLE DATA; Schema: public; Owner: postgres
--

--
-- Data for Name: zalo_wizard_drafts; Type: TABLE DATA; Schema: public; Owner: postgres
--

--
-- Name: hiring_apply_hits_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.hiring_apply_hits_id_seq', 1, false);

--
-- PostgreSQL database dump complete
--

-- Operator reads and the bulk retry of the job outbox (folded in from the previous chain: job-ops-functions).
-- Operator reads and the bulk retry of the job outbox for the be CLI (`cli jobs failed|open|retry-failed`), as definer functions: the
-- least-privilege role app_be has no table grant on job_outbox, so the be asks these functions, like job_stats() and job_requeue().

CREATE OR REPLACE FUNCTION public.job_failed(p_limit integer DEFAULT 20)
RETURNS TABLE(id uuid, name text, attempts integer, finished_at timestamp with time zone, last_error text)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  select o.id, o.name, o.attempts, o.finished_at, o.last_error
  from public.job_outbox o
  where o.state = 'failed'
  order by o.finished_at desc nulls last
  limit least(greatest(coalesce(p_limit, 20), 1), 200)
$$;

CREATE OR REPLACE FUNCTION public.job_open(p_limit integer DEFAULT 20)
RETURNS TABLE(id uuid, name text, state text, attempts integer, created_at timestamp with time zone, last_error text)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  select o.id, o.name, o.state, o.attempts, o.created_at, o.last_error
  from public.job_outbox o
  where o.state in ('queued', 'running')
  order by o.created_at
  limit least(greatest(coalesce(p_limit, 20), 1), 200)
$$;

CREATE OR REPLACE FUNCTION public.job_requeue_failed(p_hours integer DEFAULT 24)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public'
AS $$
declare
  r record;
  v_failed integer := 0;
  v_requeued integer := 0;
begin
  for r in
    select o.id from public.job_outbox o
    where o.state = 'failed' and o.finished_at >= now() - make_interval(hours => least(greatest(coalesce(p_hours, 24), 1), 720))
    order by o.finished_at
  loop
    v_failed := v_failed + 1;
    if public.job_requeue(r.id) is not null then v_requeued := v_requeued + 1; end if;
  end loop;
  return jsonb_build_object('requeued', v_requeued, 'failed', v_failed);
end $$;

REVOKE EXECUTE ON FUNCTION public.job_failed(integer) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.job_open(integer) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.job_requeue_failed(integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.job_failed(integer) TO app_be;
GRANT EXECUTE ON FUNCTION public.job_open(integer) TO app_be;
GRANT EXECUTE ON FUNCTION public.job_requeue_failed(integer) TO app_be;
