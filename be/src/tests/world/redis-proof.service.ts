import assert from "node:assert/strict"
import { QUEUE_OUTBOX } from "@modules/platform/queue"
import type { QueueOutbox } from "@modules/platform/queue"
import { QUEUE_TRANSPORT } from "../../modules/platform/queue/queue.decorators"
import { QueueRelayService } from "../../modules/platform/queue/queue-relay.service"
import type { QueueTransport } from "../../modules/platform/queue/queue-transport.port"
import { CLEAN_REDIS_JOB, REDIS_JOB } from "../fixtures/persistence/redis-proof.sql"
import type { LiteWorld } from "./lite-world.service"

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
