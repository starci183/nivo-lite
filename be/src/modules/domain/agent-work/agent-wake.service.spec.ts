import { AGENT_BURST_POLICY, AGENT_WORK_OPTIONS } from "./agent-work.decorators"
import type { AgentWorkOptions } from "./agent-work.options"
import type { AgentBurstPolicy, OptionalBurstSetting } from "./agent-work.port"
import { Test } from "@nestjs/testing"
import { mock, mockEntityManager } from "@starci/jest-preset"
import { agentWakeOf as wake } from "@tests/fixtures/builders/agent-work.builder"
import { queueQueryBuilders } from "@tests/fixtures/builders/entity-query-builder-fake.builder"
import type { QueryBuilderAnswers } from "@tests/fixtures/builders/entity-query-builder-fake.builder"
import { LOGGER } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { AGENT_TURN_QUEUE_PRODUCER } from "@modules/queues/agent-turn"
import type { AgentTurnQueue } from "@modules/queues/agent-turn"
import { AgentWakeService } from "./agent-wake.service"

const inserted = (...ids: Array<string>): QueryBuilderAnswers => ({ execute: { raw: ids.map((id) => ({ id })) } })

/** The service with the app root's options and a burst policy that answers `asked` for every source. */
const build = async (answer: QueryBuilderAnswers, options?: AgentWorkOptions, asked: OptionalBurstSetting = null) => {
    const settings = { debounceMs: options?.debounceMs, debounceMaxMs: options?.debounceMaxMs }
    const bursts = mock<AgentBurstPolicy>({ burstOf: jest.fn().mockResolvedValue(asked) })
    const queue = mock<AgentTurnQueue>({ enqueueDrain: jest.fn().mockResolvedValue(undefined) })
    const logger = mock<Logger>()
    const tx = mockEntityManager()
    const [fake] = queueQueryBuilders(tx, [answer])
    const container = await Test.createTestingModule({
        providers: [
            AgentWakeService,
            { provide: AGENT_TURN_QUEUE_PRODUCER, useValue: queue },
            { provide: LOGGER, useValue: logger },
            { provide: AGENT_WORK_OPTIONS, useValue: settings },
            { provide: AGENT_BURST_POLICY, useValue: bursts },
        ],
    }).compile()
    return { service: container.get(AgentWakeService), queue, logger, tx, fake, bursts }
}

describe("AgentWakeService.wake", () => {
    it("writes a new fact once, with its priority, budget and scope, and starts its drain in the same transaction", async () => {
        const { service, queue, tx, fake } = await build(inserted("wake-1"))

        await expect(service.wake(tx, wake())).resolves.toBe(true)

        expect(fake?.callsOf("values")).toEqual([
            [
                {
                    workspaceId: "ws-1",
                    agentId: "agent-1",
                    source: "tag",
                    eventKey: "msg-1",
                    scopeKey: "agent",
                    priority: 20,
                    maxAttempts: 3,
                    background: false,
                    context: { messageId: "msg-1", room: "sales" },
                    burstWindowMs: null,
                    burstMaxMs: null,
                    actorMemberId: "member-1",
                },
            ],
        ])
        expect(fake?.callsOf("orIgnore")).toEqual([[]])
        expect(queue.enqueueDrain).toHaveBeenCalledWith(
            { workspaceId: "ws-1", agentId: "agent-1", scopeKey: "agent" },
            "tag",
            "msg-1",
            tx,
            0,
        )
    })

    it("locks a customer wake by its conversation and gives it the shortest budget", async () => {
        const { service, queue, tx, fake } = await build(inserted("wake-2"))

        await service.wake(tx, wake({ source: "customer", context: { conversationId: "conv-1" } }))

        expect(fake?.callsOf("values")[0]?.[0]).toMatchObject({
            scopeKey: "conversation:conv-1",
            priority: 10,
            maxAttempts: 2,
        })
        expect(queue.enqueueDrain).toHaveBeenCalledWith(
            { workspaceId: "ws-1", agentId: "agent-1", scopeKey: "conversation:conv-1" },
            "customer",
            "msg-1",
            tx,
            6000,
        )
    })
})

describe("AgentWakeService burst window", () => {
    const customer = wake({
        source: "customer",
        eventKey: "msg-2",
        context: { conversationId: "conv-1", messageId: "msg-2" },
    })

    it("makes the drain of a conversation wake wait the window the app root named", async () => {
        const { service, queue, tx } = await build(inserted("wake-1"), { debounceMs: 5000 })

        await service.wake(tx, customer)

        expect(queue.enqueueDrain).toHaveBeenCalledWith(expect.anything(), "customer", "msg-2", tx, 5000)
    })

    it("drains a conversation wake at once when the window is off", async () => {
        const { service, queue, tx } = await build(inserted("wake-1"), { debounceMs: 0 })

        await service.wake(tx, customer)

        expect(queue.enqueueDrain).toHaveBeenCalledWith(expect.anything(), "customer", "msg-2", tx, 0)
    })
})

