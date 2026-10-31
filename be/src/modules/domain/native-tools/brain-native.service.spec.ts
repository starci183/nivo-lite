import { Test } from "@nestjs/testing"
import { FakeClock, mock } from "@starci/jest-preset"
import { AgentViewScopeService } from "@modules/domain/agents"
import { BrainFactsReadService } from "@modules/domain/brain-facts"
import type { FactRecord } from "@modules/domain/brain-facts"
import { KnowledgeSearchService } from "@modules/domain/knowledge"
import type { Passage } from "@modules/domain/knowledge"
import { McpGatewayErrorCode } from "@modules/domain/mcp-gateway"
import { summaryOf } from "@modules/domain/mcp-gateway/audit-mask.policy"
import { CLOCK } from "@modules/platform/clock"
import { BRAIN_MANIFEST, BrainNativeService } from "./brain-native.service"
import { NativeViewService } from "./native-view.service"

const WS = "11111111-1111-4111-8111-111111111111"
const AGENT = { agentId: "a1", conversationId: null }
const NOW = new Date("2026-10-31T00:00:00.000Z")

const fact = (changes: Partial<FactRecord> = {}): FactRecord => ({
    id: "f1",
    subjectType: "business",
    subjectKey: "shop",
    subjectLabel: "Shop",
    attribute: "hours",
    attributeLabel: "Hours",
    value: "8 to 21",
    valueNumber: null,
    unit: null,
    scope: "public",
    modules: [],
    installationId: null,
    status: "active",
    sourceKind: "owner",
    trust: 95,
    validFrom: null,
    validTo: null,
    supersedesId: null,
    conflictWith: null,
    proposalKind: "set",
    evidence: [{ kind: "document", ref: "https://x", label: "Price list", quote: "private words", connectionId: "c9" }],
    proposedBy: "u1",
    proposedAt: "2026-10-01T00:00:00.000Z",
    decidedBy: null,
    decidedAt: null,
    decisionNote: null,
    ...changes,
})

const passage = (changes: Partial<Passage> = {}): Passage => ({
    layer: "business",
    id: "p1",
    sourceId: "s1",
    module: null,
    kind: "faq",
    title: "Hours",
    content: "Open 8 to 21",
    score: 0.9,
    visibility: "public",
    topic: "hours",
    order: 2,
    ...changes,
})

const build = async (scope = { module: "sales", installationId: null as string | null }) => {
    const scopes = mock<AgentViewScopeService>()
    scopes.lensOf.mockResolvedValue(scope)
    const facts = mock<BrainFactsReadService>()
    facts.search.mockResolvedValue([fact()])
    facts.forView.mockResolvedValue([fact()])
    facts.get.mockResolvedValue(fact())
    const knowledge = mock<KnowledgeSearchService>()
    knowledge.forAgent.mockResolvedValue([passage()])
    const moduleRef = await Test.createTestingModule({
        providers: [
            BrainNativeService,
            NativeViewService,
            { provide: AgentViewScopeService, useValue: scopes },
            { provide: BrainFactsReadService, useValue: facts },
            { provide: KnowledgeSearchService, useValue: knowledge },
            { provide: CLOCK, useValue: new FakeClock(NOW) },
        ],
    }).compile()
    return { brain: moduleRef.get(BrainNativeService), scopes, facts, knowledge }
}

describe("BrainNativeService manifest", () => {
    it("declares three read tools that start at auto and run in a customer turn", () => {
        expect(BRAIN_MANIFEST.key).toBe("brain")
        expect(BRAIN_MANIFEST.tools.map((tool) => [tool.name, tool.scope, tool.defaultMode])).toEqual([
            ["search", "read", "auto"],
            ["facts.list", "read", "auto"],
            ["facts.get", "read", "auto"],
        ])
        for (const tool of BRAIN_MANIFEST.tools) expect(tool.internalOnly).toBeUndefined()
        expect(BRAIN_MANIFEST.tools.map((tool) => tool.secretFields)).toEqual([
            ["query", "value", "content", "title"],
            ["subject", "value"],
            ["value", "label"],
        ])
    })
})

