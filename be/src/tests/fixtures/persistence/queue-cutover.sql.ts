import { sql } from "@modules/platform/database"

/** Existing durable deliveries, including an outbox-only row whose pgmq sent marker must not hide it from BullMQ. */
export const SEED_CUTOVER_OUTBOX = sql`
    SELECT public.job_enqueue(NULL, 'content_tick', 'content_tick', jsonb_build_object('proof', scenario), 'cutover:' || scenario)
    FROM unnest(ARRAY['queued', 'inflight', 'dead', 'done']) scenario;
    UPDATE pgmq.q_content_tick SET read_ct = 1, vt = now() + interval '1 second'
    WHERE message->'payload'->>'proof' = 'inflight';
    UPDATE public.job_outbox SET state = 'running', attempts = 1, started_at = now()
    WHERE payload->>'proof' = 'inflight';
    SELECT pgmq.archive(queue, msg_id) FROM public.job_outbox WHERE payload->>'proof' = 'dead';
    UPDATE public.job_outbox SET state = 'failed', finished_at = now(), last_error = 'Synthetic dead letter'
    WHERE payload->>'proof' = 'dead';
    SELECT pgmq.delete(queue, msg_id) FROM public.job_outbox WHERE payload->>'proof' = 'done';
    UPDATE public.job_outbox SET state = 'done', finished_at = now(), last_error = NULL WHERE payload->>'proof' = 'done';
    INSERT INTO public.job_outbox(queue, name, payload, dedupe_key, sent_at)
    VALUES ('content_tick', 'content_tick', '{"proof":"outbox-only"}', 'cutover:outbox-only', now());
    SELECT pgmq.send(queue, jsonb_build_object('name', name, 'payload', coalesce(payload, '{}'::jsonb), 'dedupe', dedupe_key, 'outbox_id', id))
    FROM public.job_outbox WHERE payload->>'proof' = 'queued'
`

/** Raw cron envelopes have no outbox id; raw dead letters have no ledger row until the data move. */
export const SEED_CUTOVER_RAW = sql`
    SELECT pgmq.send('content_tick', jsonb_build_object('name', 'content_tick', 'payload', jsonb_build_object('proof', scenario)))
    FROM unnest(ARRAY['raw', 'raw-inflight', 'raw-dead', 'raw-done']) scenario;
    UPDATE pgmq.q_content_tick SET read_ct = 1, vt = now() + interval '1 second'
    WHERE message->'payload'->>'proof' IN ('raw-inflight', 'raw-done');
    SELECT pgmq.archive('content_tick', msg_id) FROM pgmq.q_content_tick WHERE message->'payload'->>'proof' = 'raw-dead';
    INSERT INTO public.jobs(kind, job_key, status, fencing_token, claimed_by, lease_expires_at, payload, current_step, created_at, updated_at)
    SELECT 'content_tick', 'content_tick:' || msg_id,
           CASE WHEN message->'payload'->>'proof' = 'raw-done' THEN 'done' ELSE 'running' END,
           1, 'legacy-worker', now() + interval '1 second', message->'payload', 'preserved-checkpoint', now(), now()
    FROM pgmq.q_content_tick WHERE message->'payload'->>'proof' IN ('raw-inflight', 'raw-done');
    UPDATE pgmq.q_content_tick SET message = jsonb_set(message, '{name}', '"content_tick.special"')
    WHERE message->'payload'->>'proof' = 'raw-done';
    SELECT pgmq.create('cutover_bus_events');
    SELECT pgmq.send('cutover_bus_events', '{"name":"cutover.bus","payload":{"proof":"event-bus"}}')
`

export const CUTOVER_ROWS = sql`
    SELECT id::text, payload->>'proof' AS proof, state, attempts, sent_at, run_lease_until
    FROM public.job_outbox WHERE dedupe_key LIKE 'cutover:%' OR dedupe_key LIKE 'pgmq-cutover:content_tick:%'
    ORDER BY payload->>'proof'
`
export const ORIGINAL_CUTOVER_ROWS = sql`
    SELECT id::text, payload->>'proof' AS proof, state, attempts, sent_at, null::timestamptz AS run_lease_until
    FROM public.job_outbox WHERE dedupe_key LIKE 'cutover:%' ORDER BY payload->>'proof'
`
export const CUTOVER_CLAIMS = sql`
    SELECT id::text, job_key, status, fencing_token::text, current_step
    FROM public.jobs WHERE payload->>'proof' IN ('raw-inflight', 'raw-done') ORDER BY payload->>'proof'
`
export const CUTOVER_PGMQ = sql`
    SELECT (SELECT count(*)::int FROM pgmq.q_content_tick) AS pending,
           (SELECT count(*)::int FROM pgmq.a_content_tick) AS archived,
           (SELECT count(*)::int FROM pgmq.q_cutover_bus_events) AS event_bus
`
export const LATE_CUTOVER_SEND = sql`
    SELECT pgmq.send('content_tick', '{"name":"content_tick","payload":{"proof":"late"}}')
`
export const CONTRACT_CUTOVER_SEND = sql`
    SELECT pgmq.send('content_tick', '{"name":"content_tick","payload":{"proof":"late-contract"}}')
`
export const LEGACY_CUTOVER_MARKER = sql`
    UPDATE public.job_outbox SET msg_id = 999999, sent_at = now() WHERE payload->>'proof' = 'late'
`
export const CONFLICT_CUTOVER_IDENTITY = sql`
    UPDATE pgmq.q_content_tick SET message = jsonb_set(message, '{outbox_id}',
        to_jsonb((SELECT id::text FROM public.job_outbox WHERE payload->>'proof' = 'queued')))
    WHERE message->'payload'->>'proof' = 'raw-done'
`
/** The expand migration replaces the legacy acknowledgement with a constant refusal, so an old consumer cannot settle a migrated row. */
export const LEGACY_ACK_FENCE = sql`
    SELECT btrim(prosrc) AS body FROM pg_proc WHERE oid = to_regprocedure('public.job_ack(text,bigint)')
`
export const CUTOVER_FUNCTIONS = sql`
    SELECT to_regprocedure('public.job_read(text,integer,integer,integer)')::text AS legacy_read,
           to_regprocedure('public.job_ack(text,bigint)')::text AS legacy_ack
`
