import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import { MemberGrantsService } from "@modules/domain/member-grants"
import { InstallationRecordsService } from "@modules/domain/module-installations"
import { MESSAGE_CATALOG } from "@modules/platform/i18n"
import type { MessageCatalog } from "@modules/platform/i18n"
import { OWNER_EXAMPLE, approverOf, branchOf, contextOf, graphOf, stateOf } from "@tests/fixtures/builders/agent-graph.builder"
import { AgentGraphContextService } from "./agent-graph-context.service"
import { AgentGraphProposalsService } from "./agent-graph-proposals.service"
import { AgentGraphViewService } from "./agent-graph-view.service"
import { AgentGraphsError, AgentGraphsErrorCode } from "./errors/agent-graphs.error"
import { AgentGraphsService } from "./agent-graphs.service"
import type { OptionalGraphState } from "./agent-graphs.service"

const PROPOSAL = { id: "p1", kind: "learned", status: "open", nodeKey: null, branchKey: null, widens: false, evidence: [], createdAt: "2026-11-01T00:00:00.000Z" } as const

const build = async (state: OptionalGraphState, installed = true) => {
    const graphs = mock<AgentGraphsService>({ stateOfAgent: jest.fn().mockResolvedValue(state) })
    const context = mock<AgentGraphContextService>({ contextOf: jest.fn().mockResolvedValue(contextOf()) })
    const proposals = mock<AgentGraphProposalsService>({ openOf: jest.fn().mockResolvedValue([PROPOSAL]) })
    const installations = mock<InstallationRecordsService>({
        findById: jest.fn().mockResolvedValue(installed ? { id: "inst-1", moduleKey: "accounting" } : null),
    })
    const members = mock<MemberGrantsService>({
        directory: jest.fn().mockResolvedValue([{ memberId: "dinh", name: "Dinh", role: "manager", roomId: null, status: "active", rooms: [] }]),
    })
    const catalog = mock<MessageCatalog>({ get: jest.fn((key: string, params?: Record<string, string | number>) => `[${key}${params?.name ?? ""}]`) })
    const moduleRef = await Test.createTestingModule({
        providers: [
            AgentGraphViewService,
            { provide: AgentGraphsService, useValue: graphs },
            { provide: AgentGraphContextService, useValue: context },
            { provide: AgentGraphProposalsService, useValue: proposals },
            { provide: InstallationRecordsService, useValue: installations },
            { provide: MemberGrantsService, useValue: members },
            { provide: MESSAGE_CATALOG, useValue: catalog },
        ],
    }).compile()
    return moduleRef.get(AgentGraphViewService)
}

describe("AgentGraphViewService.viewOf", () => {
    it("shows the draft with its gaps, its problems, a card for every node and the proposals waiting for a person", async () => {
        const service = await build(stateOf({ mode: "enforced" }))

        const view = await service.viewOf("ws-1", "agent-1", "en")

        expect(view).toMatchObject({
            agentId: "agent-1",
            installationId: "inst-1",
            mode: "enforced",
            draftRev: 1,
            activeVersionId: "version-1",
            gaps: [],
            problems: [],
            proposals: [PROPOSAL],
        })
        expect(view.cards.map((card) => card.id)).toEqual(["start", "decide", "act", "ask", "end"])
    })

    it("names the person who approves on the card, in the catalog words of the language asked", async () => {
        const ask = graphOf([branchOf({ key: "else", when: "else", then: "ask", next: "ask", approver: approverOf() })])
        const service = await build(stateOf({ draft: ask }))

        const view = await service.viewOf("ws-1", "agent-1", "vi")

        expect(view.cards.find((card) => card.id === "ask")?.description).toBe("[agentGraphs.card.approvesDinh]")
        expect(view.cards.find((card) => card.id === "act")?.description).toBe("")
    })

    it("lists what is wrong and what is vague in the draft", async () => {
        const vague = graphOf([branchOf({ key: "else", when: "else", then: "ask", next: "ask", approver: null })])
        const service = await build(stateOf({ draft: vague }))

        const view = await service.viewOf("ws-1", "agent-1", "en")

        expect(view.problems.map((problem) => problem.code)).toEqual(["approver_missing"])
        expect(view.gaps.map((gap) => gap.code)).toEqual(["approver_missing"])
    })

    it("refuses an agent with no graph, and a graph whose installation is gone", async () => {
        const none = await build(null)
        const gone = await build(stateOf(), false)

        await expect(none.viewOf("ws-1", "agent-1", "en")).rejects.toEqual(expect.objectContaining({ code: AgentGraphsErrorCode.GraphNotFound }))
        await expect(gone.viewOf("ws-1", "agent-1", "en")).rejects.toBeInstanceOf(AgentGraphsError)
        expect(OWNER_EXAMPLE).toHaveLength(3)
    })
})
