import { Test } from "@nestjs/testing"
import { mock, mockEntityManager } from "@starci/jest-preset"
import { EMBEDDING_DIMENSIONS } from "@modules/domain/knowledge-chunks"
import { KnowledgeSourcesReadService } from "@modules/domain/knowledge-sources"
import { NivoKnowledgeSearchService } from "@modules/domain/nivo-knowledge"
import type { NivoHit } from "@modules/domain/nivo-knowledge"
import { WorkspaceMembersService } from "@modules/domain/workspace-members"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { EmbeddingService } from "./embedding.service"
import { KnowledgeErrorCode } from "./errors/knowledge.error"
import { KnowledgeSearchService } from "./knowledge-search.service"
import type { Lens } from "./knowledge.contracts"
import type { PassageFound } from "./passage-retrieval.contracts"
import { PassageRetrievalService } from "./passage-retrieval.service"

const WS = "11111111-1111-4111-8111-111111111111"
const lens: Lens = { workspaceId: WS, module: "chatbot", audience: "internal", installationId: "i1" }
const FOLD = 'SELECT * FROM "public"."knowledge_fold"($1)'
const VECTOR = Array.from({ length: EMBEDDING_DIMENSIONS }, () => 0.5)

const found: PassageFound = {
    id: "business-1",
    sourceId: "s1",
    title: "Hours",
    updatedAt: "2026-11-02T00:00:00.000Z",
    documentPassages: 4,
    order: 2,
    place: null,
    module: "chatbot",
    visibility: "public",
    customerReady: true,
    legs: ["words"],
    score: 0.5,
    content: "Open 8 to 21",
}
const item: NivoHit = { id: "nivo-1", module: "core", kind: "tone", title: "Tone", content: "Be kind", score: 0.95 }

/** The rows the database folds a question into: lower case, accent-free text. */
const FOLDED = [{ knowledge_fold: "opening hours?" }]

const build = async (folded: ReadonlyArray<{ knowledge_fold: string }> = FOLDED) => {
    const em = mockEntityManager({ query: [FOLD, [...folded]] })
    const members = mock<WorkspaceMembersService>()
    const embeddings = mock<EmbeddingService>()
    embeddings.model.mockReturnValue("m1")
    embeddings.embed.mockResolvedValue([VECTOR])
    const retrieval = mock<PassageRetrievalService>()
    retrieval.search.mockResolvedValue({ legs: ["meaning", "words"], hits: [found], next: null })
    const sources = mock<KnowledgeSourcesReadService>()
    sources.briefsOf.mockResolvedValue([{ id: "s1", kind: "faq", title: "Hours", topic: null }])
    const nivo = mock<NivoKnowledgeSearchService>()
    nivo.search.mockResolvedValue([])
    const moduleRef = await Test.createTestingModule({
        providers: [
            KnowledgeSearchService,
            { provide: PRIMARY_ENTITY_MANAGER, useValue: em },
            { provide: WorkspaceMembersService, useValue: members },
            { provide: EmbeddingService, useValue: embeddings },
            { provide: PassageRetrievalService, useValue: retrieval },
            { provide: KnowledgeSourcesReadService, useValue: sources },
            { provide: NivoKnowledgeSearchService, useValue: nivo },
        ],
    }).compile()
    return { service: moduleRef.get(KnowledgeSearchService), members, embeddings, retrieval, sources, nivo, em }
}

/** What the passage retrieval is asked for a question with a vector: one word is enough, the first page, the vector handed on. */
const asked = (query: string, limit: number) => ({ query, mode: "auto", match: "ranked", limit, after: 0, vector: VECTOR })