describe("BrainNativeService unknown tool and arguments", () => {
    it("refuses a tool the connector does not have", async () => {
        const { brain, facts } = await build()

        await expect(brain.invoke(WS, "facts.delete", {}, AGENT)).rejects.toMatchObject({
            code: McpGatewayErrorCode.UnknownTool,
            params: { tool: "facts.delete" },
        })
        expect(facts.forView).not.toHaveBeenCalled()
    })

    it.each([
        ["search", { query: "" }],
        ["facts.list", { limit: 51 }],
        ["facts.get", { id: "f1" }],
    ])("refuses invalid arguments for %s before reading anything", async (tool, args) => {
        const { brain, scopes } = await build()

        await expect(brain.invoke(WS, tool, args, AGENT)).rejects.toMatchObject({
            code: McpGatewayErrorCode.InvalidArguments,
            params: { tool },
        })
        expect(scopes.lensOf).not.toHaveBeenCalled()
    })

    it("refuses an agent the workspace does not hold as not found", async () => {
        const { brain, scopes } = await build()
        scopes.lensOf.mockResolvedValue(null)

        await expect(brain.invoke(WS, "search", { query: "hours" }, AGENT)).rejects.toMatchObject({
            code: McpGatewayErrorCode.NativeRefused,
            params: { reason: "not_found" },
        })
    })
})

describe("BrainNativeService search", () => {
    it("answers the facts and the business passages for the view of an internal agent, embedding on a 2500 ms budget", async () => {
        const { brain, facts, knowledge } = await build({ module: "sales", installationId: "i1" })
        knowledge.forAgent.mockResolvedValue([passage(), passage({ layer: "nivo", id: "n1", title: "Base" })])

        await expect(brain.invoke(WS, "search", { query: "hours" }, AGENT)).resolves.toEqual({
            facts: [{ id: "f1", subject: "Shop", attribute: "Hours", value: "8 to 21", unit: null, trust: 95 }],
            passages: [{ sourceId: "s1", title: "Hours", topic: "hours", order: 2, content: "Open 8 to 21" }],
        })
        expect(facts.search).toHaveBeenCalledWith(WS, "internal", "sales", "i1", "hours", 50)
        expect(knowledge.forAgent).toHaveBeenCalledWith({
            workspaceId: WS,
            module: "sales",
            audience: "internal",
            installationId: "i1",
            question: "hours",
            limit: 6,
            embedTimeoutMs: 2500,
        })
    })

    it("reads the public view only for a customer-facing agent, and for a conversation of an internal one", async () => {
        const facing = await build({ module: "chatbot", installationId: null })
        const served = await build({ module: "sales", installationId: null })

        await facing.brain.invoke(WS, "search", { query: "hours" }, AGENT)
        await served.brain.invoke(WS, "search", { query: "hours" }, { agentId: "a1", conversationId: "c1" })

        expect(facing.facts.search).toHaveBeenCalledWith(WS, "customer", "chatbot", null, "hours", 50)
        expect(served.facts.search).toHaveBeenCalledWith(WS, "customer", "sales", null, "hours", 50)
        expect(served.knowledge.forAgent).toHaveBeenCalledWith(expect.objectContaining({ audience: "customer" }))
    })

    it("never returns a fact about a customer or a person, and keeps to the limit", async () => {
        const { brain, facts } = await build()
        facts.search.mockResolvedValue([
            fact({ id: "f1", subjectType: "customer" }),
            fact({ id: "f2", subjectType: "person" }),
            fact({ id: "f3" }),
            fact({ id: "f4" }),
        ])

        const answer = await brain.invoke(WS, "search", { query: "hours", limit: 1 }, AGENT)

        expect(answer["facts"]).toEqual([expect.objectContaining({ id: "f3" })])
    })

    it("cuts a passage to 400 characters and answers none for a null order", async () => {
        const { brain, knowledge } = await build()
        knowledge.forAgent.mockResolvedValue([passage({ content: "x".repeat(500), order: null })])

        const answer = await brain.invoke(WS, "search", { query: "hours" }, AGENT)

        expect(answer["passages"]).toEqual([expect.objectContaining({ order: null, content: `${"x".repeat(399)}…` })])
    })

    it("answers the facts alone for a module outside the catalogue", async () => {
        const { brain, knowledge } = await build({ module: "gone", installationId: null })

        const answer = await brain.invoke(WS, "search", { query: "hours" }, AGENT)

        expect(answer["passages"]).toEqual([])
        expect(knowledge.forAgent).not.toHaveBeenCalled()
    })

    it("keeps the question, the values, the contents and the titles out of the audit summary", async () => {
        const { brain } = await build()
        const args = { query: "secret query" }

        const answer = await brain.invoke(WS, "search", args, AGENT)
        const search = BRAIN_MANIFEST.tools[0]

        const summary = summaryOf(answer, search?.secretFields)
        expect(summary).not.toContain("8 to 21")
        expect(summary).not.toContain("Open 8")
        expect(summary).toContain('"title":"***"')
        expect(summaryOf(args, search?.secretFields)).not.toContain("secret query")
    })
})

