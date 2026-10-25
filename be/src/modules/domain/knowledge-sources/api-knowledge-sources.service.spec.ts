import { Test } from "@nestjs/testing"
import { builder, mock, mockEntityManager } from "@starci/jest-preset"
import { KnowledgeQueue } from "@modules/queues/knowledge"
import type { ApiTextSourceInput } from "./api-knowledge-sources.contracts"
import { ApiKnowledgeSourcesService } from "./api-knowledge-sources.service"
import { KnowledgeSourcesErrorCode } from "./errors/knowledge-sources.error"
import { INSERT_API_TEXT_SOURCE } from "./persistence/api-knowledge-sources.sql"
import { SELECT_SOURCE } from "./persistence/knowledge-sources.sql"

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
    const moduleRef = await Test.createTestingModule({
        providers: [ApiKnowledgeSourcesService, { provide: KnowledgeQueue, useValue: queue }],
    }).compile()
    return { service: moduleRef.get(ApiKnowledgeSourcesService), queue }
}

describe("ApiKnowledgeSourcesService addText", () => {
    it("keeps the request id and publishes indexing through the supplied transaction", async () => {
        const tx = mockEntityManager({ query: [INSERT_API_TEXT_SOURCE, [{ id: "request-1" }]] })
        const { service, queue } = await build()

        await expect(service.addText(sourceOf(), tx)).resolves.toEqual({ id: "request-1" })
        expect(tx.query).toHaveBeenCalledWith(INSERT_API_TEXT_SOURCE, [
            "request-1",
            WS,
            "Rooms",
            ["room"],
            "public",
            "Rooms",
            "# Rooms",
            "api:Website",
        ])
        expect(queue.enqueueIndex).toHaveBeenCalledWith({ sourceId: "request-1", workspaceId: WS }, tx)
        expect(tx.transaction).not.toHaveBeenCalled()
    })

    it("keeps a source without a topic internal", async () => {
        const tx = mockEntityManager({ query: [INSERT_API_TEXT_SOURCE, [{ id: "request-1" }]] })
        const { service } = await build()

        await service.addText(sourceOf({ topic: null, visibility: "internal" }), tx)
        expect(tx.query).toHaveBeenCalledWith(INSERT_API_TEXT_SOURCE, [
            "request-1",
            WS,
            null,
            ["room"],
            "internal",
            "Rooms",
            "# Rooms",
            "api:Website",
        ])
    })

    it("rejects invalid source input before writing or publishing", async () => {
        const tx = mockEntityManager()
        const { service, queue } = await build()

        await expect(service.addText(sourceOf({ content: " " }), tx)).rejects.toMatchObject({
            code: KnowledgeSourcesErrorCode.ContentEmpty,
        })
        expect(tx.query).not.toHaveBeenCalled()
        expect(queue.enqueueIndex).not.toHaveBeenCalled()
    })

    it("fails without publishing when storage answered no source", async () => {
        const tx = mockEntityManager({ query: [INSERT_API_TEXT_SOURCE, []] })
        const { service, queue } = await build()

        await expect(service.addText(sourceOf(), tx)).rejects.toMatchObject({
            code: KnowledgeSourcesErrorCode.SourceNotFound,
        })
        expect(queue.enqueueIndex).not.toHaveBeenCalled()
    })

    it("propagates a publication failure to roll back the caller's transaction", async () => {
        const tx = mockEntityManager({ query: [INSERT_API_TEXT_SOURCE, [{ id: "request-1" }]] })
        const { service, queue } = await build()
        const failure = new Error("outbox unavailable")
        queue.enqueueIndex.mockRejectedValue(failure)

        await expect(service.addText(sourceOf(), tx)).rejects.toBe(failure)
    })
})

describe("ApiKnowledgeSourcesService indexExisting", () => {
    it("publishes the exact existing source after checking its workspace", async () => {
        const tx = mockEntityManager({ query: [SELECT_SOURCE, [{ id: "existing-source" }]] })
        const { service, queue } = await build()

        await service.indexExisting(WS, "existing-source", tx)
        expect(tx.query).toHaveBeenCalledWith(SELECT_SOURCE, ["existing-source", WS])
        expect(queue.enqueueIndex).toHaveBeenCalledWith({ sourceId: "existing-source", workspaceId: WS }, tx)
        expect(tx.transaction).not.toHaveBeenCalled()
    })

    it("refuses a source missing from that workspace without publishing", async () => {
        const tx = mockEntityManager({ query: [SELECT_SOURCE, []] })
        const { service, queue } = await build()

        await expect(service.indexExisting(WS, "other-source", tx)).rejects.toMatchObject({
            code: KnowledgeSourcesErrorCode.SourceNotFound,
        })
        expect(queue.enqueueIndex).not.toHaveBeenCalled()
    })
})
