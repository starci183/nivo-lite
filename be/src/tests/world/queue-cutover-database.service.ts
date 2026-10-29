import type { EntityManager } from "typeorm"
import { sql } from "@modules/platform/database"
import {
    archiveCutoverDelivery,
    archiveEnvelope,
    deleteCutoverDelivery,
    enqueueCutoverProofs,
    insertLegacyClaims,
    insertSentOutboxOnly,
    markCutoverSentByLegacy,
    sendCutoverBusEvent,
    sendCutoverDelivery,
    sendRawEnvelope,
    setCutoverOutboxState,
} from "../fixtures/builders/cutover.builder"
import type { CutoverEnvelope } from "../fixtures/builders/cutover.builder"
import type {
    CutoverClaim,
    CutoverFunctions,
    CutoverQueueList,
    CutoverQueues,
    CutoverRow,
} from "../fixtures/persistence/queue-cutover.rows"

/** The cutover proofs inspect pgmq queues, catalog entries and migration side effects, which entities cannot express. */
/** Makes a message look claimed once, with a one second visibility window. */
const CLAIM_ENVELOPES = sql`
    UPDATE pgmq.q_content_tick SET read_ct = 1, vt = now() + interval '1 second' WHERE message->'payload'->>'proof' = ANY($1)
`
/** Reads the messages of the cutover queue that carry one of the proof tags. */
const READ_ENVELOPES = sql`
    SELECT msg_id::text AS "msgId", message->'payload'->>'proof' AS proof
    FROM pgmq.q_content_tick WHERE message->'payload'->>'proof' = ANY($1) ORDER BY msg_id
`
/** The pgmq era renamed a finished message so no handler claims it. */
const RENAME_DONE_ENVELOPE = sql`
    UPDATE pgmq.q_content_tick SET message = jsonb_set(message, '{name}', '"content_tick.special"')
    WHERE message->'payload'->>'proof' = 'raw-done'
`

interface EnvelopeRow {
    readonly msgId: string
    readonly proof: string
}

const claimEnvelopes = async (manager: EntityManager, proofs: ReadonlyArray<string>): Promise<void> => {
    await manager.query(CLAIM_ENVELOPES, [proofs])
}

const readEnvelopes = async (manager: EntityManager, proofs: ReadonlyArray<string>): Promise<Array<CutoverEnvelope>> => {
    const rows = await manager.query<Array<EnvelopeRow>>(READ_ENVELOPES, [proofs])
    return rows.map(({ msgId, proof }) => ({ msgId: Number(msgId), proof }))
}

const CUTOVER_ROWS = sql`
    SELECT id::text, payload->>'proof' AS proof, state, attempts, sent_at, run_lease_until
    FROM public.job_outbox WHERE dedupe_key LIKE 'cutover:%' OR dedupe_key LIKE 'pgmq-cutover:content_tick:%'
    ORDER BY payload->>'proof'
`
const ORIGINAL_CUTOVER_ROWS = sql`
    SELECT id::text, payload->>'proof' AS proof, state, attempts, sent_at, null::timestamptz AS run_lease_until
    FROM public.job_outbox WHERE dedupe_key LIKE 'cutover:%' ORDER BY payload->>'proof'
`
const CUTOVER_CLAIMS = sql`
    SELECT id::text, job_key, status, fencing_token::text, current_step
    FROM public.jobs WHERE payload->>'proof' IN ('raw-inflight', 'raw-done') ORDER BY payload->>'proof'
`
const CUTOVER_PGMQ = sql`
    SELECT (SELECT count(*)::int FROM pgmq.q_content_tick) AS pending,
           (SELECT count(*)::int FROM pgmq.a_content_tick) AS archived,
           (SELECT count(*)::int FROM pgmq.q_cutover_bus_events) AS event_bus
`
/** The pgmq queues that remain once the contract migration dropped every job queue: the event bus only. */
const PGMQ_AFTER_CONTRACT = sql`
    SELECT coalesce(array_agg(queue_name ORDER BY queue_name), '{}'::text[]) AS queues FROM pgmq.list_queues()
`
const CONFLICT_CUTOVER_IDENTITY = sql`
    UPDATE pgmq.q_content_tick SET message = jsonb_set(message, '{outbox_id}',
        to_jsonb((SELECT id::text FROM public.job_outbox WHERE payload->>'proof' = 'queued')))
    WHERE message->'payload'->>'proof' = 'raw-done'
`
/** The expand migration replaces the legacy acknowledgement with a constant refusal, so an old consumer cannot settle a migrated row. */
const LEGACY_ACK_FENCE = sql`
    SELECT btrim(prosrc) AS body FROM pg_proc WHERE oid = to_regprocedure('public.job_ack(text,bigint)')
`
const CUTOVER_FUNCTIONS = sql`
    SELECT to_regprocedure('public.job_read(text,integer,integer,integer)')::text AS legacy_read,
           to_regprocedure('public.job_ack(text,bigint)')::text AS legacy_ack
`

