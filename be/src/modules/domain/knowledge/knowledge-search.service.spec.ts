import { Test } from "@nestjs/testing"
import { mock, mockEntityManager } from "@starci/jest-preset"
import type { MockEntityManager } from "@starci/jest-preset"
import { WorkspaceMembersService } from "@modules/domain/workspace-members"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { EmbeddingService } from "./embedding.service"
import { KnowledgeErrorCode } from "./errors/knowledge.error"
import { KnowledgeSearchService } from "./knowledge-search.service"
import type { Lens } from "./knowledge.contracts"
import { MATCH_KNOWLEDGE, SELECT_MODULE_AUDIENCE } from "./persistence/search.sql"

const WS = "11111111-1111-4111-8111-111111111111"
const lens: Lens = { workspaceId: WS, module: "chatbot", audience: "internal", installationId: "i1" }

const row = (layer: string) => ({
    layer,
    id: `${layer}-1`,
    source_id: null,
    module: "chatbot",
    kind: "faq",
    title: "Hours",
    content: "Open 8 to 21",
    score: 0.9,
    visibility: "public",
    topic: null,
})

const build = async (em: MockEntityManager) => {
    const members = mock<WorkspaceMembersService>()
    const embeddings = mock<EmbeddingService>()
    embeddings.model.mockReturnValue("m1")
    embeddings.embed.mockResolvedValue([[1, 2]])
    const moduleRef = await Test.createTestingModule({
        providers: [
            KnowledgeSearchService,
            { provide: PRIMARY_ENTITY_MANAGER, useValue: em },
            { provide: WorkspaceMembersService, useValue: members },
            { provide: EmbeddingService, useValue: embeddings },
        ],
    }).compile()
    return { service: moduleRef.get(KnowledgeSearchService), members, embeddings }
}

describe("KnowledgeSearchService", () => {
    describe("ask", () => {
        const stubs = (audience: string): ReadonlyArray<readonly [string, unknown]> => [
            [SELECT_MODULE_AUDIENCE, [{ audience }]],
            [MATCH_KNOWLEDGE, [row("business")]],
        ]

        it("lets any member try a question and returns the passages the lens allows", async () => {
            const em = mockEntityManager({ query: stubs("internal") })
            const { service, members } = await build(em)

            const passages = await service.ask("u1", WS, {
                question: "  opening hours? ",
                module: "chatbot",
                audience: "internal",
            })

            expect(members.require).toHaveBeenCalledWith("u1", WS)
            expect(passages).toEqual([expect.objectContaining({ id: "business-1", layer: "business" })])
            expect(em.query).toHaveBeenCalledWith(MATCH_KNOWLEDGE, [
                WS,
                "chatbot",
                "[1,2]",
                "opening hours?",
                8,
                "internal",
                "m1",
                null,
            ])
        })

        it("shows public passages only when the customer view is asked for", async () => {
            const em = mockEntityManager({ query: stubs("internal") })
            const { service } = await build(em)

            await service.ask("u1", WS, { question: "q", module: "chatbot", audience: "customer" })

            expect(em.query).toHaveBeenCalledWith(MATCH_KNOWLEDGE, expect.arrayContaining(["customer"]))
        })

        it("shows public passages only for an agent that speaks to customers", async () => {
            const em = mockEntityManager({ query: stubs("customer") })
            const { service } = await build(em)

            await service.ask("u1", WS, { question: "q", module: "chatbot", audience: "internal" })

            expect(em.query).toHaveBeenCalledWith(MATCH_KNOWLEDGE, expect.arrayContaining(["customer"]))
        })

        it("refuses an agent that does not exist", async () => {
            const { service } = await build(mockEntityManager({ query: [SELECT_MODULE_AUDIENCE, []] }))

            await expect(
                service.ask("u1", WS, { question: "q", module: "nope", audience: "internal" }),
            ).rejects.toMatchObject({ code: KnowledgeErrorCode.ModuleUnknown })
        })
    })
})

describe("KnowledgeSearchService", () => {
    describe("ask", () => {
        const stubs = (audience: string): ReadonlyArray<readonly [string, unknown]> => [
            [SELECT_MODULE_AUDIENCE, [{ audience }]],
            [MATCH_KNOWLEDGE, [row("business")]],
        ]

        it("answers nothing, and spends nothing, for an empty question", async () => {
            const { service, embeddings } = await build(mockEntityManager({ query: stubs("internal") }))

            await expect(
                service.ask("u1", WS, { question: "  ", module: "chatbot", audience: "internal" }),
            ).resolves.toEqual([])

            expect(embeddings.embed).not.toHaveBeenCalled()
        })

        it("does not let a caller who is not a member ask", async () => {
            const { service, members } = await build(mockEntityManager())
            const refusal = new Error("not a member")
            members.require.mockRejectedValue(refusal)

            await expect(
                service.ask("u1", WS, { question: "q", module: "chatbot", audience: "internal" }),
            ).rejects.toBe(refusal)
        })

        it("cuts a long question", async () => {
            const em = mockEntityManager({ query: stubs("internal") })
            const { service, embeddings } = await build(em)

            await service.ask("u1", WS, { question: "q".repeat(900), module: "chatbot", audience: "internal" })

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
            const em = mockEntityManager({ query: [MATCH_KNOWLEDGE, [row("nivo")]] })
            const { service, embeddings } = await build(em)
            embeddings.embed.mockResolvedValue(null)

            await expect(service.passages(lens, "hours", 4)).resolves.toHaveLength(1)

            expect(em.query).toHaveBeenCalledWith(MATCH_KNOWLEDGE, [
                WS,
                "chatbot",
                null,
                "hours",
                4,
                "internal",
                null,
                "i1",
            ])
        })

        it("searches by words alone when the provider answers no vector", async () => {
            const em = mockEntityManager({ query: [MATCH_KNOWLEDGE, []] })
            const { service, embeddings } = await build(em)
            embeddings.embed.mockResolvedValue([])

            await expect(service.passages(lens, "hours", 4)).resolves.toEqual([])

            expect(em.query).toHaveBeenCalledWith(MATCH_KNOWLEDGE, [
                WS,
                "chatbot",
                null,
                "hours",
                4,
                "internal",
                null,
                "i1",
            ])
        })

        it("does not embed an empty query", async () => {
            const em = mockEntityManager({ query: [MATCH_KNOWLEDGE, []] })
            const { service, embeddings } = await build(em)

            await service.passages(lens, " ", 4)

            expect(embeddings.embed).not.toHaveBeenCalled()
        })
    })
})

describe("KnowledgeSearchService", () => {
    describe("passagesText", () => {
        it("keeps the business passages and spends no credits", async () => {
            const em = mockEntityManager({ query: [MATCH_KNOWLEDGE, [row("nivo"), row("business")]] })
            const { service, embeddings } = await build(em)

            const found = await service.passagesText(lens, "hours", 5)

            expect(found.map((passage) => passage.layer)).toEqual(["business"])
            expect(embeddings.embed).not.toHaveBeenCalled()
        })
    })
})
