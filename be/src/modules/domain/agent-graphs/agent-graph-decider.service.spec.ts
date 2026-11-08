import { Test } from "@nestjs/testing"
import type { GraphSpec } from "@nivo-lite/agent-sdk/graph"
import { mock } from "@starci/jest-preset"
import type { GraphAnswer, GraphCheck } from "@modules/domain/authority-rules"
import { LOGGER } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import {
    AMOUNT_FACT,
    FACTS,
    OWNER_EXAMPLE,
    branchOf,
    graphOf,
    stateOf,
} from "@tests/fixtures/builders/agent-graph.builder"
import {
    AUTO,
    DECIDED_ITEM as item,
    DIVERT_WALK as DIVERT,
    MODEL,
    OVER,
    STOP_WALK as STOP,
    UNHELD_WALK as UNHELD,
    deciderRequestOf,
} from "@tests/fixtures/builders/agent-graph-decider.builder"
import { itemOf } from "@tests/fixtures/builders/work-engine.builder"
import type { AgentGraphApprovalsService } from "./agent-graph-approvals.service"
import { AgentGraphChecksService } from "./agent-graph-checks.service"
import { AGENT_GRAPH_APPROVALS } from "./agent-graphs.decorators"
import { AgentGraphDecisionsService } from "./agent-graph-decisions.service"
import { AgentGraphDeciderService } from "./agent-graph-decider.service"
import { AgentGraphsLogEvent } from "./agent-graphs.log-events"
import { AgentGraphsService } from "./agent-graphs.service"
import type { GraphState } from "./agent-graphs.service"
import type { GraphDocument } from "./agent-graphs.contracts"
import type { FactSubject } from "./agent-graphs.port"
import type { GraphWalk } from "./agent-graphs-walk.contracts"
import { walkGraph } from "./policies/graph-walk.policy"
import type { WalkOptions } from "./policies/graph-walk.policy"

const FLOW_ONLY: GraphSpec = {
    schema: "nivo/agent-graph@1",
    moduleKey: "sales",
    trigger: { kind: "tag", sources: ["channel"] },
    grant: { rights: [], tools: [], effects: [] },
    nodes: [{ key: "end", kind: "output", step: "stop" }],
}
const FLOW_ONLY_GRAPH: GraphDocument = { nodes: [], rights: [], flow: FLOW_ONLY }

const gateOf = (verdict: typeof AUTO | typeof OVER = AUTO) => jest.fn().mockResolvedValue(verdict)

interface BuildOptions {
    readonly facts?: Record<string, number | undefined>
    /** A walk the checks double answers instead of walking the graph. */
    readonly walk?: GraphWalk
    readonly walkError?: Error
}

const build = async (state: GraphState | null, options: BuildOptions = {}) => {
    const facts = options.facts ?? { [AMOUNT_FACT]: 7_200_000 }
    const logger = mock<Logger>()
    const graphs = mock<AgentGraphsService>({ stateOfInstallation: jest.fn().mockResolvedValue(state) })
    const checks = mock<AgentGraphChecksService>({
        walk: jest.fn(
            (
                _workspaceId: string,
                document: GraphDocument,
                action: string,
                _subject: FactSubject,
                walkOptions?: WalkOptions,
            ) =>
                options.walkError === undefined
                    ? Promise.resolve({
                          walk: options.walk ?? walkGraph(document, action, facts, FACTS, walkOptions),
                          read: facts,
                          registry: FACTS,
                      })
                    : Promise.reject(options.walkError),
        ),
        check: jest.fn(),
    })
    const decisions = mock<AgentGraphDecisionsService>({ record: jest.fn().mockResolvedValue("decision-1") })
    const approvals = mock<AgentGraphApprovalsService>({
        route: jest.fn().mockResolvedValue(undefined),
        mayDecide: jest.fn().mockResolvedValue(false),
    })
    const moduleRef = await Test.createTestingModule({
        providers: [
            AgentGraphDeciderService,
            { provide: LOGGER, useValue: logger },
            { provide: AgentGraphsService, useValue: graphs },
            { provide: AgentGraphChecksService, useValue: checks },
            { provide: AgentGraphDecisionsService, useValue: decisions },
            { provide: AGENT_GRAPH_APPROVALS, useValue: approvals },
        ],
    }).compile()
    return { service: moduleRef.get(AgentGraphDeciderService), graphs, checks, decisions, logger, approvals }
}