const registerAskCases = () => {
    it("lets any member try a question and returns the passages the lens allows", async () => {
        const { service, members, retrieval, nivo, em } = await build()

        const passages = await service.ask("u1", WS, {
            question: "  opening hours? ",
            module: "sales",
            audience: "internal",
        })

        expect(members.require).toHaveBeenCalledWith("u1", WS)
        expect(passages).toEqual([
            expect.objectContaining({
                id: "business-1",
                layer: "business",
                kind: "faq",
                title: "Hours",
                order: 2,
                score: 0.5,
            }),
        ])
        expect(em.query).toHaveBeenCalledWith(FOLD, ["opening hours?"])
        expect(retrieval.search).toHaveBeenCalledWith(
            { workspaceId: WS, module: "sales", audience: "internal", installationId: null },
            asked("opening hours?", 8),
        )
        expect(nivo.search).toHaveBeenCalledWith({
            module: "sales",
            vector: `[${VECTOR.join(",")}]`,
            model: "m1",
            tsquery: "opening | hours",
            limit: 8,
        })
    })

    it("scopes the search to the instance, and to public passages for the customer view or a customer-facing agent", async () => {
        const { service, retrieval } = await build()

        await service.ask("u1", WS, { question: "q", module: "sales", audience: "internal", installationId: "i1" })
        await service.ask("u1", WS, { question: "q", module: "sales", audience: "customer" })
        await service.ask("u1", WS, { question: "q", module: "chatbot", audience: "internal" })

        expect(retrieval.search.mock.calls.map(([asker]) => [asker.audience, asker.installationId])).toEqual([
            ["internal", "i1"],
            ["customer", null],
            ["customer", null],
        ])
    })

}

const registerAskRefusalCases = () => {
    it("refuses an agent that does not exist and a caller who is not a member", async () => {
        const { service, members } = await build()

        await expect(
            service.ask("u1", WS, { question: "q", module: "nope", audience: "internal" }),
        ).rejects.toMatchObject({
            code: KnowledgeErrorCode.ModuleUnknown,
        })
        const refusal = new Error("not a member")
        members.require.mockRejectedValue(refusal)
        await expect(service.ask("u1", WS, { question: "q", module: "sales", audience: "internal" })).rejects.toBe(
            refusal,
        )
    })

    it("answers nothing, and spends nothing, for an empty question, and cuts a long one", async () => {
        const { service, embeddings, retrieval } = await build()

        await expect(
            service.ask("u1", WS, { question: "  ", module: "sales", audience: "internal" }),
        ).resolves.toEqual([])
        expect(embeddings.embed).not.toHaveBeenCalled()
        expect(retrieval.search).not.toHaveBeenCalled()

        await service.ask("u1", WS, { question: "q".repeat(900), module: "sales", audience: "internal" })
        expect(embeddings.embed).toHaveBeenCalledWith({
            workspaceId: WS,
            texts: ["q".repeat(500)],
            timeoutMs: 8000,
            step: "search",
        })
    })
}

const registerPassagesCases = () => {
    it("searches by words alone when the query cannot be embedded or the provider answers no vector", async () => {
        const { service, embeddings, retrieval, nivo } = await build()
        embeddings.embed.mockResolvedValueOnce(null).mockResolvedValueOnce([])

        await expect(service.passages(lens, "hours", 4)).resolves.toHaveLength(1)
        await service.passages(lens, "hours", 4)

        expect(retrieval.search).toHaveBeenNthCalledWith(1, lens, {
            query: "hours",
            mode: "words",
            match: "ranked",
            limit: 4,
            after: 0,
        })
        expect(retrieval.search).toHaveBeenNthCalledWith(2, lens, {
            query: "hours",
            mode: "words",
            match: "ranked",
            limit: 4,
            after: 0,
        })
        expect(nivo.search).toHaveBeenCalledWith(expect.objectContaining({ vector: null, model: null }))
    })

    it("does not embed an empty query, and a fold that answers nothing has no words for the base knowledge", async () => {
        const blank = await build([{ knowledge_fold: "" }])
        await blank.service.passages(lens, " ", 4)
        expect(blank.embeddings.embed).not.toHaveBeenCalled()
        expect(blank.nivo.search).toHaveBeenCalledWith(expect.objectContaining({ tsquery: null }))

        const none = await build([])
        await none.service.passages(lens, "x", 4)
        expect(none.nivo.search).toHaveBeenCalledWith(expect.objectContaining({ tsquery: null }))
    })

    it("ranks both layers together, best first, and drops a passage whose source is gone", async () => {
        const { service, retrieval, nivo } = await build()
        retrieval.search.mockResolvedValue({
            legs: ["words"],
            hits: [found, { ...found, id: "business-2", sourceId: "gone", score: 0.99 }],
            next: null,
        })
        nivo.search.mockResolvedValue([item])

        const passages = await service.passages(lens, "hours", 8)

        expect(passages.map((passage) => passage.id)).toEqual(["nivo-1", "business-1"])
    })

    it("keeps the business passages of a words-only check and spends no credits", async () => {
        const { service, embeddings, retrieval, nivo } = await build()
        nivo.search.mockResolvedValue([item])

        const passages = await service.passagesText(lens, "hours", 5)

        expect(passages.map((passage) => passage.layer)).toEqual(["business"])
        expect(embeddings.embed).not.toHaveBeenCalled()
        expect(retrieval.search).toHaveBeenCalledWith(lens, {
            query: "hours",
            mode: "words",
            match: "ranked",
            limit: 5,
            after: 0,
        })
    })
}

