import { Test } from "@nestjs/testing"
import { mock, mockEntityManager } from "@starci/jest-preset"
import { QUEUE_OUTBOX } from "@modules/platform/queue"
import type { QueueOutbox } from "@modules/platform/queue"
import { AgentTurnQueue } from "./agent-turn.queue"

const PAYLOAD = { workspaceId: "ws-1", agentId: "agent-1", scopeKey: "conversation:c1" }

const build = async () => {
    const outbox = mock<QueueOutbox>()
    outbox.write.mockResolvedValue(undefined)
    const moduleRef = await Test.createTestingModule({
        providers: [AgentTurnQueue, { provide: QUEUE_OUTBOX, useValue: outbox }],
    }).compile()
    return { queue: moduleRef.get(AgentTurnQueue), outbox, tx: mockEntityManager() }
}

describe("AgentTurnQueue", () => {
    it("writes the drain of a new wake once per fact, and lets it wait the delay it is given", async () => {
        const { queue, outbox, tx } = await build()

        await queue.enqueueDrain(PAYLOAD, "customer", "msg-1", tx, 3000)
        await queue.enqueueDrain(PAYLOAD, "tag", "evt-1", tx)

        expect(outbox.write).toHaveBeenNthCalledWith(1, tx, "agent_turn", PAYLOAD, {
            job: "agent-turn.drain",
            dedupeKey: "agent-turn:agent-1:customer:msg-1",
            delayMs: 3000,
        })
        expect(outbox.write).toHaveBeenNthCalledWith(2, tx, "agent_turn", PAYLOAD, {
            job: "agent-turn.drain",
            dedupeKey: "agent-turn:agent-1:tag:evt-1",
            delayMs: 0,
        })
    })

    it("starts the next drain of a finished turn and the sweep drain of a stuck scope at once", async () => {
        const { queue, outbox, tx } = await build()

        await queue.enqueueNextDrain(PAYLOAD, "turn-1", tx)
        await queue.enqueueSweepDrain(PAYLOAD, new Date(120_000), tx)

        expect(outbox.write).toHaveBeenNthCalledWith(
            1,
            tx,
            "agent_turn",
            PAYLOAD,
            expect.objectContaining({ dedupeKey: "agent-turn:agent-1:next:turn-1" }),
        )
        expect(outbox.write).toHaveBeenNthCalledWith(
            2,
            tx,
            "agent_turn",
            PAYLOAD,
            expect.objectContaining({ dedupeKey: "agent-turn:agent-1:sweep:conversation:c1:2" }),
        )
    })
})
