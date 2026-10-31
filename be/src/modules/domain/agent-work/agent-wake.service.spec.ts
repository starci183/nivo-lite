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

const build = async (answer: QueryBuilderAnswers) => {
    const queue = mock<AgentTurnQueue>({ enqueueDrain: jest.fn().mockResolvedValue(undefined) })
    const logger = mock<Logger>()
    const tx = mockEntityManager()
    const [fake] = queueQueryBuilders(tx, [answer])
    const container = await Test.createTestingModule({
        providers: [
            AgentWakeService,
            { provide: AGENT_TURN_QUEUE_PRODUCER, useValue: queue },
            { provide: LOGGER, useValue: logger },
        ],
    }).compile()
    return { service: container.get(AgentWakeService), queue, logger, tx, fake }
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
                    context: { messageId: "msg-1", room: "sales" },
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
        )
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
