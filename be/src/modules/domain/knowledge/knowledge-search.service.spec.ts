import { Test } from "@nestjs/testing"
import { mock, mockEntityManager } from "@starci/jest-preset"
import type { MockEntityManager } from "@starci/jest-preset"
import { KnowledgeChunksService } from "@modules/domain/knowledge-chunks"
import type { ChunkHit } from "@modules/domain/knowledge-chunks"
import { KnowledgeSourcesService } from "@modules/domain/knowledge-sources"
import { NivoKnowledgeService } from "@modules/domain/nivo-knowledge"
import type { NivoHit } from "@modules/domain/nivo-knowledge"
import { WorkspaceMembersService } from "@modules/domain/workspace-members"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { EmbeddingService } from "./embedding.service"
import { KnowledgeErrorCode } from "./errors/knowledge.error"
import { KnowledgeSearchService } from "./knowledge-search.service"
import type { Lens } from "./knowledge.contracts"

const WS = "11111111-1111-4111-8111-111111111111"
const lens: Lens = { workspaceId: WS, module: "chatbot", audience: "internal", installationId: "i1" }
const FOLD = "SELECT * FROM public.knowledge_fold($1)"

const chunk: ChunkHit = {
    id: "business-1",
    sourceId: "s1",
    module: "chatbot",
    content: "Open 8 to 21",
    score: 0.9,
    visibility: "public",
    order: 2,
}
const item: NivoHit = { id: "nivo-1", module: "core", kind: "tone", title: "Tone", content: "Be kind", score: 0.95 }

/** A manager that folds the question the way the database does: lower case, accent-free text. */
const folding = (): MockEntityManager => mockEntityManager({ query: [FOLD, [{ knowledge_fold: "opening hours?" }]] })

const build = async (em: MockEntityManager = folding()) => {
    const members = mock<WorkspaceMembersService>()
    const embeddings = mock<EmbeddingService>()
    embeddings.model.mockReturnValue("m1")
    embeddings.embed.mockResolvedValue([[1, 2]])
    const chunks = mock<KnowledgeChunksService>()
    chunks.search.mockResolvedValue([chunk])
    const sources = mock<KnowledgeSourcesService>()
    sources.briefsOf.mockResolvedValue([{ id: "s1", kind: "faq", title: "Hours", topic: null }])
    const nivo = mock<NivoKnowledgeService>()
    nivo.search.mockResolvedValue([])
    const moduleRef = await Test.createTestingModule({
        providers: [
            KnowledgeSearchService,
            { provide: PRIMARY_ENTITY_MANAGER, useValue: em },
            { provide: WorkspaceMembersService, useValue: members },
            { provide: EmbeddingService, useValue: embeddings },
            { provide: KnowledgeChunksService, useValue: chunks },
            { provide: KnowledgeSourcesService, useValue: sources },
            { provide: NivoKnowledgeService, useValue: nivo },
        ],
    }).compile()
    return { service: moduleRef.get(KnowledgeSearchService), members, embeddings, chunks, sources, nivo, em }
}

describe("KnowledgeSearchService", () => {
    describe("ask", () => {
        it("lets any member try a question and returns the passages the lens allows", async () => {
            const { service, members, chunks, nivo, em } = await build()

            const passages = await service.ask("u1", WS, {
                question: "  opening hours? ",
                module: "accounting",
                audience: "internal",
            })

            expect(members.require).toHaveBeenCalledWith("u1", WS)
            expect(passages).toEqual([
                expect.objectContaining({ id: "business-1", layer: "business", kind: "faq", title: "Hours", order: 2 }),
            ])
            expect(em.query).toHaveBeenCalledWith(FOLD, ["opening hours?"])
            const search = { vector: "[1,2]", model: "m1", tsquery: "opening | hours", limit: 8 }
            expect(chunks.search).toHaveBeenCalledWith({
                workspaceId: WS,
                module: "accounting",
                audience: "internal",
                installationId: null,
                ...search,
            })
            expect(nivo.search).toHaveBeenCalledWith({ module: "accounting", ...search })
        })

        it("scopes the search to the agent instance the question is asked as", async () => {
            const { service, chunks } = await build()

            await service.ask("u1", WS, {
                question: "q",
                module: "accounting",
                audience: "internal",
                installationId: "i1",
            })

            expect(chunks.search).toHaveBeenCalledWith(expect.objectContaining({ installationId: "i1" }))
        })

        it("shows public passages only when the customer view is asked for", async () => {
            const { service, chunks } = await build()

            await service.ask("u1", WS, { question: "q", module: "accounting", audience: "customer" })

            expect(chunks.search).toHaveBeenCalledWith(expect.objectContaining({ audience: "customer" }))
        })

        it("shows public passages only for an agent that speaks to customers", async () => {
            const { service, chunks } = await build()

            await service.ask("u1", WS, { question: "q", module: "chatbot", audience: "internal" })

            expect(chunks.search).toHaveBeenCalledWith(expect.objectContaining({ audience: "customer" }))
        })

        it("refuses an agent that does not exist", async () => {
            const { service } = await build()

            await expect(
                service.ask("u1", WS, { question: "q", module: "nope", audience: "internal" }),
            ).rejects.toMatchObject({ code: KnowledgeErrorCode.ModuleUnknown })
        })
    })
})