const registerAgentCases = () => {
    const request = {
        workspaceId: WS,
        module: "sales",
        audience: "internal" as const,
        installationId: null,
        question: " renewal terms ",
        limit: 4,
    }

    it("searches the lane of the agent without asking who the member is", async () => {
        const { service, members, retrieval } = await build()

        const passages = await service.forAgent(request)

        expect(members.require).not.toHaveBeenCalled()
        expect(passages).toEqual([expect.objectContaining({ id: "business-1" })])
        expect(retrieval.search).toHaveBeenCalledWith(
            { workspaceId: WS, module: "sales", audience: "internal", installationId: null },
            asked("renewal terms", 4),
        )
    })

    it("uses a question the caller already embedded instead of embedding it again, and ignores a vector of another size", async () => {
        const given = await build()
        const vector = Array.from({ length: EMBEDDING_DIMENSIONS }, () => 0.25)
        await given.service.forAgent({ ...request, questionVector: vector })
        expect(given.embeddings.embed).not.toHaveBeenCalled()
        expect(given.retrieval.search).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ vector }))

        const wrong = await build()
        await wrong.service.forAgent({ ...request, questionVector: [1, 2] })
        expect(wrong.embeddings.embed).toHaveBeenCalledTimes(1)
    })

    it("gives the embedding of the question the budget the caller asks for, else the default", async () => {
        const budgeted = await build()
        const unbudgeted = await build()

        await budgeted.service.forAgent({ ...request, embedTimeoutMs: 2500 })
        await unbudgeted.service.forAgent(request)

        expect(budgeted.embeddings.embed).toHaveBeenCalledWith(expect.objectContaining({ timeoutMs: 2500 }))
        expect(unbudgeted.embeddings.embed).toHaveBeenCalledWith(expect.objectContaining({ timeoutMs: 8000 }))
    })

    it("narrows the lane to public passages for a customer audience or a customer-facing module, and joins the instance", async () => {
        const world = await build()

        await world.service.forAgent({ ...request, audience: "customer", installationId: "i1" })
        await world.service.forAgent({ ...request, module: "chatbot" })

        expect(world.retrieval.search.mock.calls.map(([asker]) => [asker.audience, asker.installationId])).toEqual([
            ["customer", "i1"],
            ["customer", null],
        ])
    })

    it("finds nothing on a blank question and refuses an unknown module", async () => {
        const { service, embeddings } = await build()

        await expect(service.forAgent({ ...request, question: "   " })).resolves.toEqual([])
        expect(embeddings.embed).not.toHaveBeenCalled()
        await expect(service.forAgent({ ...request, module: "nope" })).rejects.toMatchObject({
            code: KnowledgeErrorCode.ModuleUnknown,
        })
    })
}

describe("KnowledgeSearchService", () => {
    describe("ask", registerAskCases)
    describe("ask: refusals and limits", registerAskRefusalCases)
    describe("passages", registerPassagesCases)
    describe("forAgent", registerAgentCases)
})