describe("AgentGraphDeciderService.decide leaves the item to the gate", () => {
    it("when the item has no installation, or the installation has no graph", async () => {
        const noGraph = await build(null)
        const loose = await build(stateOf({ mode: "enforced" }))

        await expect(noGraph.service.decide(deciderRequestOf(gateOf()))).resolves.toBeNull()
        await expect(
            loose.service.decide(deciderRequestOf(gateOf(), { item: itemOf({ installation_id: null }) })),
        ).resolves.toBeNull()
        expect(noGraph.decisions.record).not.toHaveBeenCalled()
        expect(loose.graphs.stateOfInstallation).not.toHaveBeenCalled()
    })

    it("when the graph has no version yet, or the graph the owner put in shadow cannot be read", async () => {
        const noVersion = await build(stateOf({ activeVersionId: null, active: null }))
        const unreadable = await build(stateOf({ mode: "shadow", active: null }))

        await expect(noVersion.service.decide(deciderRequestOf(gateOf()))).resolves.toBeNull()
        await expect(unreadable.service.decide(deciderRequestOf(gateOf()))).resolves.toBeNull()
        expect(noVersion.decisions.record).not.toHaveBeenCalled()
        expect(unreadable.decisions.record).not.toHaveBeenCalled()
        expect(unreadable.checks.walk).not.toHaveBeenCalled()
    })

    it("when the agent runs a flow and holds none of the old nodes: the old walk has nothing to judge, so the gate alone answers", async () => {
        const flowOnly = await build(stateOf({ mode: "enforced", active: FLOW_ONLY_GRAPH }))

        await expect(flowOnly.service.decide(deciderRequestOf(gateOf()))).resolves.toBeNull()
        expect(flowOnly.checks.walk).not.toHaveBeenCalled()
        expect(flowOnly.decisions.record).not.toHaveBeenCalled()
    })

    it("when no node holds the action, and still records the run as one the graph does not hold", async () => {
        const enforced = await build(stateOf({ mode: "enforced" }), { walk: UNHELD })
        const shadow = await build(stateOf({ mode: "shadow" }), { walk: UNHELD })
        const gate = gateOf(AUTO)

        await expect(enforced.service.decide(deciderRequestOf(gate))).resolves.toBeNull()
        await expect(shadow.service.decide(deciderRequestOf(gateOf(AUTO)))).resolves.toBeNull()

        expect(gate).toHaveBeenCalledWith(MODEL)
        expect(enforced.decisions.record).toHaveBeenCalledWith(
            expect.objectContaining({
                outcome: "auto",
                unjudged: "not_in_graph",
                path: [],
                branchKey: "",
                closedAs: null,
                mode: "enforced",
            }),
        )
        expect(shadow.decisions.record).toHaveBeenCalledWith(expect.objectContaining({ mode: "shadow" }))
    })
})

describe("AgentGraphDeciderService.decide when the graph cannot judge", () => {
    it("asks the people who govern when an enforced graph cannot be read, and names no decision", async () => {
        const built = await build(stateOf({ mode: "enforced", active: null }))
        const gate = gateOf(AUTO)

        const judgement = await built.service.decide(deciderRequestOf(gate))

        expect(judgement).toEqual({
            proposal: MODEL,
            verdict: { verdict: "ask", reason: "branch_ask", reasons: ["branch_ask"], missing: [] },
            decisionId: null,
            stopped: false,
            divert: null,
        })
        expect(built.decisions.record).not.toHaveBeenCalled()
    })

    it("asks, and says so in the log, when reading or walking the graph fails", async () => {
        const built = await build(stateOf({ mode: "enforced" }), { walkError: new Error("db down") })

        const judgement = await built.service.decide(deciderRequestOf(gateOf(AUTO)))

        expect(judgement).toMatchObject({
            verdict: { verdict: "ask", reason: "branch_ask" },
            decisionId: null,
            stopped: false,
            divert: null,
        })
        expect(built.logger.error).toHaveBeenCalledWith(AgentGraphsLogEvent.DecideFailed, expect.any(Error), {
            workItemId: "item-9",
        })
    })

    it("asks even when the graph that failed was only recording, because nothing may fall through to run alone", async () => {
        const built = await build(stateOf({ mode: "shadow" }))
        built.graphs.stateOfInstallation.mockRejectedValue(new Error("db down"))

        await expect(built.service.decide(deciderRequestOf(gateOf(AUTO)))).resolves.toMatchObject({ decisionId: null })
    })
})

