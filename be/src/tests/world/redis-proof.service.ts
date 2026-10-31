import assert from "node:assert/strict"
import { callDbFunction } from "@modules/platform/database"
import { jobsEntities } from "@modules/platform/jobs"
import { QUEUE_OUTBOX } from "@modules/platform/queue"
import type { QueueOutbox } from "@modules/platform/queue"
import { QUEUE_TRANSPORT } from "../../modules/platform/queue/queue.decorators"
import { QueueRelayService } from "../../modules/platform/queue/queue-relay.service"
import type { QueueTransport } from "../../modules/platform/queue/queue-transport.port"
import type { EntityManager } from "typeorm"
import type { LiteWorld } from "./lite-world.service"

const [JobEntity, JobOutboxEntity] = jobsEntities

/** How long ago a crashed holder's lease ended. */
const LAPSED_MS = 1000

/** The persisted admission observed independently of the broker state. */
export interface FencingOutboxRow {
    readonly id: string
    readonly state: string
    readonly attempts: number
}

/** The durable admission of the foreign-lease proof, found by its dedupe key. */
export const fencingOutbox = async (manager: EntityManager, dedupeKey: string): Promise<Array<FencingOutboxRow>> => {
    const rows = await manager.find(JobOutboxEntity, { where: { dedupeKey }, take: 1 })
    return rows.map(({ id, state, attempts }) => ({ id, state, attempts }))
}

/** Removes the claim and the queue admission of the isolated outbox identity, so cleanup cannot affect another proof. */
export const cleanFencingRows = async (manager: EntityManager, outboxId: string): Promise<void> => {
    await manager.delete(JobEntity, { jobKey: outboxId })
    await manager.delete(JobOutboxEntity, { id: outboxId })
}

/** The durable broker identity of an accepted public API request. */
export interface PublicApiRedisJob {
    readonly id: string
    readonly state: string
}

/** The durable broker identity of the job an accepted public API request produced. */
export const apiRedisJob = async (manager: EntityManager, requestId: string): Promise<Array<PublicApiRedisJob>> => {
    const rows = await manager
        .createQueryBuilder(JobOutboxEntity, "o")
        .select(["o.id", "o.state"])
        .where("o.queue = 'public_api' AND o.payload->>'requestId' = :requestId", { requestId })
        .getMany()
    return rows.map(({ id, state }) => ({ id, state }))
}

/** Models the persisted lease left by a crashed holder, without changing its admitted identity. */
export const lapseRedisJob = async (manager: EntityManager, id: string): Promise<void> => {
    await manager.update(JobOutboxEntity, { id }, { runLeaseUntil: new Date(Date.now() - LAPSED_MS) })
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
        const row = await world.db.primary.findOne(JobOutboxEntity, { where: { dedupeKey: key } })
        assert(row !== null)
        return { id: row.id, state: row.state, attempts: row.attempts }
    }
    const enqueue = async (queue: string, key: string): Promise<PersistedRedisJob> => {
        world.cleanup(async () => {
            await world.db.primary.delete(JobOutboxEntity, { dedupeKey: key })
        })
        await world.db.primary.transaction((tx) =>
            world.resolve<QueueOutbox>(QUEUE_OUTBOX).write(tx, queue, { proofId: key }, { dedupeKey: key }),
        )
        return rowOf(key)
    }
    return { rowOf, enqueue }
}
