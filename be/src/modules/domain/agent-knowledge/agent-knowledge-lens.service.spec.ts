import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import type { FactRecord, Scope } from "@modules/domain/brain-facts"
import { KnowledgeSearchService } from "@modules/domain/knowledge"
import { KnowledgeGapsService } from "@modules/domain/knowledge-gaps"
import { KnowledgeSourcesReadableService } from "@modules/domain/knowledge-sources"
import { NivoKnowledgeService } from "@modules/domain/nivo-knowledge"
import { AgentKnowledgeLensService } from "./agent-knowledge-lens.service"
import { KnowledgeRecallService } from "./knowledge-recall.service"

const WS = "11111111-1111-4111-8111-111111111111"

const factOf = (scope: Scope): FactRecord => ({
    id: scope,
    subjectType: "policy",
    subjectKey: "delivery",
    subjectLabel: "Delivery",
    attribute: "days",
    attributeLabel: "Days",
    value: "Sunday",
    valueNumber: null,
    unit: null,
    scope,
    modules: [],
    installationId: null,
    status: "active",
    sourceKind: "owner",
    trust: 100,
    validFrom: null,
    validTo: null,
    supersedesId: null,
    conflictWith: null,
    proposalKind: "set",
    evidence: [],
    proposedBy: "owner",
    proposedAt: "2026-10-01T00:00:00.000Z",
    decidedBy: null,
    decidedAt: null,
    decisionNote: null,
})

const nivoItem = (module: string, slug: string, kind: string) => ({
    id: slug,
    module,
    slug,
    title: slug,
    body: `${slug} body`,
    kind,
    version: 1,
    updatedAt: "2026-10-01T00:00:00.000Z",
})

const PASSAGE = {
    layer: "business",
    id: "p1",
    sourceId: "s1",
    module: null,
    kind: "text",
    title: "T",
    content: "C",
    score: 0.5,
    visibility: "public",
    topic: null,
    order: 0,
}

const build = async () => {
    const sources = mock<KnowledgeSourcesReadableService>({
        readableFor: jest.fn().mockResolvedValue([]),
        countReadable: jest.fn().mockResolvedValue(2),
    })
    const recall = mock<KnowledgeRecallService>({
        standingMemory: jest.fn().mockResolvedValue(""),
        factsInView: jest.fn().mockResolvedValue([]),
    })
    const nivo = mock<NivoKnowledgeService>({
        list: jest
            .fn()
            .mockResolvedValue([
                nivoItem("core", "a-core", "authority"),
                nivoItem("chatbot", "b-bot", "escalation"),
                nivoItem("chatbot", "c-play", "playbook"),
            ]),
    })
    const gaps = mock<KnowledgeGapsService>({ openOfModule: jest.fn() })
    const search = mock<KnowledgeSearchService>()
    const moduleRef = await Test.createTestingModule({
        providers: [
            AgentKnowledgeLensService,
            { provide: KnowledgeSourcesReadableService, useValue: sources },
            { provide: KnowledgeRecallService, useValue: recall },
            { provide: NivoKnowledgeService, useValue: nivo },
            { provide: KnowledgeGapsService, useValue: gaps },
            { provide: KnowledgeSearchService, useValue: search },
        ],
    }).compile()
    return { lens: moduleRef.get(AgentKnowledgeLensService), sources, recall, nivo, gaps, search }
}

describe("AgentKnowledgeLensService", () => {
    it("reads customer modules and unknown keys through the public view", async () => {
        const { lens } = await build()
        expect(lens.audienceOf("chatbot")).toBe("customer")
        expect(lens.audienceOf("content")).toBe("customer")
        expect(lens.audienceOf("no-such-module")).toBe("customer")
        expect(lens.audienceOf("accounting")).toBe("internal")
    })
})

describe("AgentKnowledgeLensService", () => {
    it("opens the internal lanes only to the team view of a module, never to the public", async () => {
        const { lens } = await build()
        expect(lens.lanesOf("accounting")).toMatchObject({ documentInternal: true, factRestricted: true })
        expect(lens.customerLanes()).toEqual({
            documentPublic: true,
            documentInternal: false,
            factPublic: true,
            factInternal: false,
            factRestricted: false,
        })
        expect(lens.lanesOf("chatbot")).toMatchObject({ documentPublic: true, factInternal: false })
    })
})

describe("AgentKnowledgeLensService", () => {
    it("orders the module's own rules before core and leaves other kinds out", async () => {
        const { lens } = await build()
        const rules = await lens.baseRulesOf(["chatbot", "core"])
        expect(rules.map((rule) => rule.title)).toEqual(["b-bot", "a-core"])
    })
})

