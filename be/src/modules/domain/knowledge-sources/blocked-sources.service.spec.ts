import { Test } from "@nestjs/testing"
import { FakeClock, fakeTransaction, mock, mockEntityManager } from "@starci/jest-preset"
import type { MockEntityManager } from "@starci/jest-preset"
import { CLOCK } from "@modules/platform/clock"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { KnowledgeQueue } from "@modules/queues/knowledge"
import { BlockedSourcesService } from "./blocked-sources.service"
import { KnowledgeProgressService } from "./knowledge-progress.service"
import { KnowledgeSourceEntity } from "./persistence/entities"
import { NOW } from "./source-input.policy"

const WS = "11111111-1111-4111-8111-111111111111"
const AT = "2026-10-12T10:00:00.000Z"

const rowOf = (id: string, workspaceId: string): KnowledgeSourceEntity => Object.assign(new KnowledgeSourceEntity(), { id, workspaceId })

const build = async (em: MockEntityManager) => {
    const queue = mock<KnowledgeQueue>()
    const progress = mock<KnowledgeProgressService>()
    const moduleRef = await Test.createTestingModule({
        providers: [
            BlockedSourcesService,
            { provide: PRIMARY_ENTITY_MANAGER, useValue: em },
            { provide: CLOCK, useValue: new FakeClock(AT) },
            { provide: KnowledgeQueue, useValue: queue },
            { provide: KnowledgeProgressService, useValue: progress },
        ],
    }).compile()
    return { service: moduleRef.get(BlockedSourcesService), queue, progress }
}

describe("BlockedSourcesService: a document that waits for credits goes on by itself (D-U-4)", () => {
    it("lists the documents that wait for credits in every workspace, the longest-waiting first", async () => {
        const em = mockEntityManager({ find: [KnowledgeSourceEntity, [rowOf("s1", WS), rowOf("s2", "ws-2")]] })
        const { service } = await build(em)

        await expect(service.waiting(50)).resolves.toEqual([
            { id: "s1", workspaceId: WS },
            { id: "s2", workspaceId: "ws-2" },
        ])

        expect(em.find).toHaveBeenCalledWith(KnowledgeSourceEntity, {
            select: { id: true, workspaceId: true },
            where: { status: "blocked_credits" },
            order: { updatedAt: "ASC" },
            take: 50,
        })
    })

    it("puts a waiting document back on the index queue in one transaction, with no person, and tells its page", async () => {
        const tx = fakeTransaction(mockEntityManager({ update: [KnowledgeSourceEntity, { affected: 1, raw: [], generatedMaps: [] }] }))
        const { service, queue, progress } = await build(tx.em)

        await expect(service.resume(WS, "s1")).resolves.toBe(true)

        expect(tx.em.update).toHaveBeenCalledWith(
            KnowledgeSourceEntity,
            { id: "s1", workspaceId: WS, status: "blocked_credits" },
            { status: "queued", progress: 0, error: null, stage: null, stageDone: null, stageTotal: null, updatedAt: NOW },
        )
        expect(queue.enqueueIndex).toHaveBeenCalledWith({ sourceId: "s1", workspaceId: WS }, expect.anything(), Date.parse(AT))
        expect(tx.commits).toBe(1)
        expect(progress.announce).toHaveBeenCalledWith(WS, "s1")
    })

    it("moves nothing and queues nothing when the document no longer waits (another tick, the founder's retry, a failed document)", async () => {
        const tx = fakeTransaction(mockEntityManager({ update: [KnowledgeSourceEntity, { affected: 0, raw: [], generatedMaps: [] }] }))
        const { service, queue, progress } = await build(tx.em)

        await expect(service.resume(WS, "s1")).resolves.toBe(false)

        expect(queue.enqueueIndex).not.toHaveBeenCalled()
        expect(progress.announce).not.toHaveBeenCalled()
    })
})