describe("AgentGraphDeciderService.decide in shadow", () => {
    it("records the run with the version, the path, the facts and the model amount beside the real one, and changes nothing", async () => {
        const built = await build(stateOf({ mode: "shadow" }))
        const gate = gateOf(AUTO)

        await expect(built.service.decide(deciderRequestOf(gate))).resolves.toBeNull()

        expect(built.decisions.record).toHaveBeenCalledWith({
            workspaceId: "ws-1",
            agentId: "agent-1",
            workItemId: "item-9",
            dedupeKey: null,
            road: "work",
            mode: "shadow",
            gateVerdict: "auto",
            versionId: "version-1",
            turnId: "turn-1",
            wakeId: "wake-1",
            action: "pay_supplier",
            path: ["decide", "ask", "act"],
            facts: { [AMOUNT_FACT]: 7_200_000, "model.amount_vnd": 4_900_000 },
            branchKey: "middle",
            outcome: "ask",
            shadowDiff: true,
            unread: [],
            unjudged: null,
            subjectType: "order",
            subjectId: "payment-1",
            closedAs: null,
        })
        expect(gate).toHaveBeenCalledWith(MODEL)
    })

    it("marks no difference when the graph answers what the gate answers", async () => {
        const built = await build(stateOf({ mode: "shadow" }), { facts: { [AMOUNT_FACT]: 1_000_000 } })

        await built.service.decide(deciderRequestOf(gateOf(AUTO), { proposal: { ...MODEL, amount_vnd: 1_000_000 } }))

        expect(built.decisions.record).toHaveBeenCalledWith(
            expect.objectContaining({ branchKey: "small", outcome: "auto", shadowDiff: false }),
        )
    })
})

describe("AgentGraphDeciderService.decide records the facts", () => {
    it("keeps only the facts that were read in the decision", async () => {
        const built = await build(stateOf({ mode: "shadow" }), {
            facts: { [AMOUNT_FACT]: 7_200_000, "order.unseen": undefined },
        })

        await built.service.decide(deciderRequestOf(gateOf(AUTO)))

        expect(built.decisions.record).toHaveBeenCalledWith(
            expect.objectContaining({ facts: { [AMOUNT_FACT]: 7_200_000, "model.amount_vnd": 4_900_000 } }),
        )
    })

    it("keeps no model amount when the model wrote the amount the records hold", async () => {
        const built = await build(stateOf({ mode: "enforced" }), { facts: { [AMOUNT_FACT]: 4_900_000 } })

        await built.service.decide(deciderRequestOf(gateOf(AUTO)))

        expect(built.decisions.record).toHaveBeenCalledWith(
            expect.objectContaining({ facts: { [AMOUNT_FACT]: 4_900_000 } }),
        )
    })
})

