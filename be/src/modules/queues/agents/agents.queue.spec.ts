import { Test } from "@nestjs/testing"
import { mock, mockEntityManager } from "@starci/jest-preset"
import { QUEUE_OUTBOX } from "@modules/platform/queue"
import type { QueueOutbox } from "@modules/platform/queue"
import {
    AGENTS_QUEUE,
    AGENTS_SYNC_SCHEDULER,
    AgentsJob,
    isGenerateWithAgentPayload,
    isSyncAgentsPayload,
} from "./agents.contracts"
import { AgentsQueue } from "./agents.queue"

const build = async () => {
    const outbox = mock<QueueOutbox>({ write: jest.fn(() => Promise.resolve()) })
    const moduleRef = await Test.createTestingModule({
        providers: [AgentsQueue, { provide: QUEUE_OUTBOX, useValue: outbox }],
    }).compile()
    return { queue: moduleRef.get(AgentsQueue), outbox }
}

describe("AgentsQueue", () => {
    it("writes a sync of one installation keyed on it and the minute", async () => {
        const { queue, outbox } = await build()
        const tx = mockEntityManager()
        const payload = { workspaceId: "w1", installationId: "i1", requestedAt: 120_000 }

        await queue.enqueueSyncAgents(payload, tx)

        expect(outbox.write).toHaveBeenCalledWith(tx, AGENTS_QUEUE, payload, {
            job: AgentsJob.Sync,
            dedupeKey: "agents.sync:i1:2",
        })
    })

    it("keys a workspace sync on the workspace and a tick on all", async () => {
        const { queue, outbox } = await build()
        const tx = mockEntityManager()

        await queue.enqueueSyncAgents({ workspaceId: "w1" }, tx)
        await queue.enqueueSyncAgents({}, tx)

        expect(outbox.write).toHaveBeenNthCalledWith(
            1,
            tx,
            AGENTS_QUEUE,
            { workspaceId: "w1" },
            {
                job: AgentsJob.Sync,
                dedupeKey: "agents.sync:ws:w1",
            },
        )
        expect(outbox.write).toHaveBeenNthCalledWith(
            2,
            tx,
            AGENTS_QUEUE,
            {},
            {
                job: AgentsJob.Sync,
                dedupeKey: "agents.sync:all",
            },
        )
    })

    it("writes a generation keyed on its row", async () => {
        const { queue, outbox } = await build()
        const tx = mockEntityManager()
        const payload = { generationId: "g1", workspaceId: "w1" }

        await queue.enqueueGenerate(payload, tx)

        expect(outbox.write).toHaveBeenCalledWith(tx, AGENTS_QUEUE, payload, {
            job: AgentsJob.Generate,
            dedupeKey: "agents.generate:g1",
        })
    })
})

describe("agents payload guards", () => {
    it("accepts the shapes the producers write and refuses the rest", () => {
        expect(isSyncAgentsPayload({})).toBe(true)
        expect(isSyncAgentsPayload({ workspaceId: "w", installationId: "i", force: true, requestedAt: 1 })).toBe(true)
        expect(isSyncAgentsPayload({ force: "yes" })).toBe(false)
        expect(isSyncAgentsPayload("x")).toBe(false)
        expect(isSyncAgentsPayload(null)).toBe(false)
        expect(isGenerateWithAgentPayload({ generationId: "g", workspaceId: "w" })).toBe(true)
        expect(isGenerateWithAgentPayload({ generationId: "g" })).toBe(false)
        expect(isGenerateWithAgentPayload(3)).toBe(false)
    })

    it("schedules the sync tick every five minutes on the agents queue", () => {
        expect(AGENTS_SYNC_SCHEDULER).toEqual({
            queue: AGENTS_QUEUE,
            job: AgentsJob.Sync,
            id: "agents-sync-all",
            everyMs: 300_000,
        })
    })
})
