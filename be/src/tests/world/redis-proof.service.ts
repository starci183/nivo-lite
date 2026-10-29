import assert from "node:assert/strict"
import { callDbFunction, sql } from "@modules/platform/database"
import { jobsEntities } from "@modules/platform/jobs"
import { QUEUE_OUTBOX } from "@modules/platform/queue"
import type { QueueOutbox } from "@modules/platform/queue"
import { QUEUE_TRANSPORT } from "../../modules/platform/queue/queue.decorators"
import { QueueRelayService } from "../../modules/platform/queue/queue-relay.service"
import type { QueueTransport } from "../../modules/platform/queue/queue-transport.port"
import type { EntityManager } from "typeorm"
import type { LiteWorld } from "./lite-world.service"

const [JobEntity] = jobsEntities

/** A real broker proof's durable admission and settlement. */
const REDIS_JOB = sql`SELECT id, queue, name, payload, state, attempts FROM public.job_outbox
WHERE dedupe_key = $1`

/** The accepted public API request's durable broker identity. */
const API_REDIS_JOB = sql`SELECT id, state FROM public.job_outbox
WHERE queue = 'public_api' AND payload->>'requestId' = $1`

/** Only the proof's isolated admission is removed. */
const CLEAN_REDIS_JOB = sql`DELETE FROM public.job_outbox WHERE dedupe_key = $1`

/** Models the persisted lease left by a crashed holder, without changing its admitted identity. */
const LAPSE_REDIS_JOB = sql`UPDATE public.job_outbox SET run_lease_until = now() - interval '1 second' WHERE id = $1::uuid`

/** The one durable identity admitted by the foreign-lease broker proof. */
const FENCING_OUTBOX = sql`SELECT id, state, attempts FROM public.job_outbox WHERE dedupe_key = $1 LIMIT 1`

/** The proof leaves no durable queue admission after its relay has stopped. */
const CLEAN_FENCING_OUTBOX = sql`DELETE FROM public.job_outbox WHERE id = $1`

/** The persisted admission observed independently of the broker state. */
export interface FencingOutboxRow {
    readonly id: string
    readonly state: string
    readonly attempts: number
}

/** The durable admission of the foreign-lease proof, found by its dedupe key. */
export const fencingOutbox = (manager: EntityManager, dedupeKey: string): Promise<Array<FencingOutboxRow>> =>
    manager.query<Array<FencingOutboxRow>>(FENCING_OUTBOX, [dedupeKey])

/** Removes the claim and the queue admission of the isolated outbox identity, so cleanup cannot affect another proof. */
export const cleanFencingRows = async (manager: EntityManager, outboxId: string): Promise<void> => {
    await manager.delete(JobEntity, { jobKey: outboxId })
    await manager.query(CLEAN_FENCING_OUTBOX, [outboxId])
}

/** The durable broker identity of an accepted public API request. */
export interface PublicApiRedisJob {
    readonly id: string
    readonly state: string
}

/** The durable broker identity of the job an accepted public API request produced. */
export const apiRedisJob = (manager: EntityManager, requestId: string): Promise<Array<PublicApiRedisJob>> =>
    manager.query<Array<PublicApiRedisJob>>(API_REDIS_JOB, [requestId])

/** Models the persisted lease left by a crashed holder, without changing its admitted identity. */
export const lapseRedisJob = async (manager: EntityManager, id: string): Promise<void> => {
    await manager.query(LAPSE_REDIS_JOB, [id])
}

/** An operator's actual retry door, under the same outbox id. */
export const requeueRedisJob = async (manager: EntityManager, id: string): Promise<void> => {
    await callDbFunction(manager, "public.job_reopen", [id])
}

/** The durable admission of one proof job, observed independently of the broker. */
export interface PersistedRedisJob {
    readonly id: string
    readonly state: string
    readonly attempts: number
}

/** Polls persisted state or the actual broker until the proof's condition holds, with a fixed deadline. */
export const waitForProof = <T>(
    read: () => Promise<T>,
    ready: (value: T) => boolean,
    timeoutMs = 10000,
): Promise<T> => {
    const deadline = Date.now() + timeoutMs
    const poll = async (): Promise<T> => {
        const value = await read()
        if (!ready(value) && Date.now() < deadline) {
            await new Promise<void>((resolve) => setTimeout(resolve, 20))
            return poll()
        }
        assert(ready(value), "Private Redis proof must settle before its deadline")
        return value
    }
    return poll()
}

/** Uses the production transport rather than a broker double or a reconstructed outbox envelope. */
export const transportOf = (world: LiteWorld): QueueTransport => world.resolve<QueueTransport>(QUEUE_TRANSPORT)

/** Starts the real committed-row relay and registers its shutdown before the world's database closes. */
export const startQueueRelay = (world: LiteWorld): QueueRelayService => {
    const relay = world.resolve(QueueRelayService)
    relay.onApplicationBootstrap()
    world.cleanup(() => relay.onApplicationShutdown())
    return relay
}

/** Writes proof jobs through the real outbox and reads back their durable admission. */
export const redisJobProof = (world: LiteWorld) => {
    const rowOf = async (key: string): Promise<PersistedRedisJob> => {
        const [row] = await world.db.primary.query<Array<PersistedRedisJob>>(REDIS_JOB, [key])
        assert(row !== undefined)
        return row
    }
    const enqueue = async (queue: string, key: string): Promise<PersistedRedisJob> => {
        world.cleanup(() => world.db.primary.query(CLEAN_REDIS_JOB, [key]))
        await world.db.primary.transaction((tx) =>
            world.resolve<QueueOutbox>(QUEUE_OUTBOX).write(tx, queue, { proofId: key }, { dedupeKey: key }),
        )
        return rowOf(key)
    }
    return { rowOf, enqueue }
}