/** The body the expand migration leaves in the legacy acknowledgement function. */
export interface LegacyAckFenceRow {
    /** The function body. */
    readonly body: string
}

/** Seeds the durable deliveries a cutover must carry over, writing only columns the pre-expand schema has. */
export const seedCutoverOutbox = async (manager: EntityManager): Promise<void> => {
    await enqueueCutoverProofs(manager, ["queued", "inflight", "dead", "done"])
    await claimEnvelopes(manager, ["inflight"])
    await setCutoverOutboxState(manager, "inflight", { state: "running", attempts: 1, startedAt: () => "now()" })
    await archiveCutoverDelivery(manager, "dead")
    await setCutoverOutboxState(manager, "dead", {
        state: "failed",
        finishedAt: () => "now()",
        lastError: "Synthetic dead letter",
    })
    await deleteCutoverDelivery(manager, "done")
    await setCutoverOutboxState(manager, "done", { state: "done", finishedAt: () => "now()", lastError: null })
    await insertSentOutboxOnly(manager, "outbox-only")
    await sendCutoverDelivery(manager, "queued")
}

/** Seeds raw cron envelopes and dead letters the cutover adopts: raw envelopes have no outbox id, raw dead letters no ledger row. */
export const seedCutoverRaw = async (manager: EntityManager): Promise<void> => {
    for (const proof of ["raw", "raw-inflight", "raw-dead", "raw-done"]) await sendRawEnvelope(manager, proof)
    await claimEnvelopes(manager, ["raw-inflight", "raw-done"])
    for (const envelope of await readEnvelopes(manager, ["raw-dead"])) await archiveEnvelope(manager, envelope)
    await insertLegacyClaims(manager, await readEnvelopes(manager, ["raw-inflight", "raw-done"]))
    await manager.query(RENAME_DONE_ENVELOPE)
    await sendCutoverBusEvent(manager)
}

/** The outbox identities and states observed across the migration boundary. */
export const cutoverRows = (manager: EntityManager): Promise<Array<CutoverRow>> =>
    manager.query<Array<CutoverRow>>(CUTOVER_ROWS)

/** The outbox rows that existed before the migration. */
export const originalCutoverRows = (manager: EntityManager): Promise<Array<CutoverRow>> =>
    manager.query<Array<CutoverRow>>(ORIGINAL_CUTOVER_ROWS)

/** The fenced claims that must survive raw-message adoption. */
export const cutoverClaims = (manager: EntityManager): Promise<Array<CutoverClaim>> =>
    manager.query<Array<CutoverClaim>>(CUTOVER_CLAIMS)

/** How many messages each pgmq table holds. */
export const cutoverQueues = (manager: EntityManager): Promise<Array<CutoverQueues>> =>
    manager.query<Array<CutoverQueues>>(CUTOVER_PGMQ)

/** Sends a legacy envelope after the expand migration, as a not yet drained producer would. */
export const lateCutoverSend = async (manager: EntityManager): Promise<void> => {
    await sendRawEnvelope(manager, "late")
}

/** Sends a legacy envelope after the contract migration, which must be refused. */
export const contractCutoverSend = async (manager: EntityManager): Promise<void> => {
    await sendRawEnvelope(manager, "late-contract")
}

/** Enqueues through the outbox function once the pgmq job queue is gone. */
export const contractEnqueue = async (manager: EntityManager): Promise<void> => {
    await enqueueCutoverProofs(manager, ["late-contract"])
}

/** Lists the pgmq queues that remain after the contract migration. */
export const pgmqAfterContract = (manager: EntityManager): Promise<Array<CutoverQueueList>> =>
    manager.query<Array<CutoverQueueList>>(PGMQ_AFTER_CONTRACT)

/** The message id a legacy producer recorded for the late row. */
const LEGACY_MSG_ID = 999999

/** Marks a late row as already sent by a legacy producer. */
export const legacyCutoverMarker = async (manager: EntityManager): Promise<void> => {
    await markCutoverSentByLegacy(manager, "late", LEGACY_MSG_ID)
}

/** Makes two raw envelopes claim the same outbox identity. */
export const conflictCutoverIdentity = async (manager: EntityManager): Promise<void> => {
    await manager.query(CONFLICT_CUTOVER_IDENTITY)
}

/** Reads the body of the legacy acknowledgement function. */
export const legacyAckFence = (manager: EntityManager): Promise<Array<LegacyAckFenceRow>> =>
    manager.query<Array<LegacyAckFenceRow>>(LEGACY_ACK_FENCE)

/** Reads the legacy functions that must be gone after the contract migration. */
export const cutoverFunctions = (manager: EntityManager): Promise<Array<CutoverFunctions>> =>
    manager.query<Array<CutoverFunctions>>(CUTOVER_FUNCTIONS)
