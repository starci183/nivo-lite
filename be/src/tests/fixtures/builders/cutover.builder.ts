import type { EntityManager } from "typeorm"
import { callDbFunction } from "@modules/platform/database"
import { eachInOrder } from "@modules/platform/primitives"
import { jobsEntities } from "@modules/platform/jobs"

const [JobEntity, JobOutboxEntity] = jobsEntities

/** The queue every cutover proof seeds. */
const QUEUE = "content_tick"

/** The columns of public.job_outbox that exist before the expand migration. */
const OUTBOX_COLUMNS: Array<keyof InstanceType<typeof JobOutboxEntity>> = [
    "queue",
    "name",
    "payload",
    "dedupeKey",
    "sentAt",
]

/** The columns of public.jobs written by the cutover proofs. */
const JOB_COLUMNS: Array<keyof InstanceType<typeof JobEntity>> = [
    "kind",
    "jobKey",
    "status",
    "fencingToken",
    "claimedBy",
    "leaseExpiresAt",
    "payload",
    "currentStep",
    "createdAt",
    "updatedAt",
]

/** One pgmq message of the cutover queue. */
export interface CutoverEnvelope {
    /** The pgmq message id. */
    readonly msgId: number
    /** The proof tag of the payload. */
    readonly proof: string
}

/** The outbox state a seeded delivery is moved to. */
export interface CutoverOutboxState {
    /** The lifecycle state. */
    readonly state: "running" | "done" | "failed"
    /** Attempts, set for a started delivery. */
    readonly attempts?: number
    /** The start instant expression. */
    readonly startedAt?: () => string
    /** The finish instant expression. */
    readonly finishedAt?: () => string
    /** The recorded failure; null clears it. */
    readonly lastError?: string | null
}

/** One outbox row as the pre-expand schema stores it. */
interface OutboxIdentity {
    readonly id: string
    readonly name: string
    readonly payload: object
    readonly dedupeKey: string
    readonly msgId: number | null
}

const PROOF_FILTER = "payload ->> 'proof' = :proof"

/** Enqueues one durable delivery per proof tag through the legacy function. */
export const enqueueCutoverProofs = async (manager: EntityManager, proofs: ReadonlyArray<string>): Promise<void> => {
    await eachInOrder(proofs, (proof) =>
        callDbFunction(manager, "public.job_enqueue", [
            null,
            QUEUE,
            QUEUE,
            JSON.stringify({ proof }),
            `cutover:${proof}`,
        ]),
    )
}

/** Moves the delivery of one proof tag to a state, writing only pre-expand columns. */
export const setCutoverOutboxState = async (
    manager: EntityManager,
    proof: string,
    next: CutoverOutboxState,
): Promise<void> => {
    await manager
        .createQueryBuilder(JobOutboxEntity, "o")
        .update(JobOutboxEntity)
        .set(next)
        .where(PROOF_FILTER, { proof })
        .execute()
}

/** Reads the identity of the outbox row of one proof tag, selecting only pre-expand columns. */
const outboxIdentity = async (manager: EntityManager, proof: string): Promise<OutboxIdentity> => {
    const row = await manager
        .createQueryBuilder(JobOutboxEntity, "o")
        .select(["o.id", "o.name", "o.payload", "o.dedupeKey", "o.msgId"])
        .where("o.payload ->> 'proof' = :proof", { proof })
        .getOneOrFail()
    return { id: row.id, name: row.name, payload: row.payload, dedupeKey: row.dedupeKey, msgId: row.msgId }
}

/** Archives the pgmq message of the delivery of one proof tag. */
export const archiveCutoverDelivery = async (manager: EntityManager, proof: string): Promise<void> => {
    const { msgId } = await outboxIdentity(manager, proof)
    await callDbFunction(manager, "pgmq.archive", [QUEUE, msgId])
}

/** Deletes the pgmq message of the delivery of one proof tag. */
export const deleteCutoverDelivery = async (manager: EntityManager, proof: string): Promise<void> => {
    const { msgId } = await outboxIdentity(manager, proof)
    await callDbFunction(manager, "pgmq.delete", [QUEUE, msgId])
}

/** Sends the delivery of one proof tag to pgmq as the legacy relay did, without recording the message id. */
export const sendCutoverDelivery = async (manager: EntityManager, proof: string): Promise<void> => {
    const { id, name, payload, dedupeKey } = await outboxIdentity(manager, proof)
    await callDbFunction(manager, "pgmq.send", [
        QUEUE,
        JSON.stringify({ name, payload, dedupe: dedupeKey, outbox_id: id }),
    ])
}

/** Inserts a delivery already marked sent whose pgmq message does not exist. */
export const insertSentOutboxOnly = async (manager: EntityManager, proof: string): Promise<void> => {
    await manager
        .createQueryBuilder(JobOutboxEntity, "o")
        .insert()
        .into(JobOutboxEntity, OUTBOX_COLUMNS)
        .values({
            queue: QUEUE,
            name: QUEUE,
            payload: { proof },
            dedupeKey: `cutover:${proof}`,
            sentAt: () => "now()",
        })
        .execute()
}

/** Marks a late delivery as already sent by a legacy producer. */
export const markCutoverSentByLegacy = async (manager: EntityManager, proof: string, msgId: number): Promise<void> => {
    await manager
        .createQueryBuilder(JobOutboxEntity, "o")
        .update(JobOutboxEntity)
        .set({ msgId, sentAt: () => "now()" })
        .where(PROOF_FILTER, { proof })
        .execute()
}

/** Sends one raw cron envelope, as a producer of the pgmq era did. */
export const sendRawEnvelope = async (manager: EntityManager, proof: string): Promise<void> => {
    await callDbFunction(manager, "pgmq.send", [QUEUE, JSON.stringify({ name: QUEUE, payload: { proof } })])
}

/** Archives one pgmq message of the cutover queue. */
export const archiveEnvelope = async (manager: EntityManager, envelope: CutoverEnvelope): Promise<void> => {
    await callDbFunction(manager, "pgmq.archive", [QUEUE, envelope.msgId])
}

/** Creates the event bus queue the cutover must leave alone and sends it one event. */
export const sendCutoverBusEvent = async (manager: EntityManager): Promise<void> => {
    await callDbFunction(manager, "pgmq.create", ["cutover_bus_events"])
    await callDbFunction(manager, "pgmq.send", [
        "cutover_bus_events",
        JSON.stringify({ name: "cutover.bus", payload: { proof: "event-bus" } }),
    ])
}

/** Inserts the fenced claims a legacy worker held on in-flight and done raw messages. */
export const insertLegacyClaims = async (
    manager: EntityManager,
    envelopes: ReadonlyArray<CutoverEnvelope>,
): Promise<void> => {
    await eachInOrder(envelopes, async ({ msgId, proof }) => {
        await manager
            .createQueryBuilder(JobEntity, "j")
            .insert()
            .into(JobEntity, JOB_COLUMNS)
            .values({
                kind: QUEUE,
                jobKey: `${QUEUE}:${String(msgId)}`,
                status: proof === "raw-done" ? "done" : "running",
                fencingToken: 1,
                claimedBy: "legacy-worker",
                leaseExpiresAt: () => "now() + interval '1 second'",
                payload: { proof },
                currentStep: "preserved-checkpoint",
                createdAt: () => "now()",
                updatedAt: () => "now()",
            })
            .execute()
    })
}
