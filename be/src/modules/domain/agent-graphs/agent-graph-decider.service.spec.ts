import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import type { BranchRequest } from "@modules/domain/authority-rules"
import { LOGGER } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { AMOUNT_FACT, FACTS, OWNER_EXAMPLE, branchOf, graphOf, stateOf } from "@tests/fixtures/builders/agent-graph.builder"
import { itemOf } from "@tests/fixtures/builders/work-engine.builder"
import { AgentGraphDecisionsService } from "./agent-graph-decisions.service"
import { AgentGraphDeciderService } from "./agent-graph-decider.service"
import { AgentGraphsLogEvent } from "./agent-graphs.log-events"
import { AgentGraphsService } from "./agent-graphs.service"
import type { GraphState } from "./agent-graphs.service"
import { GraphFactsService } from "./graph-facts.service"

const AUTO = { verdict: "auto", reason: "routine", reasons: ["routine"], missing: [] } as const
const OVER = { verdict: "ask", reason: "over_authority", reasons: ["over_authority"], missing: [] } as const
const MODEL = { summary: "Pay", fields: { amount_vnd: 4_900_000 }, amount_vnd: 4_900_000 }

const item = itemOf({ id: "item-9", action: "pay_supplier", subject_type: "order", subject_id: "payment-1", installation_id: "inst-1" })

const build = async (state: GraphState | null, facts: Record<string, number> | Error = { [AMOUNT_FACT]: 7_200_000 }) => {
    const logger = mock<Logger>()
    const graphs = mock<AgentGraphsService>({ stateOfInstallation: jest.fn().mockResolvedValue(state) })
    const reader = mock<GraphFactsService>({
        registry: jest.fn().mockReturnValue(FACTS),
        read: facts instanceof Error ? jest.fn().mockRejectedValue(facts) : jest.fn().mockResolvedValue(facts),
    })
    const decisions = mock<AgentGraphDecisionsService>({ record: jest.fn().mockResolvedValue("decision-1") })
    const moduleRef = await Test.createTestingModule({
        providers: [
            AgentGraphDeciderService,
            { provide: LOGGER, useValue: logger },
            { provide: AgentGraphsService, useValue: graphs },
            { provide: GraphFactsService, useValue: reader },
            { provide: AgentGraphDecisionsService, useValue: decisions },
        ],
    }).compile()
    return { service: moduleRef.get(AgentGraphDeciderService), graphs, reader, decisions, logger }
}

const requestOf = (gate: BranchRequest["gate"], overrides: Partial<BranchRequest> = {}): BranchRequest => ({
    workspaceId: "ws-1",
    item,
    proposal: MODEL,
    gate,
    turnId: "turn-1",
    wakeId: "wake-1",
    ...overrides,
})

const gateOf = (verdict: typeof AUTO | typeof OVER = AUTO) => jest.fn().mockResolvedValue(verdict)

describe("AgentGraphDeciderService.decide leaves the item to the gate", () => {
    it("when the item has no installation, or the installation has no graph", async () => {
        const noGraph = await build(null)
        const loose = await build(stateOf({ mode: "enforced" }))

        await expect(noGraph.service.decide(requestOf(gateOf()))).resolves.toBeNull()
        await expect(loose.service.decide(requestOf(gateOf(), { item: itemOf({ installation_id: null }) }))).resolves.toBeNull()
        expect(noGraph.decisions.record).not.toHaveBeenCalled()
        expect(loose.graphs.stateOfInstallation).not.toHaveBeenCalled()
    })

    it("when the graph has no version yet, or no decide point for the action, or the branch cannot be picked", async () => {
        const noVersion = await build(stateOf({ activeVersionId: null, active: null }))
        const noPoint = await build(stateOf({ mode: "enforced" }))
        const noBranch = await build(
            stateOf({ mode: "enforced", active: graphOf(OWNER_EXAMPLE.slice(0, 1)) }),
            { [AMOUNT_FACT]: 6_000_000 },
        )

        await expect(noVersion.service.decide(requestOf(gateOf()))).resolves.toBeNull()
        await expect(noPoint.service.decide(requestOf(gateOf(), { item: itemOf({ ...item, action: "other_action" }) }))).resolves.toBeNull()
        await expect(noBranch.service.decide(requestOf(gateOf()))).resolves.toBeNull()
        expect(noVersion.decisions.record).not.toHaveBeenCalled()
        expect(noPoint.decisions.record).not.toHaveBeenCalled()
        expect(noBranch.decisions.record).not.toHaveBeenCalled()
    })

    it("and says so in the log when reading the graph fails", async () => {
        const built = await build(stateOf({ mode: "enforced" }))
        built.graphs.stateOfInstallation.mockRejectedValue(new Error("db down"))

        await expect(built.service.decide(requestOf(gateOf()))).resolves.toBeNull()

        expect(built.logger.error).toHaveBeenCalledWith(AgentGraphsLogEvent.DecideFailed, expect.any(Error), { workItemId: "item-9" })
    })
})

