import { mockEntityManager } from "@starci/jest-preset"
import { Test } from "@nestjs/testing"
import { queueQueryBuilders } from "@tests/fixtures/builders/entity-query-builder-fake.builder"
import { AgentSpeakerQueueService } from "./agent-speaker-queue.service"
import { AgentSpeakerQueueEntity } from "./persistence/entities"

const TAG = {
    workspaceId: "ws-1",
    fromAgentId: "chat",
    toAgentId: "accounting",
    text: "Claim of 5,000",
    conversationId: "c1",
    eventKey: "claim:1",
}

const rowOf = (request: unknown, id = "q-1"): AgentSpeakerQueueEntity =>
    Object.assign(new AgentSpeakerQueueEntity(), {
        id,
        workspaceId: "ws-1",
        conversationId: "c1",
        toAgentId: "accounting",
        eventKey: "claim:1",
        request,
    })

const build = async () => {
    const moduleRef = await Test.createTestingModule({ providers: [AgentSpeakerQueueService] }).compile()
    return moduleRef.get(AgentSpeakerQueueService)
}

const WITH_DATA = { ...TAG, context: { claimKind: "transfer", items: [{ name: "Gio hoa" }] } }

describe("AgentSpeakerQueueService", () => {
    it("keeps a hand-off's plain data as JSON text and reads it back as it was", async () => {
        const tx = mockEntityManager()
        const [insert] = queueQueryBuilders(tx, [{ execute: { raw: [] } }])
        const stored = { ...TAG, contextJson: JSON.stringify(WITH_DATA.context) }
        const reading = mockEntityManager({
            findOne: [AgentSpeakerQueueEntity, rowOf(stored)],
            delete: [AgentSpeakerQueueEntity, { affected: 1 }],
        })

        await (await build()).keep(WITH_DATA, tx)

        expect(insert?.callsOf("values")).toEqual([[expect.objectContaining({ request: stored })]])
        await expect((await build()).takeNext("ws-1", "c1", reading)).resolves.toEqual(WITH_DATA)
    })

    it("drops a row whose plain data is not an object", async () => {
        const tx = mockEntityManager({ delete: [AgentSpeakerQueueEntity, { affected: 1 }] })
        tx.findOne.mockResolvedValueOnce(rowOf({ ...TAG, contextJson: "[1]" }, "q-list")).mockResolvedValueOnce(null)

        await expect((await build()).takeNext("ws-1", "c1", tx)).resolves.toBeNull()
    })

    it("keeps a hand-off once per event key", async () => {
        const tx = mockEntityManager()
        const [insert] = queueQueryBuilders(tx, [{ execute: { raw: [] } }])

        await (await build()).keep(TAG, tx)

        expect(insert?.callsOf("values")).toEqual([
            [{ workspaceId: "ws-1", conversationId: "c1", toAgentId: "accounting", eventKey: "claim:1", request: TAG }],
        ])
        expect(insert?.callsOf("orIgnore")).toHaveLength(1)
    })

    it("takes the oldest waiting hand-off out under a lock, and answers null when none waits", async () => {
        const waiting = mockEntityManager({
            findOne: [AgentSpeakerQueueEntity, rowOf(TAG)],
            delete: [AgentSpeakerQueueEntity, { affected: 1 }],
        })
        const empty = mockEntityManager({ findOne: [AgentSpeakerQueueEntity, null] })

        await expect((await build()).takeNext("ws-1", "c1", waiting)).resolves.toEqual(TAG)
        await expect((await build()).takeNext("ws-1", "c1", empty)).resolves.toBeNull()
        expect(waiting.findOne).toHaveBeenCalledWith(AgentSpeakerQueueEntity, {
            where: { workspaceId: "ws-1", conversationId: "c1" },
            order: { createdAt: "ASC", id: "ASC" },
            lock: { mode: "pessimistic_write" },
        })
        expect(waiting.delete).toHaveBeenCalledWith(AgentSpeakerQueueEntity, { id: "q-1" })
    })

    it("drops a row that does not read back as a hand-off and goes on to the next", async () => {
        const tx = mockEntityManager({ delete: [AgentSpeakerQueueEntity, { affected: 1 }] })
        tx.findOne.mockResolvedValueOnce(rowOf({ broken: true }, "q-bad")).mockResolvedValueOnce(null)

        await expect((await build()).takeNext("ws-1", "c1", tx)).resolves.toBeNull()
        expect(tx.delete).toHaveBeenCalledWith(AgentSpeakerQueueEntity, { id: "q-bad" })
    })
})
