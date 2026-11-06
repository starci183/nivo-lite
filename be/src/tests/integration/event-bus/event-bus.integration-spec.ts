import {
    BANK_CREDIT_BOOKED_AGENT_WAKES_TOPIC_QUEUE,
    KNOWLEDGE_SOURCE_INDEXED_AGENT_WAKES_TOPIC_QUEUE,
    KNOWLEDGE_SOURCE_INDEXED_BRAIN_TOPIC_QUEUE,
} from "@modules/platform/event-bus"
import { InboxService } from "@modules/platform/inbox"
import { eachInOrder } from "@modules/platform/primitives"
import { SpecEvent, drainRounds, openEventBusProof, pause } from "../../world/event-bus-proof.service"
import type { EventBusProof } from "../../world/event-bus-proof.service"
import { TestWorldError, TestWorldErrorCode } from "../../world/test-world.error"
import { useTestWorld } from "../../world/use-test-world"

/**
 * The event bus against a real Postgres with pgmq 1.13.1, connected as the application role (the world grants the local role creator
 * the role for the run). The world's own connection is the owner connection that counts queue rows and resets them, because the
 * application role holds no grant on the pgmq schema. The database has the whole db/migrations chain applied.
 */
const world = useTestWorld({ modules: [] })

const RUN = world.prefix
const FANOUT_TOPIC = "knowledge_source_indexed"
const SINGLE_TOPIC = "bank_credit_booked"
/** The live fan-out: one `knowledge_source_indexed` event reaches the brain and the agent wakes consumers. */
const FANOUT_QUEUES = [KNOWLEDGE_SOURCE_INDEXED_BRAIN_TOPIC_QUEUE, KNOWLEDGE_SOURCE_INDEXED_AGENT_WAKES_TOPIC_QUEUE]
/** A topic with one live consumer: `bank_credit_booked` reaches the agent wakes consumer alone. */
const SINGLE_QUEUE = BANK_CREDIT_BOOKED_AGENT_WAKES_TOPIC_QUEUE
const ALL_QUEUES = [...FANOUT_QUEUES, SINGLE_QUEUE]
const SINGLE_Q = `q_${SINGLE_QUEUE}`
const SINGLE_ARCHIVE = `a_${SINGLE_QUEUE}`

/** The proof opened by `beforeAll`. */
interface OpenedProof {
    current?: EventBusProof
}

const proof: OpenedProof = {}
const bus = (): EventBusProof => {
    if (proof.current === undefined) {
        throw new TestWorldError({ code: TestWorldErrorCode.RowMissing, params: { proof: "event-bus" } })
    }
    return proof.current
}

beforeAll(async () => {
    proof.current = await openEventBusProof(world)
})

beforeEach(async () => {
    jest.clearAllMocks()
    await bus().reset(
        ALL_QUEUES.flatMap((queue) => [`q_${queue}`, `a_${queue}`, `q_${queue}__dead`, `a_${queue}__dead`]),
    )
})

describe("event-bus publishing", () => {
    it("event-bus/atomic-with-transaction: the event and the domain write commit together or not at all", async () => {
        const { app, publisher, count } = bus()
        const inbox = new InboxService()
        const publishWithWrite = (key: string, fail: boolean): Promise<void> =>
            app.transaction(async (manager) => {
                await publisher.publish(
                    new SpecEvent(SINGLE_TOPIC, "e", { dedupeKey: key, subjectId: "1" }),
                    manager,
                    "request-1",
                )
                await inbox.claim("atomic-proof", key, manager)
                if (fail) throw new TestWorldError({ code: TestWorldErrorCode.ProviderDown })
            })
        const keptKey = `atomic-kept:${RUN}`
        const lostKey = `atomic-lost:${RUN}`

        await publishWithWrite(keptKey, false)
        await expect(publishWithWrite(lostKey, true)).rejects.toMatchObject({ code: TestWorldErrorCode.ProviderDown })

        expect(await count(SINGLE_Q)).toBe(1)
        await expect(app.transaction((manager) => inbox.claim("atomic-proof", keptKey, manager))).resolves.toBe(false)
        await expect(app.transaction((manager) => inbox.claim("atomic-proof", lostKey, manager))).resolves.toBe(true)
    })

    it("event-bus/relay-only-after-commit: nothing is visible before the commit, and a rolled-back publish sends nothing", async () => {
        const { app, publisher, count } = bus()
        const seen: Array<number> = []
        const publishOnce = (key: string, fail: boolean): Promise<void> =>
            app.transaction(async (manager) => {
                await publisher.publish(
                    new SpecEvent(SINGLE_TOPIC, "e", { dedupeKey: key, subjectId: "1" }),
                    manager,
                    "request-1",
                )
                seen.push(await count(SINGLE_Q))
                if (fail) throw new TestWorldError({ code: TestWorldErrorCode.ProviderDown })
            })

        await expect(publishOnce(`rb:${RUN}`, true)).rejects.toMatchObject({ code: TestWorldErrorCode.ProviderDown })
        expect(await count(SINGLE_Q)).toBe(0)
        await publishOnce(`cm:${RUN}`, false)

        expect(seen).toEqual([0, 0])
        expect(await count(SINGLE_Q)).toBe(1)
    })

    it("event-bus/commit: one publish reaches two consumers, each exactly once, then is archived", async () => {
        const { publish, runnerOf, door, count } = bus()
        const effects: Array<string> = []
        const runner = runnerOf()
        await publish(FANOUT_TOPIC, `src:${RUN}`)
        expect(await Promise.all(FANOUT_QUEUES.map((queue) => count(`q_${queue}`)))).toEqual([1, 1])

        await eachInOrder(FANOUT_QUEUES, async (queue) => {
            await expect(runner.drain({ queue, consumer: door(effects), maxDeliveries: 5 })).resolves.toBe(1)
            await expect(runner.drain({ queue, consumer: door(effects), maxDeliveries: 5 })).resolves.toBe(0)
        })

        expect(effects).toEqual(FANOUT_QUEUES.map((queue) => `${queue}:src:${RUN}:1`))
        expect(await Promise.all(FANOUT_QUEUES.map((queue) => count(`a_${queue}`)))).toEqual([1, 1])
    })

    it("event-bus/no-direct-pgmq: the application role cannot reach the pgmq schema", async () => {
        await expect(bus().appIsRefusedPgmq()).resolves.toBe(true)
    })
})

