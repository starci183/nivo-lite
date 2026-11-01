import { Test } from "@nestjs/testing"
import { builder, mock } from "@starci/jest-preset"
import { KnowledgeChunksService } from "@modules/domain/knowledge-chunks"
import type { PassageView } from "@modules/domain/knowledge-chunks"
import { KnowledgeSourcesService } from "@modules/domain/knowledge-sources"
import type { SourceDetail } from "@modules/domain/knowledge-sources"
import { KnowledgeDocumentsService } from "./knowledge-documents.service"

const sourceOf = builder<SourceDetail>({
    id: "s1",
    workspaceId: "ws-1",
    module: "chatbot",
    installationId: null,
    kind: "text",
    topic: null,
    tags: [],
    visibility: "internal",
    title: "Hours",
    status: "ready",
    error: null,
    chunkCount: 1,
    sizeBytes: 12,
    progress: 100,
    stage: null,
    stageDone: null,
    stageTotal: null,
    partCount: 1,
    createdAt: "2026-10-12T10:00:00.000Z",
    updatedAt: "2026-10-12T10:00:00.000Z",
    content: "Open 8 to 21",
})
const passageOf = builder<PassageView>({
    id: "p1",
    order: 0,
    content: "Open 8 to 21",
    hasEmbedding: true,
})

const build = async () => {
    const sources = mock<KnowledgeSourcesService>()
    const chunks = mock<KnowledgeChunksService>()
    const moduleRef = await Test.createTestingModule({
        providers: [
            KnowledgeDocumentsService,
            { provide: KnowledgeSourcesService, useValue: sources },
            { provide: KnowledgeChunksService, useValue: chunks },
        ],
    }).compile()
    return { documents: moduleRef.get(KnowledgeDocumentsService), sources, chunks }
}

describe("KnowledgeDocumentsService", () => {
    it("returns the document and the passages a member opened", async () => {
        const { documents, sources, chunks } = await build()
        const source = sourceOf()
        const passages = [passageOf()]
        sources.detail.mockResolvedValue(source)
        chunks.passagesOf.mockResolvedValue(passages)

        await expect(documents.document("user-1", "ws-1", "s1")).resolves.toEqual({ source, chunks: passages })

        expect(sources.detail).toHaveBeenCalledWith("user-1", "ws-1", "s1")
        expect(chunks.passagesOf).toHaveBeenCalledWith("ws-1", "s1")
    })
})