describe("AgentGraphDeciderService.decide enforced", () => {
    it("judges the amount the records hold and not the one the model wrote, and keeps both in the decision", async () => {
        const built = await build(stateOf({ mode: "enforced" }))
        const gate = gateOf(AUTO)

        const judgement = await built.service.decide(deciderRequestOf(gate))

        expect(gate).toHaveBeenCalledWith({ ...MODEL, amount_vnd: 7_200_000, fields: { amount_vnd: 7_200_000 } })
        expect(judgement?.proposal.amount_vnd).toBe(7_200_000)
        expect(judgement?.decisionId).toBe("decision-1")
        expect(built.decisions.record).toHaveBeenCalledWith(
            expect.objectContaining({
                facts: { [AMOUNT_FACT]: 7_200_000, "model.amount_vnd": 4_900_000 },
                mode: "enforced",
                closedAs: null,
            }),
        )
    })

    it("asks on the branch approver when the branch asks under a gate that would run alone", async () => {
        const built = await build(stateOf({ mode: "enforced" }))

        const judgement = await built.service.decide(deciderRequestOf(gateOf(AUTO)))

        expect(judgement?.verdict).toMatchObject({ verdict: "ask", reason: "branch_ask" })
        expect(judgement).toMatchObject({ stopped: false, divert: null })
    })

    it("lets a branch that runs alone stand under a gate that runs alone, and never beats a gate that asks", async () => {
        const facts = { [AMOUNT_FACT]: 1_000_000 }
        const small = await build(stateOf({ mode: "enforced" }), { facts })
        const smallAsked = await build(stateOf({ mode: "enforced" }), { facts })

        expect((await small.service.decide(deciderRequestOf(gateOf(AUTO))))?.verdict).toEqual(AUTO)
        expect((await smallAsked.service.decide(deciderRequestOf(gateOf(OVER))))?.verdict).toEqual(OVER)
    })

    it("stops a branch that stops, as a closed rule would, and closes the run as stopped", async () => {
        const stopping = graphOf([
            ...OWNER_EXAMPLE.slice(0, 2),
            branchOf({ key: "else", when: "else", outcome: "stop", approver: null, next: "stop" }),
        ])
        const built = await build(stateOf({ mode: "enforced", active: stopping }), {
            facts: { [AMOUNT_FACT]: 30_000_000 },
        })

        const judgement = await built.service.decide(deciderRequestOf(gateOf(AUTO)))

        expect(judgement?.verdict).toMatchObject({ verdict: "ask", reason: "not_allowed" })
        expect(judgement?.stopped).toBe(true)
        expect(built.decisions.record).toHaveBeenCalledWith(
            expect.objectContaining({ outcome: "stop", branchKey: "else", closedAs: "stopped" }),
        )
    })

    it("carries the hand-over a branch names, leaves the verdict to the gate and marks the run as different", async () => {
        const built = await build(stateOf({ mode: "enforced" }), { walk: DIVERT })

        const judgement = await built.service.decide(deciderRequestOf(gateOf(AUTO)))

        expect(judgement).toMatchObject({
            verdict: AUTO,
            stopped: false,
            divert: { action: "hand_over_conversation", handoverTo: "support", asks: false },
        })
        expect(built.decisions.record).toHaveBeenCalledWith(
            expect.objectContaining({ outcome: "divert", shadowDiff: true, closedAs: "stopped" }),
        )
    })
})

describe("AgentGraphDeciderService.decide enforced and unable to read everything", () => {
    it("records why a walk could not judge, and the facts it could not read", async () => {
        const built = await build(stateOf({ mode: "enforced" }), { walk: STOP, facts: {} })

        await built.service.decide(deciderRequestOf(gateOf(AUTO)))

        expect(built.decisions.record).toHaveBeenCalledWith(
            expect.objectContaining({ unread: ["supplier_payment.kind"], unjudged: "fact_unread", facts: {} }),
        )
    })

    it("takes the else when a fact cannot be read, and never runs alone on a guess", async () => {
        const built = await build(stateOf({ mode: "enforced" }), { facts: {} })

        const judgement = await built.service.decide(deciderRequestOf(gateOf(AUTO)))

        expect(judgement?.verdict).toMatchObject({ verdict: "ask", reason: "branch_ask" })
        expect(judgement?.proposal).toBe(MODEL)
        expect(built.decisions.record).toHaveBeenCalledWith(
            expect.objectContaining({ branchKey: "else", facts: {}, unread: [AMOUNT_FACT], unjudged: "fact_unread" }),
        )
    })

    it("records no turn for work that did not come from one", async () => {
        const built = await build(stateOf({ mode: "enforced" }))

        await built.service.decide(deciderRequestOf(gateOf(AUTO), { turnId: null, wakeId: null }))

        expect(built.decisions.record).toHaveBeenCalledWith(expect.objectContaining({ turnId: null, wakeId: null }))
    })

    it("counts as the amount of the work only a fact that is not about the text", async () => {
        const registry = {
            ...FACTS,
            "outgoing.amount_vnd": { ...FACTS[AMOUNT_FACT], key: "outgoing.amount_vnd", notWorkAmount: true },
        }
        const built = await build(stateOf({ mode: "enforced" }))
        built.checks.walk.mockResolvedValue({
            walk: { ...DIVERT, outcome: "run", divert: null },
            read: { "outgoing.amount_vnd": 9_000_000, [AMOUNT_FACT]: 7_200_000 },
            registry,
        })
        const gate = gateOf(AUTO)

        await built.service.decide(deciderRequestOf(gate))

        expect(gate).toHaveBeenCalledWith({ ...MODEL, amount_vnd: 7_200_000, fields: { amount_vnd: 7_200_000 } })
    })
})