describe("AgentWakeService burst from the flow", () => {
    const customer = wake({
        source: "customer",
        eventKey: "msg-3",
        context: { conversationId: "conv-1", messageId: "msg-3" },
        actorMemberId: null,
    })

    it("resolves the burst of a conversation wake once, from the flow, keeps it on the wake and waits the flow's window", async () => {
        const { service, queue, tx, fake, bursts } = await build(
            inserted("wake-1"),
            { debounceMs: 1000 },
            { windowMs: 6000, maxWaitMs: 20_000 },
        )

        await service.wake(tx, customer)

        expect(bursts.burstOf).toHaveBeenCalledTimes(1)
        expect(bursts.burstOf).toHaveBeenCalledWith("ws-1", "agent-1", "channel")
        expect(fake?.callsOf("values")[0]?.[0]).toMatchObject({ burstWindowMs: 6000, burstMaxMs: 20_000 })
        expect(queue.enqueueDrain).toHaveBeenCalledWith(expect.anything(), "customer", "msg-3", tx, 6000)
    })

    it("takes the app's defaults for what the flow leaves open, and the flow's zero turns the window off", async () => {
        const open = await build(
            inserted("wake-1"),
            { debounceMs: 1000, debounceMaxMs: 9000 },
            { windowMs: 4000, maxWaitMs: null },
        )
        const off = await build(inserted("wake-1"), { debounceMs: 1000 }, { windowMs: 0, maxWaitMs: null })
        const silent = await build(inserted("wake-1"), { debounceMs: 1000 }, null)

        await open.service.wake(open.tx, customer)
        await off.service.wake(off.tx, customer)
        await silent.service.wake(silent.tx, customer)

        expect(open.fake?.callsOf("values")[0]?.[0]).toMatchObject({ burstWindowMs: 4000, burstMaxMs: 9000 })
        expect(off.queue.enqueueDrain).toHaveBeenCalledWith(expect.anything(), "customer", "msg-3", off.tx, 0)
        expect(silent.fake?.callsOf("values")[0]?.[0]).toMatchObject({ burstWindowMs: 1000, burstMaxMs: 20_000 })
    })

    it("asks the flow nothing for a wake that is not locked to a conversation", async () => {
        const { service, tx, fake, bursts } = await build(inserted("wake-1"), undefined, {
            windowMs: 6000,
            maxWaitMs: null,
        })

        await service.wake(tx, wake())

        expect(bursts.burstOf).not.toHaveBeenCalled()
        expect(fake?.callsOf("values")[0]?.[0]).toMatchObject({ burstWindowMs: null, burstMaxMs: null })
    })
})

describe("AgentWakeService.write", () => {
    it("answers the id of the wake it wrote, and takes the scope an adapter asked for and the traits it declared", async () => {
        const { service, queue, tx, fake } = await build(inserted("wake-9"))

        await expect(
            service.write(tx, wake({ source: "tag", scopeKey: "order:o-1", eventKey: "evt-9" })),
        ).resolves.toBe("wake-9")

        expect(fake?.callsOf("values")[0]?.[0]).toMatchObject({
            scopeKey: "order:o-1",
            priority: 20,
            background: false,
        })
        expect(queue.enqueueDrain).toHaveBeenCalledWith(
            { workspaceId: "ws-1", agentId: "agent-1", scopeKey: "order:o-1" },
            "tag",
            "evt-9",
            tx,
            0,
        )
    })

    it("marks the wake of a background source so the day cap needs no name", async () => {
        const { service, tx, fake } = await build(inserted("wake-8"))

        await service.write(tx, wake({ source: "schedule" }))

        expect(fake?.callsOf("values")[0]?.[0]).toMatchObject({ background: true, priority: 40 })
    })

    it("refuses a wake of a source no adapter recorded", async () => {
        const { service, tx } = await build(inserted("wake-7"))

        await expect(service.write(tx, wake({ source: "nobody_registered" }))).rejects.toThrow()
    })

    it("answers null when the insert returns something that is not a row with an id", async () => {
        const { service, tx } = await build({ execute: { raw: [{ other: 1 }] } })

        await expect(service.write(tx, wake())).resolves.toBeNull()
    })

    it("writes nothing and enqueues nothing when the fact was already written", async () => {
        const { service, queue, logger, tx } = await build(inserted())

        await expect(service.wake(tx, wake())).resolves.toBe(false)

        expect(queue.enqueueDrain).not.toHaveBeenCalled()
        expect(logger.info).not.toHaveBeenCalled()
    })

    it("leaves the transaction to roll back when the job cannot be written", async () => {
        const { service, queue, tx } = await build(inserted("wake-3"))
        queue.enqueueDrain.mockRejectedValue(new Error("outbox down"))

        await expect(service.wake(tx, wake())).rejects.toThrow("outbox down")
    })
})

describe("AgentWakeService > absent insert receipts", () => {
    it("returns no wake id and enqueues no drain when the driver returns no row array", async () => {
        const { service, queue, logger, tx } = await build({ execute: { raw: null } })

        await expect(service.write(tx, wake())).resolves.toBeNull()

        expect(queue.enqueueDrain).not.toHaveBeenCalled()
        expect(logger.info).not.toHaveBeenCalled()
    })
})
