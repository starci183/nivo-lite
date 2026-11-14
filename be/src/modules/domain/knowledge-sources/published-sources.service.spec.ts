import { Test } from "@nestjs/testing"
import { In } from "typeorm"
import { FakeClock, fakeTransaction, mock, mockEntityManager } from "@starci/jest-preset"
import type { MockEntityManager } from "@starci/jest-preset"
import { CLOCK } from "@modules/platform/clock"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import type { KnowledgeQueue } from "@modules/queues/knowledge"
import { KNOWLEDGE_QUEUE_PRODUCER } from "@modules/queues/knowledge"
import { VectorSyncService } from "@modules/domain/vector-sync"
import { row } from "@tests/fixtures/builders/knowledge-sources.builder"
import { KnowledgeSourcesErrorCode } from "./errors/knowledge-sources.error"
import { KnowledgeProgressService } from "./knowledge-progress.service"
import { PublishedSourcesService } from "./published-sources.service"
import { KnowledgeSourceEntity } from "./persistence/entities"
import { NOW } from "./source-input.policy"
import { SourceQuotaService } from "./source-quota.service"

const WS = "11111111-1111-4111-8111-111111111111"
const AT = "2026-10-12T10:00:00.000Z"
const codes = KnowledgeSourcesErrorCode
const input = { title: " Opening hours ", content: " Open 8 to 21 " }

const build = async (em: MockEntityManager) => {
    const vectorSync = mock<VectorSyncService>()
    const queue = mock<KnowledgeQueue>()
    const quota = mock<SourceQuotaService>()
    const progress = mock<KnowledgeProgressService>()
    quota.measure.mockResolvedValue(14)
    const moduleRef = await Test.createTestingModule({
        providers: [
            PublishedSourcesService,
            { provide: PRIMARY_ENTITY_MANAGER, useValue: em },
            { provide: CLOCK, useValue: new FakeClock(AT) },
            { provide: KNOWLEDGE_QUEUE_PRODUCER, useValue: queue },
            { provide: SourceQuotaService, useValue: quota },
            { provide: KnowledgeProgressService, useValue: progress },
            { provide: VectorSyncService, useValue: vectorSync },
        ],
    }).compile()
    return { service: moduleRef.get(PublishedSourcesService), queue, quota, progress, vectorSync }
}

describe("PublishedSourcesService publish", () => {
    it("writes the approved text as its own public source with its indexing job in one transaction", async () => {
        const tx = fakeTransaction(
            mockEntityManager({ insert: [KnowledgeSourceEntity, { identifiers: [{ id: "s1" }] }] }),
        )
        const { service, queue, quota, progress } = await build(tx.em)

        await expect(service.publish(WS, "u1", "s1", input)).resolves.toEqual({ id: "s1" })

        // An approved public document is held to the PUBLIC area's cap.
        expect(quota.admit).toHaveBeenCalledWith(expect.anything(), WS, 14, "public")
        expect(tx.em.insert).toHaveBeenCalledWith(KnowledgeSourceEntity, {
            id: "s1",
            workspaceId: WS,
            module: null,
            installationId: null,
            kind: "text",
            topic: null,
            tags: [],
            visibility: "public",
            title: "Opening hours",
            content: "Open 8 to 21",
            status: "queued",
            progress: 0,
            storagePath: null,
            sourceUrl: null,
            origin: "public_document",
            sizeBytes: 14,
            createdBy: "u1",
        })
        expect(queue.enqueueIndex).toHaveBeenCalledWith({ sourceId: "s1", workspaceId: WS }, expect.anything())
        expect(progress.announce).toHaveBeenCalledWith(WS, "s1")
        expect(tx.commits).toBe(1)
    })

    it("refuses an empty text before anything is written", async () => {
        const em = mockEntityManager()
        const { service, queue } = await build(em)

        await expect(service.publish(WS, "u1", "s1", { title: "T", content: " " })).rejects.toMatchObject({
            code: codes.ContentEmpty,
        })
        expect(queue.enqueueIndex).not.toHaveBeenCalled()
    })

    it("fails when the insert answers no row", async () => {
        const tx = fakeTransaction(mockEntityManager({ insert: [KnowledgeSourceEntity, { identifiers: [] }] }))
        const { service, queue } = await build(tx.em)

        await expect(service.publish(WS, "u1", "s1", input)).rejects.toMatchObject({ code: codes.SourceNotFound })
        expect(queue.enqueueIndex).not.toHaveBeenCalled()
        expect(tx.rollbacks).toBe(1)
    })
})

