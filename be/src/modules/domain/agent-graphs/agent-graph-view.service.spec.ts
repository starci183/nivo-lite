import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import { AGENTS_INSTALLATIONS } from "@modules/domain/agents"
import type { InstallationDirectory, OptionalContextVersion } from "@modules/domain/agents"
import { BrainFactsService } from "@modules/domain/brain-facts"
import { MemberGrantsService } from "@modules/domain/member-grants"
import { InstallationRecordsService } from "@modules/domain/module-installations"
import { MESSAGE_CATALOG } from "@modules/platform/i18n"
import type { MessageCatalog } from "@modules/platform/i18n"
import {
    OWNER_EXAMPLE,
    approverOf,
    branchOf,
    contextOf,
    graphOf,
    nodeOf,
    stateOf,
} from "@tests/fixtures/builders/agent-graph.builder"
import { AgentGraphContextService } from "./agent-graph-context.service"
import { AgentGraphProposalsService } from "./agent-graph-proposals.service"
import { AgentGraphViewService } from "./agent-graph-view.service"
import { AgentGraphsError, AgentGraphsErrorCode } from "./errors/agent-graphs.error"
import { AgentGraphsService } from "./agent-graphs.service"
import type { OptionalGraphState } from "./agent-graphs.service"

const PROPOSAL = {
    id: "p1",
    kind: "learned",
    status: "open",
    nodeKey: null,
    branchKey: null,
    widens: false,
    evidence: [],
    createdAt: "2026-11-01T00:00:00.000Z",
} as const

const CONFLICT = {
    id: "p2",
    kind: "conflict",
    status: "open",
    nodeKey: "decide",
    branchKey: "small",
    widens: false,
    evidence: ["fact-1", "fact-2"],
    createdAt: "2026-11-01T00:00:00.000Z",
} as const

const NO_RULES: OptionalContextVersion = { version: 1, summary: "A spa", gates: [], facts: [], toneEvidence: "" }

const build = async (
    state: OptionalGraphState,
    installed = true,
    waiting: ReadonlyArray<object> = [PROPOSAL],
    version: OptionalContextVersion = NO_RULES,
    versionId: string | null = "context-1",
) => {
    const graphs = mock<AgentGraphsService>({ stateOfAgent: jest.fn().mockResolvedValue(state) })
    const context = mock<AgentGraphContextService>({ contextOf: jest.fn().mockResolvedValue(contextOf()) })
    const proposals = mock<AgentGraphProposalsService>({ openOf: jest.fn().mockResolvedValue(waiting) })
    const installations = mock<InstallationRecordsService>({
        findById: jest
            .fn()
            .mockResolvedValue(
                installed ? { id: "inst-1", moduleKey: "accounting", activeContextVersionId: versionId } : null,
            ),
    })
    const directory = mock<InstallationDirectory>({ contextVersionOf: jest.fn().mockResolvedValue(version) })
    const members = mock<MemberGrantsService>({
        directory: jest
            .fn()
            .mockResolvedValue([
                { memberId: "dinh", name: "Dinh", role: "manager", roomId: null, status: "active", rooms: [] },
            ]),
    })
    const brain = mock<BrainFactsService>({
        get: jest
            .fn()
            .mockImplementation((_workspaceId: string, id: string) =>
                Promise.resolve({ id, value: id === "fact-1" ? "Under 5M" : "Under 10M" }),
            ),
    })
    const catalog = mock<MessageCatalog>({
        get: jest.fn((key: string, params?: Record<string, string | number>) => `[${key}${params?.name ?? ""}]`),
    })
    const moduleRef = await Test.createTestingModule({
        providers: [
            AgentGraphViewService,
            { provide: AgentGraphsService, useValue: graphs },
            { provide: AgentGraphContextService, useValue: context },
            { provide: AgentGraphProposalsService, useValue: proposals },
            { provide: InstallationRecordsService, useValue: installations },
            { provide: MemberGrantsService, useValue: members },
            { provide: BrainFactsService, useValue: brain },
            { provide: MESSAGE_CATALOG, useValue: catalog },
            { provide: AGENTS_INSTALLATIONS, useValue: directory },
        ],
    }).compile()
    return { service: moduleRef.get(AgentGraphViewService), directory, brain }
}

describe("AgentGraphViewService.viewOf", () => {
    it("shows the draft with its gaps, its problems, a card for every node and the proposals waiting for a person", async () => {
        const { service } = await build(stateOf({ mode: "enforced" }))

        const view = await service.viewOf("ws-1", "agent-1", "en")

        expect(view).toMatchObject({
            agentId: "agent-1",
            installationId: "inst-1",
            mode: "enforced",
            draftRev: 1,
            isDraftChanged: false,
            activeVersionId: "version-1",
            gaps: [],
            problems: [],
            proposals: [PROPOSAL],
        })
        expect(view.cards.map((card) => card.id)).toEqual(["start", "decide", "act", "ask", "end"])
    })

    it("names the person who approves on the card, in the catalog words of the language asked", async () => {
        const ask = graphOf([
            branchOf({ key: "else", when: "else", outcome: "ask", next: "ask", approver: approverOf() }),
        ])
        const { service } = await build(stateOf({ draft: ask }))

        const view = await service.viewOf("ws-1", "agent-1", "vi")

        expect(view.cards.find((card) => card.id === "ask")?.description).toBe("[agentGraphs.card.approvesDinh]")
        expect(view.cards.find((card) => card.id === "act")?.description).toBe("")
    })

    it("says the draft has something to publish when it differs from the version that decides", async () => {
        const edited = graphOf([
            branchOf({ key: "else", when: "else", outcome: "ask", next: "ask", approver: approverOf() }),
        ])
        const { service } = await build(stateOf({ draft: edited }))

        const view = await service.viewOf("ws-1", "agent-1", "en")

        expect(view.isDraftChanged).toBe(true)
    })

    it("lists what is wrong and what is vague in the draft", async () => {
        const vague = graphOf([branchOf({ key: "else", when: "else", outcome: "ask", next: "ask", approver: null })])
        const { service } = await build(stateOf({ draft: vague }))

        const view = await service.viewOf("ws-1", "agent-1", "en")

        expect(view.problems.map((problem) => problem.code)).toEqual(["approver_missing"])
        expect(view.gaps.map((gap) => gap.code)).toEqual(["approver_missing"])
    })

    it("offers the facts a condition may be written on, in the words of the language asked", async () => {
        const { service } = await build(stateOf())

        const view = await service.viewOf("ws-1", "agent-1", "vi")

        expect(view.facts).toContainEqual({
            key: "supplier_payment.kind",
            label: "[fact.kind]",
            type: "string",
            unit: null,
            allowed: ["rent", "stock"],
        })
        expect(view.facts.map((fact) => fact.key)).toHaveLength(3)
    })
})