describe("AgentKnowledgeLensService", () => {
    it("never counts internal documents for a customer lens", async () => {
        const { lens, sources } = await build()
        const counts = await lens.countsFor(WS, "chatbot", null)
        expect(counts.audience).toBe("customer")
        expect(sources.countReadable).toHaveBeenCalledWith(expect.objectContaining({ audience: "customer" }), "public")
    })
})

describe("AgentKnowledgeLensService", () => {
    it("answers null for the gaps only when their table is missing", async () => {
        const { lens, gaps } = await build()
        gaps.openOfModule.mockRejectedValueOnce({ driverError: { code: "42P01" } })
        await expect(lens.openGapsOf(WS, "chatbot", 5)).resolves.toBeNull()
        gaps.openOfModule.mockRejectedValueOnce(new Error("boom"))
        await expect(lens.openGapsOf(WS, "chatbot", 5)).rejects.toThrow("boom")
    })
})

describe("AgentKnowledgeLensService", () => {
    it("projects readable documents and passes the instance's internal view to the source reader", async () => {
        const { lens, sources } = await build()
        const document = {
            title: "Delivery policy",
            topic: "Delivery",
            kind: "faq",
            visibility: "internal" as const,
            updatedAt: "2026-10-02T10:00:00.000Z",
            content: "Sunday deliveries need approval.",
        }
        sources.readableFor.mockResolvedValueOnce([{ id: "source-1", ...document }])
        await expect(lens.sourcesFor(WS, "accounting", "installation-1", 3)).resolves.toEqual([document])
        expect(sources.readableFor).toHaveBeenCalledWith(
            { workspaceId: WS, module: "accounting", audience: "internal", installationId: "installation-1" },
            3,
        )
    })
})

describe("AgentKnowledgeLensService", () => {
    it("returns the standing memory for the exact customer view", async () => {
        const { lens, recall } = await build()
        recall.standingMemory.mockResolvedValueOnce("### Delivery\n- Days: Sunday")
        await expect(lens.memoryFor(WS, "chatbot", null)).resolves.toBe("### Delivery\n- Days: Sunday")
        expect(recall.standingMemory).toHaveBeenCalledWith({
            workspaceId: WS,
            module: "chatbot",
            audience: "customer",
            installationId: null,
        })
    })
})

describe("AgentKnowledgeLensService", () => {
    it("sorts rules by folder order and then slug, including tone and rejecting unrelated folders", async () => {
        const { lens, nivo } = await build()
        nivo.list.mockResolvedValueOnce([
            nivoItem("core", "a-core", "authority"),
            nivoItem("chatbot", "z-tone", "tone"),
            nivoItem("content", "a-content", "authority"),
            nivoItem("chatbot", "a-escalation", "escalation"),
            nivoItem("chatbot", "b-playbook", "playbook"),
        ])
        await expect(lens.baseRulesOf(["chatbot", "core"])).resolves.toEqual([
            { title: "a-escalation", body: "a-escalation body", kind: "escalation" },
            { title: "z-tone", body: "z-tone body", kind: "tone" },
            { title: "a-core", body: "a-core body", kind: "authority" },
        ])
        expect(nivo.list).toHaveBeenCalledTimes(1)
        await expect(lens.baseRulesOf([])).resolves.toEqual([])
    })
})

describe("AgentKnowledgeLensService", () => {
    it("counts public, internal and restricted facts with the same view and a 500 fact limit", async () => {
        const { lens, sources, recall } = await build()
        const view = { workspaceId: WS, module: "accounting", audience: "internal", installationId: "instance-1" }
        sources.countReadable.mockResolvedValueOnce(7).mockResolvedValueOnce(4)
        recall.factsInView.mockResolvedValueOnce([
            factOf("public"),
            factOf("internal"),
            factOf("restricted"),
            factOf("public"),
        ])
        await expect(lens.countsFor(WS, "accounting", "instance-1")).resolves.toEqual({
            audience: "internal",
            documents: { public: 7, internal: 4 },
            facts: { public: 2, internal: 1, restricted: 1 },
        })
        expect(sources.countReadable).toHaveBeenNthCalledWith(1, view, "public")
        expect(sources.countReadable).toHaveBeenNthCalledWith(2, view, "internal")
        expect(recall.factsInView).toHaveBeenCalledWith(view, 500)
    })
})

describe("AgentKnowledgeLensService", () => {
    it("returns open gap counts and only the fields used by the lens", async () => {
        const { lens, gaps } = await build()
        const gap = {
            id: "gap-1",
            question: "Sunday delivery?",
            count: 6,
            lastSeenAt: "2026-10-02T10:00:00.000Z",
        }
        gaps.openOfModule.mockResolvedValueOnce({
            openCount: 8,
            items: [
                {
                    ...gap,
                    module: "chatbot",
                    topic: "Delivery",
                    attributeGuess: "Days",
                    firstSeenAt: "2026-10-01T10:00:00.000Z",
                    exampleConversationId: "conversation-1",
                    status: "open",
                    reopenedCount: 0,
                },
            ],
        })
        await expect(lens.openGapsOf(WS, "chatbot", 3)).resolves.toEqual({ openCount: 8, items: [gap] })
        expect(gaps.openOfModule).toHaveBeenCalledWith(WS, "chatbot", 3)
    })
})

