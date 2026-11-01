import { Test } from "@nestjs/testing"
import { builder, fakeTransaction, mock, mockEntityManager } from "@starci/jest-preset"
import type { MockEntityManager } from "@starci/jest-preset"
import { row } from "@tests/fixtures/builders/knowledge-sources.builder"
import { queueQueryBuilders } from "@tests/fixtures/builders/entity-query-builder-fake.builder"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { KnowledgeQueue } from "@modules/queues/knowledge"
import { KnowledgeSourcesErrorCode } from "./errors/knowledge-sources.error"
import { KnowledgeProgressService } from "./knowledge-progress.service"
import { KnowledgeSourceEntity } from "./persistence/entities"
import { metaChanges } from "./source-input.policy"
import { SourcePartsService } from "./source-parts.service"

const WS = "11111111-1111-4111-8111-111111111111"
/** What the later parts of the document `s1` are found by. */
const LATER_PARTS = { workspaceId: WS, origin: "part:s1" }
/** What a write of the table answers. */
const WRITTEN = {}
const firstOf = builder<KnowledgeSourceEntity>({ ...row, topic: "Legal", tags: ["a"], visibility: "public" })

const build = async (em: MockEntityManager) => {
    const queue = mock<KnowledgeQueue>()
    const progress = mock<KnowledgeProgressService>()
    const moduleRef = await Test.createTestingModule({
        providers: [
            SourcePartsService,
            { provide: PRIMARY_ENTITY_MANAGER, useValue: em },
            { provide: KnowledgeQueue, useValue: queue },
            { provide: KnowledgeProgressService, useValue: progress },
        ],
    }).compile()
    return { service: moduleRef.get(SourcePartsService), queue, progress }
}

describe("SourcePartsService splitLong", () => {
    it("gives each later part a text source with the readers of the first, queues it and answers the first title", async () => {
        const tx = fakeTransaction(
            mockEntityManager({
                findOne: [KnowledgeSourceEntity, firstOf()],
                delete: [KnowledgeSourceEntity, {}],
                insert: [KnowledgeSourceEntity, { identifiers: [{ id: "p2" }, { id: "p3" }] }],
            }),
        )
        const { service, queue, progress } = await build(tx.em)

        await expect(service.splitLong(WS, "s1", "Plan", ["two", "three"])).resolves.toBe("Plan (1/3)")

        expect(tx.em.delete).toHaveBeenCalledWith(KnowledgeSourceEntity, { workspaceId: WS, origin: "part:s1" })
        expect(tx.em.insert).toHaveBeenCalledWith(KnowledgeSourceEntity, [
            expect.objectContaining({ kind: "text", title: "Plan (2/3)", content: "two", topic: "Legal" }),
            expect.objectContaining({ title: "Plan (3/3)", content: "three", origin: "part:s1", sizeBytes: 0 }),
        ])
        expect(queue.enqueueIndex).toHaveBeenCalledWith({ sourceId: "p2", workspaceId: WS }, expect.anything())
        expect(queue.enqueueIndex).toHaveBeenCalledWith({ sourceId: "p3", workspaceId: WS }, expect.anything())
        expect(progress.announce).toHaveBeenCalledWith(WS, "p3")
    })

    it("adds nothing when the first source is gone", async () => {
        const tx = fakeTransaction(
            mockEntityManager({ findOne: [KnowledgeSourceEntity, null], delete: [KnowledgeSourceEntity, {}] }),
        )
        const { service, queue } = await build(tx.em)

        await service.splitLong(WS, "s1", "Plan", ["two"])

        expect(tx.em.insert).not.toHaveBeenCalled()
        expect(queue.enqueueIndex).not.toHaveBeenCalled()
    })
})

describe("SourcePartsService removeWhole", () => {
    it("deletes the source and the later parts of a long document in one transaction and answers their titles", async () => {
        const tx = fakeTransaction(
            mockEntityManager({
                find: [KnowledgeSourceEntity, [firstOf({ id: "p2", title: "Plan (2/2)" })]],
                delete: [KnowledgeSourceEntity, WRITTEN],
            }),
        )
        const [removal] = queueQueryBuilders(tx.em, [{ execute: { raw: [{ title: "Plan (1/2)" }] } }])
        const { service } = await build(tx.em)

        await expect(service.removeWhole(WS, "s1")).resolves.toEqual({
            title: "Plan (1/2)",
            parts: [{ id: "p2", title: "Plan (2/2)" }],
        })

        expect(removal?.callsOf("where")).toEqual([[{ id: "s1", workspaceId: WS }]])
        expect(tx.em.delete).toHaveBeenCalledWith(KnowledgeSourceEntity, LATER_PARTS)
        expect(tx.commits).toBe(1)
    })

    it("deletes nothing, parts included, for a source that is gone", async () => {
        const tx = fakeTransaction(mockEntityManager({ find: [KnowledgeSourceEntity, []] }))
        queueQueryBuilders(tx.em, [{ execute: { raw: [] } }])
        const { service } = await build(tx.em)

        await expect(service.removeWhole(WS, "s1")).rejects.toMatchObject({
            code: KnowledgeSourcesErrorCode.SourceNotFound,
        })

        expect(tx.em.delete).not.toHaveBeenCalled()
        expect(tx.rollbacks).toBe(1)
    })
})

describe("SourcePartsService follow", () => {
    it("gives the later parts of a long document the change made to the first", async () => {
        const em = mockEntityManager({ update: [KnowledgeSourceEntity, WRITTEN] })
        const { service } = await build(em)

        const changes = metaChanges({ title: null, topic: null, tags: null, module: null, visibility: "public" })

        await service.follow(WS, "s1", changes)

        expect(em.update).toHaveBeenCalledWith(KnowledgeSourceEntity, LATER_PARTS, changes)
    })
})