describe("AgentGraphDeciderService.decide names the work to the walk", () => {
    it("gives the walk the record, the text, the customer, the call and the evidence of the work item", async () => {
        const built = await build(stateOf({ mode: "enforced" }))
        const proposal = {
            ...MODEL,
            draft: "Pay now",
            fields: { tool: "gmail.send", to: "support" },
            evidence: [{ key: "amount_vnd", value: 4_900_000, kind: "received", via: "sepay" }],
        }

        await built.service.decide(deciderRequestOf(gateOf(AUTO), { proposal }))

        expect(built.checks.walk).toHaveBeenCalledWith("ws-1", graphOf(OWNER_EXAMPLE), "pay_supplier", {
            type: "order",
            id: "payment-1",
            workItemId: "item-9",
            amountVnd: 4_900_000,
            text: "Pay now",
            leadId: "lead-1",
            attributes: { "tool.name": "gmail.send", "tool.connector": "gmail", "handover.to": "support" },
            evidence: [{ key: "amount_vnd", value: 4_900_000, kind: "received", via: "sepay" }],
        })
    })

    it("names an empty subject id for an item that has none, and no evidence when the proposal carries none", async () => {
        const built = await build(stateOf({ mode: "enforced" }))

        await built.service.decide(deciderRequestOf(gateOf(AUTO), { item: itemOf({ ...item, subject_id: null }) }))

        expect(built.checks.walk).toHaveBeenCalledWith("ws-1", expect.anything(), "pay_supplier", {
            type: "order",
            id: "",
            workItemId: "item-9",
            amountVnd: 4_900_000,
            text: undefined,
            leadId: "lead-1",
            attributes: {},
            evidence: [],
        })
    })
})

describe("AgentGraphDeciderService.check", () => {
    it("answers what the checks service answers for something that leaves with no work item", async () => {
        const { service, checks } = await build(null)
        const answer: GraphAnswer = { outcome: "stop", unread: [], unjudged: null, divert: null }
        const request: GraphCheck = {
            workspaceId: "ws-1",
            installationId: "inst-1",
            action: "reply_customer",
            road: "reply",
            key: "reply:abc",
            subjectType: "conversation",
            subjectId: "conv-1",
            leadId: null,
            text: "Hello",
            evidence: null,
            attributes: {},
            turnId: null,
            wakeId: null,
            askOpensWork: false,
        }
        checks.check.mockResolvedValue(answer)

        await expect(service.check(request)).resolves.toBe(answer)
        expect(checks.check).toHaveBeenCalledWith(request)
    })
})

describe("AgentGraphDeciderService the approval road", () => {
    it("hands a waiting item to the approval road of its branch, and asks it who may answer", async () => {
        const { service, approvals } = await build(stateOf())
        const route = { workspaceId: "ws-1", workItemId: "item-9", decisionId: "decision-1" }
        const answerer = { workspaceId: "ws-1", workItemId: "item-9", memberId: "member-1", isOwner: false }

        await service.route(route)

        await expect(service.mayDecide(answerer)).resolves.toBe(false)
        expect(approvals.route).toHaveBeenCalledWith(route)
        expect(approvals.mayDecide).toHaveBeenCalledWith(answerer)
    })

    it("leaves a waiting item with the people who govern, and lets any seat answer, when no approval road is bound", async () => {
        const moduleRef = await Test.createTestingModule({
            providers: [
                AgentGraphDeciderService,
                { provide: LOGGER, useValue: mock<Logger>() },
                { provide: AgentGraphsService, useValue: mock<AgentGraphsService>() },
                { provide: AgentGraphChecksService, useValue: mock<AgentGraphChecksService>() },
                { provide: AgentGraphDecisionsService, useValue: mock<AgentGraphDecisionsService>() },
                { provide: AGENT_GRAPH_APPROVALS, useValue: null },
            ],
        }).compile()
        const service = moduleRef.get(AgentGraphDeciderService)

        await expect(
            service.route({ workspaceId: "ws-1", workItemId: "item-9", decisionId: "decision-1" }),
        ).resolves.toBeUndefined()
        await expect(
            service.mayDecide({ workspaceId: "ws-1", workItemId: "item-9", memberId: "member-1", isOwner: false }),
        ).resolves.toBe(true)
    })
})