describe("AgentGraphDeciderService.decide in shadow", () => {
    it("records the decision with the version, the path, the facts and the model amount beside the real one, and changes nothing", async () => {
        const built = await build(stateOf())
        const gate = gateOf(AUTO)

        await expect(built.service.decide(requestOf(gate))).resolves.toBeNull()

        expect(built.decisions.record).toHaveBeenCalledWith({
            workspaceId: "ws-1",
            agentId: "agent-1",
            workItemId: "item-9",
            versionId: "version-1",
            turnId: "turn-1",
            wakeId: "wake-1",
            action: "pay_supplier",
            path: ["decide", "ask"],
            facts: { [AMOUNT_FACT]: 7_200_000, "model.amount_vnd": 4_900_000 },
            branchKey: "middle",
            outcome: "ask",
            shadowDiff: true,
        })
        expect(gate).toHaveBeenCalledWith(MODEL)
    })

    it("marks no difference when the graph answers what the gate answers", async () => {
        const built = await build(stateOf(), { [AMOUNT_FACT]: 1_000_000 })

        await built.service.decide(requestOf(gateOf(AUTO), { proposal: { ...MODEL, amount_vnd: 1_000_000 } }))

        expect(built.decisions.record).toHaveBeenCalledWith(expect.objectContaining({ branchKey: "small", outcome: "auto", shadowDiff: false }))
    })
})

describe("AgentGraphDeciderService.decide enforced", () => {
    it("judges the amount the records hold and not the one the model wrote, and keeps both in the decision", async () => {
        const built = await build(stateOf({ mode: "enforced" }))
        const gate = gateOf(AUTO)

        const judgement = await built.service.decide(requestOf(gate))

        expect(gate).toHaveBeenCalledWith({ ...MODEL, amount_vnd: 7_200_000, fields: { amount_vnd: 7_200_000 } })
        expect(judgement?.proposal.amount_vnd).toBe(7_200_000)
        expect(judgement?.decisionId).toBe("decision-1")
        expect(built.decisions.record).toHaveBeenCalledWith(
            expect.objectContaining({ facts: { [AMOUNT_FACT]: 7_200_000, "model.amount_vnd": 4_900_000 } }),
        )
    })

    it("asks on the branch approver when the branch asks under a gate that would run alone", async () => {
        const built = await build(stateOf({ mode: "enforced" }))

        const judgement = await built.service.decide(requestOf(gateOf(AUTO)))

        expect(judgement?.verdict).toMatchObject({ verdict: "ask", reason: "branch_ask" })
    })

    it("lets a branch that runs alone stand under a gate that runs alone, and never beats a gate that asks", async () => {
        const small = await build(stateOf({ mode: "enforced" }), { [AMOUNT_FACT]: 1_000_000 })
        const smallAsked = await build(stateOf({ mode: "enforced" }), { [AMOUNT_FACT]: 1_000_000 })

        expect((await small.service.decide(requestOf(gateOf(AUTO))))?.verdict).toEqual(AUTO)
        expect((await smallAsked.service.decide(requestOf(gateOf(OVER))))?.verdict).toEqual(OVER)
    })

    it("stops a branch that stops, as a closed rule would", async () => {
        const stopping = graphOf([...OWNER_EXAMPLE.slice(0, 2), branchOf({ key: "else", when: "else", then: "stop", approver: null, next: "stop" })])
        const built = await build(stateOf({ mode: "enforced", active: stopping }), { [AMOUNT_FACT]: 30_000_000 })

        const judgement = await built.service.decide(requestOf(gateOf(AUTO)))

        expect(judgement?.verdict).toMatchObject({ verdict: "ask", reason: "not_allowed" })
        expect(built.decisions.record).toHaveBeenCalledWith(expect.objectContaining({ outcome: "stop", branchKey: "else" }))
    })

    it("takes the else when a fact cannot be read, and never runs alone on a guess", async () => {
        const built = await build(stateOf({ mode: "enforced" }), {})

        const judgement = await built.service.decide(requestOf(gateOf(AUTO)))

        expect(judgement?.verdict).toMatchObject({ verdict: "ask", reason: "branch_ask" })
        expect(judgement?.proposal).toBe(MODEL)
        expect(built.decisions.record).toHaveBeenCalledWith(expect.objectContaining({ branchKey: "else", facts: {} }))
    })

    it("reads no fact for an item with no record, and takes the else", async () => {
        const built = await build(stateOf({ mode: "enforced" }))

        const judgement = await built.service.decide(requestOf(gateOf(AUTO), { item: itemOf({ ...item, subject_id: null }) }))

        expect(built.reader.read).not.toHaveBeenCalled()
        expect(judgement?.verdict).toMatchObject({ reason: "branch_ask" })
    })

    it("records no turn for work that did not come from one", async () => {
        const built = await build(stateOf({ mode: "enforced" }))

        await built.service.decide(requestOf(gateOf(AUTO), { turnId: null, wakeId: null }))

        expect(built.decisions.record).toHaveBeenCalledWith(expect.objectContaining({ turnId: null, wakeId: null }))
    })
})