describe("PublishedSourcesService replace", () => {
    it("writes the new text over an idle public source and queues it to be read again", async () => {
        const tx = fakeTransaction(mockEntityManager({ update: [KnowledgeSourceEntity, { affected: 1 }] }))
        const { service, queue, progress } = await build(tx.em)

        await expect(service.replace(WS, "s1", input)).resolves.toEqual({ id: "s1" })

        expect(tx.em.update).toHaveBeenCalledWith(
            KnowledgeSourceEntity,
            {
                id: "s1",
                workspaceId: WS,
                origin: "public_document",
                status: In(["pending", "ready", "failed", "blocked_credits"]),
            },
            {
                status: "queued",
                progress: 0,
                error: null,
                stage: null,
                stageDone: null,
                stageTotal: null,
                title: "Opening hours",
                content: "Open 8 to 21",
                sizeBytes: 14,
                updatedAt: NOW,
            },
        )
        expect(queue.enqueueIndex).toHaveBeenCalledWith(
            { sourceId: "s1", workspaceId: WS },
            expect.anything(),
            new Date(AT).getTime(),
        )
        expect(progress.announce).toHaveBeenCalledWith(WS, "s1")
    })

    it("asks to try again while a worker is on the source", async () => {
        const tx = fakeTransaction(
            mockEntityManager({
                update: [KnowledgeSourceEntity, { affected: 0 }],
                findOne: [KnowledgeSourceEntity, { ...row, id: "s1" }],
            }),
        )
        const { service, queue } = await build(tx.em)

        await expect(service.replace(WS, "s1", input)).rejects.toMatchObject({ code: codes.PublishBusy })
        expect(queue.enqueueIndex).not.toHaveBeenCalled()
    })

    it("refuses a source that is gone", async () => {
        const tx = fakeTransaction(
            mockEntityManager({
                update: [KnowledgeSourceEntity, { affected: 0 }],
                findOne: [KnowledgeSourceEntity, null],
            }),
        )
        const { service } = await build(tx.em)

        await expect(service.replace(WS, "s1", input)).rejects.toMatchObject({ code: codes.SourceNotFound })
    })
})

describe("PublishedSourcesService withdraw", () => {
    it("deletes only a source written for a public document", async () => {
        const em = mockEntityManager({ delete: [KnowledgeSourceEntity, { affected: 1 }] })
        const { service } = await build(em)

        await service.withdraw(WS, "s1")

        expect(em.delete).toHaveBeenCalledWith(KnowledgeSourceEntity, {
            id: "s1",
            workspaceId: WS,
            origin: "public_document",
        })
    })
})

describe("PublishedSourcesService withdraw and the vector index", () => {
    it("writes the vector index's sync event through the manager the delete ran on (the caller's transaction)", async () => {
        const tx = fakeTransaction(mockEntityManager({ delete: [KnowledgeSourceEntity, { affected: 1 }] }))
        const { service, vectorSync } = await build(tx.em)

        await service.withdraw(WS, "s1", tx.em)

        expect(vectorSync.changedSource).toHaveBeenCalledWith(WS, "s1", tx.em)
    })
})

describe("PublishedSourcesService caller transaction", () => {
    it("replaces the approved source through the caller's manager without nesting or announcing before commit", async () => {
        const tx = fakeTransaction(mockEntityManager({ update: [KnowledgeSourceEntity, { affected: 1 }] }))
        const { service, queue, progress } = await build(tx.em)

        await tx.em.transaction(async (manager) => {
            await expect(service.replace(WS, "s1", input, manager)).resolves.toEqual({ id: "s1" })
            expect(queue.enqueueIndex).toHaveBeenCalledWith(
                { sourceId: "s1", workspaceId: WS },
                manager,
                Date.parse(AT),
            )
        })

        expect(tx.em.transaction).toHaveBeenCalledTimes(1)
        expect(tx.commits).toBe(1)
        expect(progress.announce).not.toHaveBeenCalled()
    })

    it("refuses a caller-managed replacement with no affected count and no source, before any job", async () => {
        const em = mockEntityManager({ update: [KnowledgeSourceEntity, {}], findOne: [KnowledgeSourceEntity, null] })
        const { service, queue, progress } = await build(em)

        await expect(service.replace(WS, "s1", input, em)).rejects.toMatchObject({ code: codes.SourceNotFound })

        expect(em.transaction).not.toHaveBeenCalled()
        expect(queue.enqueueIndex).not.toHaveBeenCalled()
        expect(progress.announce).not.toHaveBeenCalled()
    })

    it("uses the approval transaction for source and queue writes, announcing only after its caller commits", async () => {
        const tx = fakeTransaction(
            mockEntityManager({ insert: [KnowledgeSourceEntity, { identifiers: [{ id: "s1" }] }] }),
        )
        const { service, queue, progress } = await build(tx.em)

        await tx.em.transaction((manager) => service.publish(WS, "u1", "s1", input, manager))

        expect(tx.em.transaction).toHaveBeenCalledTimes(1)
        expect(tx.commits).toBe(1)
        expect(queue.enqueueIndex).toHaveBeenCalledWith({ sourceId: "s1", workspaceId: WS }, expect.anything())
        expect(progress.announce).not.toHaveBeenCalled()
        await service.announce(WS, "s1")
        expect(progress.announce).toHaveBeenCalledWith(WS, "s1")
    })
})