describe("KnowledgeSearchService", () => {
    describe("ask", () => {
        it("answers nothing, and spends nothing, for an empty question", async () => {
            const { service, embeddings, chunks } = await build()

            await expect(
                service.ask("u1", WS, { question: "  ", module: "accounting", audience: "internal" }),
            ).resolves.toEqual([])

            expect(embeddings.embed).not.toHaveBeenCalled()
            expect(chunks.search).not.toHaveBeenCalled()
        })

        it("does not let a caller who is not a member ask", async () => {
            const { service, members } = await build()
            const refusal = new Error("not a member")
            members.require.mockRejectedValue(refusal)

            await expect(
                service.ask("u1", WS, { question: "q", module: "accounting", audience: "internal" }),
            ).rejects.toBe(refusal)
        })

        it("cuts a long question", async () => {
            const { service, embeddings } = await build()

            await service.ask("u1", WS, { question: "q".repeat(900), module: "accounting", audience: "internal" })

            expect(embeddings.embed).toHaveBeenCalledWith({
                workspaceId: WS,
                texts: ["q".repeat(500)],
                timeoutMs: 8000,
            })
        })
    })
})

describe("KnowledgeSearchService", () => {
    describe("passages", () => {
        it("searches by words alone when the query cannot be embedded", async () => {
            const { service, embeddings, chunks } = await build()
            embeddings.embed.mockResolvedValue(null)

            await expect(service.passages(lens, "hours", 4)).resolves.toHaveLength(1)

            expect(chunks.search).toHaveBeenCalledWith({
                workspaceId: WS,
                module: "chatbot",
                audience: "internal",
                installationId: "i1",
                vector: null,
                model: null,
                tsquery: "opening | hours",
                limit: 4,
            })
        })

        it("searches by words alone when the provider answers no vector", async () => {
            const { service, embeddings, chunks } = await build()
            embeddings.embed.mockResolvedValue([])
            chunks.search.mockResolvedValue([])

            await expect(service.passages(lens, "hours", 4)).resolves.toEqual([])

            expect(chunks.search).toHaveBeenCalledWith(expect.objectContaining({ vector: null, model: null }))
        })

        it("does not embed an empty query and has no words to match", async () => {
            const { service, embeddings, chunks } = await build(
                mockEntityManager({ query: [FOLD, [{ knowledge_fold: "" }]] }),
            )

            await service.passages(lens, " ", 4)

            expect(embeddings.embed).not.toHaveBeenCalled()
            expect(chunks.search).toHaveBeenCalledWith(expect.objectContaining({ tsquery: null }))
        })

        it("treats a fold that answers no row as no words", async () => {
            const { service, chunks } = await build(mockEntityManager({ query: [FOLD, []] }))

            await service.passages(lens, "x", 4)

            expect(chunks.search).toHaveBeenCalledWith(expect.objectContaining({ tsquery: null }))
        })

        it("ranks both layers together, best first, and drops a passage whose source is gone", async () => {
            const { service, chunks, nivo } = await build()
            chunks.search.mockResolvedValue([chunk, { ...chunk, id: "business-2", sourceId: "gone", score: 0.99 }])
            nivo.search.mockResolvedValue([item])

            const found = await service.passages(lens, "hours", 8)

            expect(found.map((passage) => passage.id)).toEqual(["nivo-1", "business-1"])
        })
    })
})

describe("KnowledgeSearchService", () => {
    describe("passagesText", () => {
        it("keeps the business passages and spends no credits", async () => {
            const { service, embeddings, nivo } = await build()
            nivo.search.mockResolvedValue([item])

            const found = await service.passagesText(lens, "hours", 5)

            expect(found.map((passage) => passage.layer)).toEqual(["business"])
            expect(embeddings.embed).not.toHaveBeenCalled()
        })
    })
})

describe("KnowledgeSearchService", () => {
    describe("forAgent", () => {
        const request = {
            workspaceId: WS,
            module: "sales",
            audience: "internal" as const,
            installationId: null,
            question: " renewal terms ",
            limit: 4,
        }

        it("searches the lane of the agent without asking who the member is", async () => {
            const { service, members, chunks } = await build()

            const passages = await service.forAgent(request)

            expect(members.require).not.toHaveBeenCalled()
            expect(passages).toEqual([expect.objectContaining({ id: "business-1" })])
            expect(chunks.search).toHaveBeenCalledWith({
                workspaceId: WS,
                module: "sales",
                audience: "internal",
                installationId: null,
                vector: "[1,2]",
                model: "m1",
                tsquery: "opening | hours",
                limit: 4,
            })
        })

        it("narrows the lane to public passages for a customer audience or a customer-facing module, and joins the instance", async () => {
            const asked = await build()
            const facing = await build()

            await asked.service.forAgent({ ...request, audience: "customer", installationId: "i1" })
            await facing.service.forAgent({ ...request, module: "chatbot" })

            expect(asked.chunks.search).toHaveBeenCalledWith(
                expect.objectContaining({ audience: "customer", installationId: "i1" }),
            )
            expect(facing.chunks.search).toHaveBeenCalledWith(expect.objectContaining({ audience: "customer" }))
        })

        it("finds nothing on a blank question and refuses an unknown module", async () => {
            const { service, embeddings } = await build()
            const unknown = await build()

            await expect(service.forAgent({ ...request, question: "   " })).resolves.toEqual([])
            expect(embeddings.embed).not.toHaveBeenCalled()
            await expect(unknown.service.forAgent({ ...request, module: "nope" })).rejects.toMatchObject({
                code: KnowledgeErrorCode.ModuleUnknown,
            })
        })
    })
})