describe("event-bus delivery", () => {
    it("event-bus/redelivery: a throwing consumer is delivered again after the visibility timeout", async () => {
        const { publish, runnerOf, door, count, logger } = bus()
        const effects: Array<string> = []
        const state = { failing: true }
        const runner = runnerOf({ visibilitySeconds: 1 })
        const subscription = {
            queue: SINGLE_QUEUE,
            consumer: door(effects, () => state.failing),
            maxDeliveries: 5,
        }
        await publish(SINGLE_TOPIC, `rd:${RUN}`)

        await runner.drain(subscription)
        expect(await count(SINGLE_ARCHIVE)).toBe(0)
        await expect(runner.drain(subscription)).resolves.toBe(0)
        state.failing = false
        await pause(1200)
        await runner.drain(subscription)

        expect(effects).toEqual([`${SINGLE_QUEUE}:rd:${RUN}:2`])
        expect(await count(SINGLE_ARCHIVE)).toBe(1)
        expect(logger.error).toHaveBeenCalledTimes(1)
    })

    it("event-bus/duplicate-delivery-is-a-noop: a duplicate dedupeKey is processed once", async () => {
        const { publish, runnerOf, door, count } = bus()
        const effects: Array<string> = []
        const runner = runnerOf()
        await publish(SINGLE_TOPIC, `same:${RUN}`)
        await publish(SINGLE_TOPIC, `same:${RUN}`)

        await expect(runner.drain({ queue: SINGLE_QUEUE, consumer: door(effects), maxDeliveries: 5 })).resolves.toBe(2)

        expect(effects).toEqual([`${SINGLE_QUEUE}:same:${RUN}:1`])
        expect(await count(SINGLE_ARCHIVE)).toBe(2)
    })
})

describe("event-bus dead letters", () => {
    it("event-bus/redelivery-then-dead-letter: a failing consumer is retried, then buried past maxDeliveries, and can be requeued", async () => {
        const { publish, runnerOf, door, count, logger, publisher } = bus()
        const effects: Array<string> = []
        const runner = runnerOf({ visibilitySeconds: 1 })
        const subscription = {
            queue: SINGLE_QUEUE,
            consumer: door(effects, () => true),
            maxDeliveries: 2,
        }
        await publish(SINGLE_TOPIC, `poison:${RUN}`)

        await drainRounds(3, async () => {
            await runner.drain(subscription)
            await pause(1200)
        })

        expect(logger.error).toHaveBeenCalledTimes(2)
        expect(logger.warn).toHaveBeenCalledWith(
            "event-bus.delivery.dead",
            expect.objectContaining({ consumer: SINGLE_QUEUE, reason: "max-deliveries" }),
        )
        expect(await count(SINGLE_Q)).toBe(0)
        const dead = await publisher.deadLetters(SINGLE_QUEUE, 10)
        expect(dead).toHaveLength(1)
        expect(dead[0]).toMatchObject({ reason: "max-deliveries", readCount: 3 })

        await expect(publisher.requeue(SINGLE_QUEUE, dead[0]?.id ?? "")).resolves.toBe(true)
        expect(await count(SINGLE_Q)).toBe(1)
        expect(await count(`${SINGLE_Q}__dead`)).toBe(0)
    })
})
