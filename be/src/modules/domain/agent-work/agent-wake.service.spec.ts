import { Test } from "@nestjs/testing"
import { mock, mockEntityManager, recordingQueueOutbox } from "@starci/jest-preset"
import { agentTurnQueueProviderOf, agentWakeOf as wake } from "@tests/fixtures/builders/agent-work.builder"
import { queueQueryBuilders } from "@tests/fixtures/builders/entity-query-builder-fake.builder"
import type { QueryBuilderAnswers } from "@tests/fixtures/builders/entity-query-builder-fake.builder"
import { LOGGER } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { AgentWakeService } from "./agent-wake.service"

const inserted = (...ids: Array<string>): QueryBuilderAnswers => ({ execute: { raw: ids.map((id) => ({ id })) } })

const build = async (answer: QueryBuilderAnswers) => {
    const outbox = recordingQueueOutbox()
    const logger = mock<Logger>()
    const tx = mockEntityManager()
    const [fake] = queueQueryBuilders(tx, [answer])
    const container = await Test.createTestingModule({
        providers: [AgentWakeService, agentTurnQueueProviderOf(outbox), { provide: LOGGER, useValue: logger }],
    }).compile()
    return { service: container.get(AgentWakeService), outbox, logger, tx, fake }
}

describe("AgentWakeService.wake", () => {
    it("writes a new fact once, with its priority, budget and scope, and starts its drain in the same transaction", async () => {
        const { service, outbox, tx, fake } = await build(inserted("wake-1"))

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
        expect(outbox.jobsOf("agent_turn")).toEqual([
            { queue: "agent_turn", payload: { workspaceId: "ws-1", agentId: "agent-1", scopeKey: "agent" } },
        ])
        expect(outbox.entries[0]?.tx).toBe(tx)
    })

    it("locks a customer wake by its conversation and gives it the shortest budget", async () => {
        const { service, outbox, tx, fake } = await build(inserted("wake-2"))

        await service.wake(tx, wake({ source: "customer", context: { conversationId: "conv-1" } }))

        expect(fake?.callsOf("values")[0]?.[0]).toMatchObject({
            scopeKey: "conversation:conv-1",
            priority: 10,
            maxAttempts: 2,
        })
        expect(outbox.jobs).toEqual([
            {
                queue: "agent_turn",
                payload: { workspaceId: "ws-1", agentId: "agent-1", scopeKey: "conversation:conv-1" },
            },
        ])
    })

    it("writes nothing and enqueues nothing when the fact was already written", async () => {
        const { service, outbox, logger, tx } = await build(inserted())

        await expect(service.wake(tx, wake())).resolves.toBe(false)

        expect(outbox.jobs).toEqual([])
        expect(logger.info).not.toHaveBeenCalled()
    })

    it("leaves the transaction to roll back when the job cannot be written", async () => {
        const { service, outbox, tx } = await build(inserted("wake-3"))
        outbox.failNext("write", new Error("outbox down"))

        await expect(service.wake(tx, wake())).rejects.toThrow("outbox down")
    })
})