describe("AgentGraphViewService.viewOf > conflicts and refusals", () => {
    it("gives a conflict the rule the graph follows and the rule the Brain says now, side by side", async () => {
        const { service } = await build(stateOf(), true, [CONFLICT])

        const view = await service.viewOf("ws-1", "agent-1", "vi")

        expect(view.proposals).toEqual([{ ...CONFLICT, before: "Under 5M", after: "Under 10M" }])
    })

    it("keeps the approved cited passage even after the old Brain fact has disappeared", async () => {
        const sources = [
            { kind: "brain" as const, factId: "other", passage: "Other rule", valueHash: "old" },
            { kind: "brain" as const, factId: "fact-1", passage: "Approved under 3M", valueHash: "approved" },
        ]
        const draft = { nodes: [nodeOf({ key: "citing", sources })], rights: [] }
        const { service, brain } = await build(stateOf({ draft }), true, [CONFLICT])
        brain.get.mockResolvedValue(null)

        const view = await service.viewOf("ws-1", "agent-1", "en")

        expect(view.proposals).toEqual([{ ...CONFLICT, before: "Approved under 3M", after: "" }])
    })

    it("shows empty passages when neither a citation nor either Brain fact remains", async () => {
        const { service, brain } = await build(stateOf(), true, [CONFLICT])
        brain.get.mockResolvedValue(null)

        const view = await service.viewOf("ws-1", "agent-1", "en")

        expect(view.proposals).toEqual([{ ...CONFLICT, before: "", after: "" }])
    })
})

describe("AgentGraphViewService.viewOf the rules the graph does not hold", () => {
    it("lists the sums the published setup states as a rule that no condition of the graph holds", async () => {
        const rules: OptionalContextVersion = {
            version: 2,
            summary: "Don tren 8 trieu phai xin y kien chu.",
            gates: [{ label: "Pay", evidence: "Chi tren 8 trieu thi cho chu duyet" }],
            facts: ["Open 9 to 6"],
            toneEvidence: "",
        }
        const { service, directory } = await build(stateOf(), true, [], rules)

        const view = await service.viewOf("ws-1", "agent-1", "en")

        expect(view.unheldRules).toEqual([{ amountVnd: 8_000_000, quote: "Don tren 8 trieu phai xin y kien chu" }])
        expect(directory.contextVersionOf).toHaveBeenCalledWith("context-1")
    })

    it("lists no unheld rule when no setup is published or the published one is gone", async () => {
        const unpublished = await build(stateOf(), true, [], NO_RULES, null)
        const gone = await build(stateOf(), true, [], null)

        await expect(unpublished.service.viewOf("ws-1", "agent-1", "en")).resolves.toMatchObject({ unheldRules: [] })
        await expect(gone.service.viewOf("ws-1", "agent-1", "en")).resolves.toMatchObject({ unheldRules: [] })
        expect(unpublished.directory.contextVersionOf).not.toHaveBeenCalled()
    })
})

describe("AgentGraphViewService.viewOf refusals", () => {
    it("refuses an agent with no graph, and a graph whose installation is gone", async () => {
        const { service: none } = await build(null)
        const { service: gone } = await build(stateOf(), false)

        await expect(none.viewOf("ws-1", "agent-1", "en")).rejects.toEqual(
            expect.objectContaining({ code: AgentGraphsErrorCode.GraphNotFound }),
        )
        await expect(gone.viewOf("ws-1", "agent-1", "en")).rejects.toBeInstanceOf(AgentGraphsError)
        expect(OWNER_EXAMPLE).toHaveLength(3)
    })
})

describe("AgentGraphViewService.viewOf the warnings of the contracts", () => {
    it("shows a contract the graph cannot use as a warning that stops nothing", async () => {
        const draft = {
            ...graphOf(OWNER_EXAMPLE),
            contracts: [{ intent: "give_discount", task: "", limits: [], sources: [] }],
        }
        const { service } = await build(stateOf({ draft }))

        const view = await service.viewOf("ws-1", "agent-1", "en")

        expect(view.problems).toEqual([])
        expect(view.warnings.map((warning) => [warning.code, warning.detail])).toEqual([
            ["contract_unknown_intent", "give_discount"],
            ["contract_no_task", "give_discount"],
        ])
    })

    it("shows none for a graph with no contracts block", async () => {
        const { service } = await build(stateOf())

        await expect(service.viewOf("ws-1", "agent-1", "en")).resolves.toMatchObject({ warnings: [] })
    })
})
