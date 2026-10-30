import {
    LEAD_CAPTURED_AUTOMATIONS_TOPIC_QUEUE,
    PAYMENT_RECONCILED_AUTOMATIONS_TOPIC_QUEUE,
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
const PAYMENT_QUEUES = ["contracts", "automations", "payment_receipts", "care"].map(
    (consumer) => `payment_reconciled__${consumer}`,
)
const ALL_QUEUES = [...PAYMENT_QUEUES, LEAD_CAPTURED_AUTOMATIONS_TOPIC_QUEUE]
const LEAD_QUEUE = `q_${LEAD_CAPTURED_AUTOMATIONS_TOPIC_QUEUE}`
const LEAD_ARCHIVE = `a_${LEAD_CAPTURED_AUTOMATIONS_TOPIC_QUEUE}`

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
                    new SpecEvent("lead_captured", "e", { dedupeKey: key, subjectId: "1" }),
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

        expect(await count(LEAD_QUEUE)).toBe(1)
        await expect(app.transaction((manager) => inbox.claim("atomic-proof", keptKey, manager))).resolves.toBe(false)
        await expect(app.transaction((manager) => inbox.claim("atomic-proof", lostKey, manager))).resolves.toBe(true)
    })

    it("event-bus/relay-only-after-commit: nothing is visible before the commit, and a rolled-back publish sends nothing", async () => {
        const { app, publisher, count } = bus()
        const seen: Array<number> = []
        const publishOnce = (key: string, fail: boolean): Promise<void> =>
            app.transaction(async (manager) => {
                await publisher.publish(
                    new SpecEvent("lead_captured", "e", { dedupeKey: key, subjectId: "1" }),
                    manager,
                    "request-1",
                )
                seen.push(await count(LEAD_QUEUE))
                if (fail) throw new TestWorldError({ code: TestWorldErrorCode.ProviderDown })
            })

        await expect(publishOnce(`rb:${RUN}`, true)).rejects.toMatchObject({ code: TestWorldErrorCode.ProviderDown })
        expect(await count(LEAD_QUEUE)).toBe(0)
        await publishOnce(`cm:${RUN}`, false)

        expect(seen).toEqual([0, 0])
        expect(await count(LEAD_QUEUE)).toBe(1)
    })

    it("event-bus/commit: one publish reaches two consumers, each exactly once, then is archived", async () => {
        const { publish, runnerOf, door, count } = bus()
        const effects: Array<string> = []
        const runner = runnerOf()
        await publish("payment_reconciled", `pay:${RUN}`)
        expect(await Promise.all(PAYMENT_QUEUES.map((queue) => count(`q_${queue}`)))).toEqual([1, 1, 1, 1])

        await eachInOrder(PAYMENT_QUEUES.slice(0, 2), async (queue) => {
            await expect(runner.drain({ queue, consumer: door(effects), maxDeliveries: 5 })).resolves.toBe(1)
            await expect(runner.drain({ queue, consumer: door(effects), maxDeliveries: 5 })).resolves.toBe(0)
        })

        expect(effects).toEqual([
            `payment_reconciled__contracts:pay:${RUN}:1`,
            `payment_reconciled__automations:pay:${RUN}:1`,
        ])
        expect(await count("a_payment_reconciled__contracts")).toBe(1)
        expect(await count("a_payment_reconciled__automations")).toBe(1)
        expect(await count("q_payment_reconciled__care")).toBe(1)
    })

    it("event-bus/no-direct-pgmq: the application role cannot reach the pgmq schema", async () => {
        await expect(bus().appIsRefusedPgmq()).resolves.toBe(true)
        expect(PAYMENT_RECONCILED_AUTOMATIONS_TOPIC_QUEUE).toBe("payment_reconciled__automations")
    })
})

describe("event-bus delivery", () => {
    it("event-bus/redelivery: a throwing consumer is delivered again after the visibility timeout", async () => {
        const { publish, runnerOf, door, count, logger } = bus()
        const effects: Array<string> = []
        const state = { failing: true }
        const runner = runnerOf({ visibilitySeconds: 1 })
        const subscription = {
            queue: LEAD_CAPTURED_AUTOMATIONS_TOPIC_QUEUE,
            consumer: door(effects, () => state.failing),
            maxDeliveries: 5,
        }
        await publish("lead_captured", `rd:${RUN}`)

        await runner.drain(subscription)
        expect(await count(LEAD_ARCHIVE)).toBe(0)
        await expect(runner.drain(subscription)).resolves.toBe(0)
        state.failing = false
        await pause(1200)
        await runner.drain(subscription)

        expect(effects).toEqual([`lead_captured__automations:rd:${RUN}:2`])
        expect(await count(LEAD_ARCHIVE)).toBe(1)
        expect(logger.error).toHaveBeenCalledTimes(1)
    })

    it("event-bus/duplicate-delivery-is-a-noop: a duplicate dedupeKey is processed once", async () => {
        const { publish, runnerOf, door, count } = bus()
        const effects: Array<string> = []
        const runner = runnerOf()
        await publish("lead_captured", `same:${RUN}`)
        await publish("lead_captured", `same:${RUN}`)

        await expect(
            runner.drain({ queue: LEAD_CAPTURED_AUTOMATIONS_TOPIC_QUEUE, consumer: door(effects), maxDeliveries: 5 }),
        ).resolves.toBe(2)

        expect(effects).toEqual([`lead_captured__automations:same:${RUN}:1`])
        expect(await count(LEAD_ARCHIVE)).toBe(2)
    })
})

describe("event-bus dead letters", () => {
    it("event-bus/redelivery-then-dead-letter: a failing consumer is retried, then buried past maxDeliveries, and can be requeued", async () => {
        const { publish, runnerOf, door, count, logger, publisher } = bus()
        const effects: Array<string> = []
        const runner = runnerOf({ visibilitySeconds: 1 })
        const subscription = {
            queue: LEAD_CAPTURED_AUTOMATIONS_TOPIC_QUEUE,
            consumer: door(effects, () => true),
            maxDeliveries: 2,
        }
        await publish("lead_captured", `poison:${RUN}`)

        await drainRounds(3, async () => {
            await runner.drain(subscription)
            await pause(1200)
        })

        expect(logger.error).toHaveBeenCalledTimes(2)
        expect(logger.warn).toHaveBeenCalledWith(
            "event-bus.delivery.dead",
            expect.objectContaining({ consumer: LEAD_CAPTURED_AUTOMATIONS_TOPIC_QUEUE, reason: "max-deliveries" }),
        )
        expect(await count(LEAD_QUEUE)).toBe(0)
        const dead = await publisher.deadLetters(LEAD_CAPTURED_AUTOMATIONS_TOPIC_QUEUE, 10)
        expect(dead).toHaveLength(1)
        expect(dead[0]).toMatchObject({ reason: "max-deliveries", readCount: 3 })

        await expect(publisher.requeue(LEAD_CAPTURED_AUTOMATIONS_TOPIC_QUEUE, dead[0]?.id ?? "")).resolves.toBe(true)
        expect(await count(LEAD_QUEUE)).toBe(1)
        expect(await count(`${LEAD_QUEUE}__dead`)).toBe(0)
    })
})
