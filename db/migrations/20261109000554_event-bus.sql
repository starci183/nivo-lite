-- The event bus (platform/event-bus) on pgmq, in the shape of the canon's inbox migration (hfs templates/be/inbox/platform/migration.sql.tpl).
-- pgmq installs into its own schema pgmq (the one exception to extensions; its control file fixes the schema, so there is no WITH
-- SCHEMA clause) and this chain needs pgmq 1.13.1 or later, which has topic routing (bind_topic, send_topic). A publish sends the
-- typed envelope once to its topic, the event name, in the publisher's own transaction, and pgmq copies it into every consumer queue
-- bound to that name, so a rolled-back change sends nothing. The application role holds no grant on the pgmq schema: it calls the
-- security definer functions below through callDbFunction (R258, R334), and a read names only a queue bound to a topic.
-- public.inbox already exists (baseline); a consumer claims (consumer, dedupeKey) there in the transaction of its effect.
--
-- Every consumer queue '<topic>__<consumer>' and its dead-letter queue '<topic>__<consumer>__dead' is declared here, with the topic
-- bound to the queue, so the topic lanes add no migration for these. The pairs equal the constants of event-bus.queues.ts.

create extension if not exists pgmq;

create function public.event_bus_send(p_event_name text, p_envelope jsonb)
returns integer
language sql
security definer
set search_path = pg_catalog, pg_temp
as $$
    select pgmq.send_topic(p_event_name, p_envelope)
$$;

create function public.event_bus_read(p_queue text, p_visibility_seconds integer, p_batch integer)
returns table (msg_id bigint, read_ct integer, message jsonb)
language sql
security definer
set search_path = pg_catalog, pg_temp
as $$
    select m.msg_id, m.read_ct, m.message
      from (select distinct b.queue_name from pgmq.topic_bindings as b where b.queue_name = p_queue) as bound
     cross join lateral pgmq.read(bound.queue_name, p_visibility_seconds, p_batch) as m
$$;

create function public.event_bus_archive(p_queue text, p_msg_id bigint)
returns boolean
language sql
security definer
set search_path = pg_catalog, pg_temp
as $$
    select pgmq.archive(p_queue, p_msg_id)
$$;

create function public.event_bus_bury(p_queue text, p_msg_id bigint, p_read_ct integer, p_message jsonb, p_reason text)
returns boolean
language plpgsql
security definer
set search_path = pg_catalog, pg_temp
as $$
begin
    if not exists (select 1 from pgmq.topic_bindings as b where b.queue_name = p_queue) then
        raise exception 'event_bus_bury: % is no consumer queue bound to a topic', p_queue;
    end if;
    perform pgmq.send(p_queue || '__dead', jsonb_build_object('readCount', p_read_ct, 'reason', p_reason, 'message', p_message));
    return pgmq.archive(p_queue, p_msg_id);
end
$$;

create function public.event_bus_dead_letters(p_queue text, p_batch integer)
returns table (msg_id bigint, message jsonb)
language plpgsql
security definer
set search_path = pg_catalog, pg_temp
as $$
begin
    if not exists (select 1 from pgmq.topic_bindings as b where b.queue_name = p_queue) then
        raise exception 'event_bus_dead_letters: % is no consumer queue bound to a topic', p_queue;
    end if;
    return query execute format('select d.msg_id, d.message from pgmq.%I as d order by d.msg_id limit $1', 'q_' || p_queue || '__dead') using p_batch;
end
$$;

create function public.event_bus_requeue(p_queue text, p_msg_id bigint)
returns boolean
language plpgsql
security definer
set search_path = pg_catalog, pg_temp
as $$
declare
    v_dead jsonb;
begin
    if not exists (select 1 from pgmq.topic_bindings as b where b.queue_name = p_queue) then
        raise exception 'event_bus_requeue: % is no consumer queue bound to a topic', p_queue;
    end if;
    execute format('delete from pgmq.%I as d where d.msg_id = $1 returning d.message', 'q_' || p_queue || '__dead') into v_dead using p_msg_id;
    if v_dead is null then
        return false;
    end if;
    perform pgmq.send(p_queue, v_dead -> 'message');
    return true;
end
$$;


-- The consumer queues, their dead-letter queues and the topic bindings are declared literally in
-- 20261109100200_event-bus-missing-queues.sql (one pgmq.create / pgmq.bind_topic per name, as the migration shape requires).

revoke all on function public.event_bus_send(text, jsonb) from public;
grant execute on function public.event_bus_send(text, jsonb) to app_be;
revoke all on function public.event_bus_read(text, integer, integer) from public;
grant execute on function public.event_bus_read(text, integer, integer) to app_be;
revoke all on function public.event_bus_archive(text, bigint) from public;
grant execute on function public.event_bus_archive(text, bigint) to app_be;
revoke all on function public.event_bus_bury(text, bigint, integer, jsonb, text) from public;
grant execute on function public.event_bus_bury(text, bigint, integer, jsonb, text) to app_be;
revoke all on function public.event_bus_dead_letters(text, integer) from public;
grant execute on function public.event_bus_dead_letters(text, integer) to app_be;
revoke all on function public.event_bus_requeue(text, bigint) from public;
grant execute on function public.event_bus_requeue(text, bigint) to app_be;
