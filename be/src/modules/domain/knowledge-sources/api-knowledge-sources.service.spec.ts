import { row } from "@tests/fixtures/builders/knowledge-sources.builder"
import { Test } from "@nestjs/testing"
import { builder, mock, mockEntityManager } from "@starci/jest-preset"
import { KnowledgeQueue } from "@modules/queues/knowledge"
import type { ApiTextSourceInput } from "./api-knowledge-sources.contracts"
import { ApiKnowledgeSourcesService } from "./api-knowledge-sources.service"
import { KnowledgeSourcesErrorCode } from "./errors/knowledge-sources.error"
import { KnowledgeSourceEntity } from "./persistence/entities"
import { SourceQuotaService } from "./source-quota.service"

const sourceRowOf = builder<KnowledgeSourceEntity>(row)
const WS = "11111111-1111-4111-8111-111111111111"
const sourceOf = builder<ApiTextSourceInput>({
    workspaceId: WS,
    sourceId: "request-1",
    title: " Rooms ",
    content: " # Rooms ",
    topic: " Rooms ",
    tags: [" room ", "room"],
    visibility: "public",
    origin: "api:Website",
})

const build = async () => {
    const queue = mock<KnowledgeQueue>()
    const quota = mock<SourceQuotaService>()
    const moduleRef = await Test.createTestingModule({
        providers: [
            ApiKnowledgeSourcesService,
            { provide: KnowledgeQueue, useValue: queue },
            { provide: SourceQuotaService, useValue: quota },
        ],
    }).compile()
    return { service: moduleRef.get(ApiKnowledgeSourcesService), queue, quota }
}

describe("ApiKnowledgeSourcesService addText", () => {
    it("keeps the request id and publishes indexing through the supplied transaction", async () => {
        const tx = mockEntityManager({ insert: [KnowledgeSourceEntity, { identifiers: [{ id: "request-1" }] }] })
        const { service, queue, quota } = await build()

        await expect(service.addText(sourceOf(), tx)).resolves.toEqual({ id: "request-1" })
        expect(quota.admit).toHaveBeenCalledWith(tx, WS, 7)
        expect(tx.insert).toHaveBeenCalledWith(KnowledgeSourceEntity, {
            id: "request-1",
            workspaceId: WS,
            kind: "text",
            topic: "Rooms",
            tags: ["room"],
            visibility: "public",
            title: "Rooms",
            content: "# Rooms",
            status: "queued",
            progress: 0,
            origin: "api:Website",
            sizeBytes: 7,
            createdBy: null,
        })
        expect(queue.enqueueIndex).toHaveBeenCalledWith({ sourceId: "request-1", workspaceId: WS }, tx)
        expect(tx.transaction).not.toHaveBeenCalled()
    })

    it("keeps a source without a topic internal", async () => {
        const tx = mockEntityManager({ insert: [KnowledgeSourceEntity, { identifiers: [{ id: "request-1" }] }] })
        const { service } = await build()

        await service.addText(sourceOf({ topic: null, visibility: "internal" }), tx)
        expect(tx.insert).toHaveBeenCalledWith(
            KnowledgeSourceEntity,
            expect.objectContaining({ topic: null, tags: ["room"], visibility: "internal" }),
        )
    })

    it("rejects invalid source input before writing or publishing", async () => {
        const tx = mockEntityManager()
        const { service, queue } = await build()

        await expect(service.addText(sourceOf({ content: " " }), tx)).rejects.toMatchObject({
            code: KnowledgeSourcesErrorCode.ContentEmpty,
        })
        expect(tx.insert).not.toHaveBeenCalled()
        expect(queue.enqueueIndex).not.toHaveBeenCalled()
    })

    it("fails without publishing when storage answered no source", async () => {
        const tx = mockEntityManager({ insert: [KnowledgeSourceEntity, { identifiers: [] }] })
        const { service, queue } = await build()

        await expect(service.addText(sourceOf(), tx)).rejects.toMatchObject({
            code: KnowledgeSourcesErrorCode.SourceNotFound,
        })
        expect(queue.enqueueIndex).not.toHaveBeenCalled()
    })

    it("propagates a publication failure to roll back the caller's transaction", async () => {
        const tx = mockEntityManager({ insert: [KnowledgeSourceEntity, { identifiers: [{ id: "request-1" }] }] })
        const { service, queue } = await build()
        const failure = new Error("outbox unavailable")
        queue.enqueueIndex.mockRejectedValue(failure)

        await expect(service.addText(sourceOf(), tx)).rejects.toBe(failure)
    })
})

describe("ApiKnowledgeSourcesService addText / the workspace allowance", () => {
    it("writes and publishes nothing when the workspace has no room left", async () => {
        const tx = mockEntityManager()
        const { service, queue, quota } = await build()
        const refusal = new Error("quota")
        quota.admit.mockRejectedValue(refusal)

        await expect(service.addText(sourceOf(), tx)).rejects.toBe(refusal)
        expect(tx.insert).not.toHaveBeenCalled()
        expect(queue.enqueueIndex).not.toHaveBeenCalled()
    })
})

describe("ApiKnowledgeSourcesService indexExisting", () => {
    it("publishes the exact existing source after checking its workspace", async () => {
        const tx = mockEntityManager({
            findOne: [KnowledgeSourceEntity, sourceRowOf({ id: "existing-source" })],
        })
        const { service, queue } = await build()

        await service.indexExisting(WS, "existing-source", tx)
        expect(tx.findOne).toHaveBeenCalledWith(KnowledgeSourceEntity, {
            select: { id: true },
            where: { id: "existing-source", workspaceId: WS },
        })
        expect(queue.enqueueIndex).toHaveBeenCalledWith({ sourceId: "existing-source", workspaceId: WS }, tx)
        expect(tx.transaction).not.toHaveBeenCalled()
    })

    it("refuses a source missing from that workspace without publishing", async () => {
        const tx = mockEntityManager({ findOne: [KnowledgeSourceEntity, null] })
        const { service, queue } = await build()

        await expect(service.indexExisting(WS, "other-source", tx)).rejects.toMatchObject({
            code: KnowledgeSourcesErrorCode.SourceNotFound,
        })
        expect(queue.enqueueIndex).not.toHaveBeenCalled()
    })
})
