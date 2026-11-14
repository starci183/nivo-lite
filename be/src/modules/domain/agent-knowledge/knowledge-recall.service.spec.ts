import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import { BrainFactsService } from "@modules/domain/brain-facts"
import type { FactRecord } from "@modules/domain/brain-facts"
import type { KnowledgeView } from "./agent-knowledge.contracts"
import { KnowledgeRecallService } from "./knowledge-recall.service"

const view: KnowledgeView = {
    workspaceId: "11111111-1111-4111-8111-111111111111",
    module: "chatbot",
    audience: "customer",
    installationId: null,
}

const fact: FactRecord = {
    id: "fact-1",
    subjectType: "product",
    subjectKey: "tea",
    subjectLabel: "Tea",
    attribute: "price",
    attributeLabel: "Price",
    value: "50k",
    valueNumber: null,
    unit: null,
    scope: "public",
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
    proposedBy: "owner-1",
    proposedAt: "2026-10-12T10:00:00.000Z",
    decidedBy: null,
    decidedAt: null,
    decisionNote: null,
}

const build = async () => {
    const facts = mock<BrainFactsService>({
        search: jest.fn().mockResolvedValue([fact]),
        forView: jest.fn().mockResolvedValue([fact]),
    })
    const moduleRef = await Test.createTestingModule({
        providers: [KnowledgeRecallService, { provide: BrainFactsService, useValue: facts }],
    }).compile()
    return { recall: moduleRef.get(KnowledgeRecallService), facts }
}

describe("KnowledgeRecallService", () => {
    it("reads a bounded fact view and passes the complete view to a fact search", async () => {
        const { recall, facts } = await build()
        const second = { ...fact, id: "fact-2", value: "60k" }
        facts.forView.mockResolvedValue([fact, second])
        const scoped = { ...view, installationId: "agent-1", audience: "internal" as const }

        await expect(recall.factsInView(scoped, 1)).resolves.toEqual([fact])
        await expect(recall.factsMatching(scoped, "tea price", 2)).resolves.toEqual([fact])

        expect(facts.forView).toHaveBeenCalledWith(view.workspaceId, "internal", "chatbot", "agent-1", 500)
        expect(facts.search).toHaveBeenCalledWith(view.workspaceId, "internal", "chatbot", "agent-1", "tea price", 2)
    })
})


describe("KnowledgeRecallService > waitingInView", () => {
    it("counts the review cards of the proposals inside the view (one per key), never the ones another scope or the team keeps", async () => {
        const { recall, facts } = await build()
        const proposal = (id: string, overrides: Partial<FactRecord>): FactRecord => ({
            ...fact,
            id,
            status: "proposed",
            ...overrides,
        })
        facts.list.mockResolvedValue([
            proposal("p1", {}),
            proposal("p2", { scope: "internal" }),
            proposal("p3", { installationId: "other-installation" }),
            proposal("p4", { value: "60k" }),
        ])

        await expect(recall.waitingInView(view)).resolves.toBe(1)
        expect(facts.list).toHaveBeenCalledWith(view.workspaceId, { statuses: ["proposed"], limit: 500 })
    })
})

describe("KnowledgeRecallService factsToOverview", () => {
    it("keeps the facts in force now and the waiting proposals the team view of the module could read", async () => {
        const { recall, facts } = await build()
        const waiting = { ...fact, id: "waiting", status: "proposed" as const }
        const hidden = { ...waiting, id: "hidden", scope: "restricted" as const, modules: ["chatbot"] }
        const own = { ...waiting, id: "own", scope: "restricted" as const, modules: ["sales"] }
        facts.forView.mockResolvedValue([fact])
        facts.list.mockResolvedValue([waiting, hidden, own])
        const team: KnowledgeView = { ...view, module: "sales", audience: "internal" }

        const found = await recall.factsToOverview(team)

        expect(facts.forView).toHaveBeenCalledWith(view.workspaceId, "internal", "sales", null, 500)
        expect(facts.list).toHaveBeenCalledWith(view.workspaceId, { statuses: ["proposed"], limit: 500 })
        expect(found.map((one) => one.id)).toEqual(["fact-1", "waiting", "own"])
    })
})