describe("BrainNativeService facts.list", () => {
    it("lists the facts in force of the view, without customers and people, up to the limit", async () => {
        const { brain, facts } = await build({ module: "sales", installationId: "i1" })
        facts.forView.mockResolvedValue([
            fact({ id: "f1" }),
            fact({ id: "f2", subjectType: "customer" }),
            fact({ id: "f3" }),
        ])

        const answer = await brain.invoke(WS, "facts.list", { limit: 1 }, AGENT)

        expect(answer["facts"]).toEqual([expect.objectContaining({ id: "f1" })])
        expect(facts.forView).toHaveBeenCalledWith(WS, "internal", "sales", "i1", 500)
    })

    it("narrows the list to the subject whose key contains the one asked", async () => {
        const { brain, facts } = await build()
        facts.forView.mockResolvedValue([
            fact({ id: "f1", subjectKey: "combo-thu-gian" }),
            fact({ id: "f2", subjectKey: "shop" }),
        ])

        const answer = await brain.invoke(WS, "facts.list", { subject: "Combo Thư giãn" }, AGENT)

        expect(answer["facts"]).toEqual([expect.objectContaining({ id: "f1" })])
    })

    it("keeps the subject and the values out of the audit summary", async () => {
        const { brain } = await build()

        const answer = await brain.invoke(WS, "facts.list", {}, AGENT)

        const summary = summaryOf(answer, BRAIN_MANIFEST.tools[1]?.secretFields)
        expect(summary).not.toContain("8 to 21")
        expect(summary).not.toContain("Shop")
    })
})

describe("BrainNativeService facts.get", () => {
    const ID = "22222222-2222-4222-8222-222222222222"

    it("answers a fact with the kind and label of its evidence, and nothing of the quote or the connection", async () => {
        const { brain, facts } = await build()
        facts.get.mockResolvedValue(fact({ id: ID, validFrom: "2026-01-01T00:00:00.000Z", validTo: "2027-01-01T00:00:00.000Z" }))

        const answer = await brain.invoke(WS, "facts.get", { id: ID }, AGENT)

        expect(answer).toEqual({
            fact: {
                id: ID,
                subject: "Shop",
                attribute: "Hours",
                value: "8 to 21",
                unit: null,
                trust: 95,
                evidence: [{ kind: "document", label: "Price list" }],
                validFrom: "2026-01-01T00:00:00.000Z",
                validTo: "2027-01-01T00:00:00.000Z",
            },
        })
        expect(JSON.stringify(answer)).not.toContain("private words")
        expect(facts.get).toHaveBeenCalledWith(WS, ID)
    })

    it.each([
        ["a fact that does not exist", null],
        ["a fact that is not active", fact({ status: "proposed" })],
        ["a fact about a customer", fact({ subjectType: "customer" })],
        ["a fact that ended", fact({ validTo: "2026-01-01T00:00:00.000Z" })],
        ["a fact that has not begun", fact({ validFrom: "2027-01-01T00:00:00.000Z" })],
        ["an internal fact for a customer view", fact({ scope: "internal" })],
        ["a fact kept for another instance", fact({ installationId: "other" })],
    ])("answers not found for %s", async (_label, found) => {
        const { brain, facts } = await build()
        facts.get.mockResolvedValue(found)

        await expect(
            brain.invoke(WS, "facts.get", { id: ID }, { agentId: "a1", conversationId: "c1" }),
        ).rejects.toMatchObject({ code: McpGatewayErrorCode.NativeRefused, params: { reason: "not_found" } })
    })

    it("serves an internal fact to an internal view", async () => {
        const { brain, facts } = await build()
        facts.get.mockResolvedValue(fact({ id: ID, scope: "internal" }))

        await expect(brain.invoke(WS, "facts.get", { id: ID }, AGENT)).resolves.toMatchObject({ fact: { id: ID } })
    })
})