describe("AgentKnowledgeLensService", () => {
    it.each([{ code: "42P01" }, { driverError: null, code: "42P01" }, { driverError: "driver", code: "42P01" }])(
        "returns null for a missing table reported without a driver object: %j",
        async (cause) => {
            const { lens, gaps } = await build()
            gaps.openOfModule.mockRejectedValueOnce(cause)
            await expect(lens.openGapsOf(WS, "chatbot", 5)).resolves.toBeNull()
        },
    )
})

describe("AgentKnowledgeLensService", () => {
    it.each([null, "network unavailable", { driverError: { code: "40001" }, code: "42P01" }])(
        "preserves failures that do not report a missing table: %j",
        async (cause) => {
            const { lens, gaps } = await build()
            gaps.openOfModule.mockRejectedValueOnce(cause)
            await expect(lens.openGapsOf(WS, "chatbot", 5)).rejects.toBe(cause)
        },
    )
})

describe("AgentKnowledgeLensService ask", () => {
    const input = { module: "accounting", audience: "customer", installationId: "i1", question: "  delivery days " }

    it("answers the facts of the view before the passages, with the scope as visibility", async () => {
        const { lens, recall, search } = await build()
        recall.factsMatching.mockResolvedValue([{ ...factOf("restricted"), unit: "VND" }])
        search.ask.mockResolvedValue([{ ...PASSAGE }])

        const found = await lens.ask("u1", WS, input)

        expect(search.ask).toHaveBeenCalledWith("u1", WS, input)
        expect(recall.factsMatching).toHaveBeenCalledWith(
            { workspaceId: WS, module: "accounting", audience: "customer", installationId: "i1" },
            "delivery days",
            5,
        )
        expect(found).toEqual([
            expect.objectContaining({
                layer: "fact",
                id: "restricted",
                title: "Delivery · Days",
                content: "Sunday VND",
                visibility: "restricted",
                sourceId: null,
            }),
            PASSAGE,
        ])
    })

    it("never widens a customer-facing module to the team view, and words a fact without a unit as its value", async () => {
        const { lens, recall, search } = await build()
        recall.factsMatching.mockResolvedValue([factOf("public")])
        search.ask.mockResolvedValue([])

        const found = await lens.ask("u1", WS, { module: "chatbot", audience: "internal", question: "x" })

        expect(recall.factsMatching).toHaveBeenCalledWith(
            { workspaceId: WS, module: "chatbot", audience: "customer", installationId: null },
            "x",
            5,
        )
        expect(found[0]?.content).toBe("Sunday")
    })

    it("reads no facts for a blank question", async () => {
        const { lens, recall, search } = await build()
        search.ask.mockResolvedValue([])

        await expect(lens.ask("u1", WS, { module: "chatbot", audience: "internal", question: " " })).resolves.toEqual(
            [],
        )
        expect(recall.factsMatching).not.toHaveBeenCalled()
    })
})

describe("AgentKnowledgeLensService notes", () => {
    const request = {
        workspaceId: WS,
        module: "sales",
        audience: "customer" as const,
        installationId: null,
        question: "  renewal terms ",
        limit: 2,
    }

    it("reads the lane of the agent: its facts first, then the passages, cut to the limit", async () => {
        const { lens, recall, search } = await build()
        recall.factsMatching.mockResolvedValue([factOf("public")])
        search.forAgent.mockResolvedValue([{ ...PASSAGE }, { ...PASSAGE }])

        const found = await lens.notes(request)

        expect(search.forAgent).toHaveBeenCalledWith({ ...request, question: "renewal terms" })
        expect(recall.factsMatching).toHaveBeenCalledWith(
            { workspaceId: WS, module: "sales", audience: "customer", installationId: null },
            "renewal terms",
            5,
        )
        expect(found).toHaveLength(2)
        expect(found[0]).toMatchObject({ layer: "fact", id: "public" })
    })

    it("finds no notes, and reads no facts, on an empty brain or a blank question", async () => {
        const { lens, recall, search } = await build()
        search.forAgent.mockResolvedValue([])
        recall.factsMatching.mockResolvedValue([])

        await expect(lens.notes(request)).resolves.toEqual([])
        await expect(lens.notes({ ...request, question: "  " })).resolves.toEqual([])
        expect(recall.factsMatching).toHaveBeenCalledTimes(1)
    })
})
