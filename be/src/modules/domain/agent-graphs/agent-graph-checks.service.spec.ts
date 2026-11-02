import { createHash } from "node:crypto"
import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import type { GraphCheck } from "@modules/domain/authority-rules"
import { LOGGER } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import {
    AMOUNT_FACT,
    FACTS,
    OWNER_EXAMPLE,
    approverOf,
    branchOf,
    graphOf,
    nodeOf,
    stateOf,
} from "@tests/fixtures/builders/agent-graph.builder"
import { AgentGraphChecksService, closedAsOf, factsRead, outcomeOf } from "./agent-graph-checks.service"
import { AgentGraphDecisionsService } from "./agent-graph-decisions.service"
import { AgentGraphsLogEvent } from "./agent-graphs.log-events"
import { AgentGraphsService } from "./agent-graphs.service"
import type { OptionalGraphState } from "./agent-graphs.service"
import type { GraphWalk } from "./agent-graphs-walk.contracts"
import { GraphFactsService } from "./graph-facts.service"

const PAY = "pay_supplier"

const REQUEST: GraphCheck = {
    workspaceId: "ws-1",
    installationId: "inst-1",
    action: PAY,
    road: "reply",
    key: "m1:abc",
    subjectType: "conversation",
    subjectId: "conv-1",
    leadId: "lead-1",
    text: "Hello",
    evidence: null,
    attributes: {},
    turnId: "turn-1",
    wakeId: "wake-1",
    askOpensWork: false,
}

const DIGEST = createHash("sha256").update(REQUEST.key).digest("hex")

const build = async (
    state: OptionalGraphState = stateOf({ mode: "enforced" }),
    facts: Record<string, number | undefined> = { [AMOUNT_FACT]: 7_200_000 },
) => {
    const logger = mock<Logger>()
    const graphs = mock<AgentGraphsService>({ stateOfInstallation: jest.fn().mockResolvedValue(state) })
    const reader = mock<GraphFactsService>({
        registry: jest.fn().mockReturnValue(FACTS),
        read: jest.fn().mockResolvedValue(facts),
    })
    const decisions = mock<AgentGraphDecisionsService>({ record: jest.fn().mockResolvedValue("decision-1") })
    const moduleRef = await Test.createTestingModule({
        providers: [
            AgentGraphChecksService,
            { provide: LOGGER, useValue: logger },
            { provide: AgentGraphsService, useValue: graphs },
            { provide: GraphFactsService, useValue: reader },
            { provide: AgentGraphDecisionsService, useValue: decisions },
        ],
    }).compile()
    return { service: moduleRef.get(AgentGraphChecksService), graphs, reader, decisions, logger }
}

const walkOf = (overrides: Partial<GraphWalk>): GraphWalk => ({
    outcome: "run",
    path: [],
    branchKey: "",
    approver: null,
    divert: null,
    unread: [],
    unjudged: null,
    ...overrides,
})

describe("agent-graph-checks.service outcomeOf, closedAsOf and factsRead", () => {
    it("calls a run that went through `auto`, and keeps the other outcomes as they are", () => {
        expect(outcomeOf(walkOf({ outcome: "run" }))).toBe("auto")
        expect(outcomeOf(walkOf({ outcome: "unheld" }))).toBe("auto")
        expect(outcomeOf(walkOf({ outcome: "ask" }))).toBe("ask")
        expect(outcomeOf(walkOf({ outcome: "stop" }))).toBe("stop")
        expect(outcomeOf(walkOf({ outcome: "divert" }))).toBe("divert")
    })

    it("closes the work only for a walk that ended it", () => {
        expect(closedAsOf(walkOf({ outcome: "stop" }))).toBe("stopped")
        expect(closedAsOf(walkOf({ outcome: "divert" }))).toBe("stopped")
        expect(closedAsOf(walkOf({ outcome: "ask" }))).toBeNull()
        expect(closedAsOf(walkOf({ outcome: "run" }))).toBeNull()
        expect(closedAsOf(walkOf({ outcome: "unheld" }))).toBeNull()
    })

    it("keeps only the facts that were read", () => {
        expect(factsRead({ a: 1, b: undefined, c: "x", d: false })).toEqual({ a: 1, c: "x", d: false })
    })
})

describe("AgentGraphChecksService.walk", () => {
    it("reads the facts of the walk of the action and walks the graph on them", async () => {
        const { service, reader } = await build()
        const document = graphOf(OWNER_EXAMPLE)
        const subject = { type: "conversation", id: "conv-1", workItemId: "" }

        const walked = await service.walk("ws-1", document, PAY, subject)

        expect(reader.read).toHaveBeenCalledWith("ws-1", { ...subject, money: undefined }, [AMOUNT_FACT])
        expect(walked.read).toEqual({ [AMOUNT_FACT]: 7_200_000 })
        expect(walked.registry).toBe(FACTS)
        expect(walked.walk).toMatchObject({ outcome: "ask", branchKey: "middle", path: ["decide", "ask", "act"] })
    })

    it("hands the readers only the evidence the trigger of the graph accepts", async () => {
        const { service, reader } = await build()
        const base = graphOf(OWNER_EXAMPLE)
        const document = {
            ...base,
            nodes: base.nodes.map((node) =>
                node.kind === "trigger" ? nodeOf({ ...node, triggerSources: ["sepay"] }) : node,
            ),
        }
        const claim = { key: "amount_vnd", value: 100, kind: "claimed", via: "chat_text" }
        const feed = { key: "amount_vnd", value: 200, kind: "received", via: "sepay" }

        await service.walk("ws-1", document, PAY, {
            type: "conversation",
            id: "c1",
            workItemId: "",
            evidence: [claim, feed],
        })

        expect(reader.read.mock.calls[0]?.[1].evidence).toEqual([feed])
    })

    it("passes the options on, so a road a decide point alone judges finds no approval", async () => {
        const { service } = await build()
        const document = {
            nodes: [
                nodeOf({ key: "ask", step: "approval", approver: approverOf(), next: ["act"], sources: [] }),
                nodeOf({ key: "act", action: "send_quote", next: [], sources: [] }),
            ],
            rights: [],
        }
        const subject = { type: "conversation", id: "c1", workItemId: "" }

        const decided = await service.walk("ws-1", document, "send_quote", subject, { decideOnly: true })
        const asked = await service.walk("ws-1", document, "send_quote", subject)

        expect(decided.walk.outcome).toBe("unheld")
        expect(asked.walk.outcome).toBe("ask")
    })
})

describe("AgentGraphChecksService.check answers run", () => {
    it("for work of no agent, an agent with no graph and a graph with no version yet, and writes nothing", async () => {
        const noInstallation = await build()
        const noGraph = await build(null)
        const noVersion = await build(stateOf({ activeVersionId: null, active: null, mode: "enforced" }))

        await expect(noInstallation.service.check({ ...REQUEST, installationId: null })).resolves.toEqual({
            outcome: "run",
            unread: [],
            unjudged: null,
            divert: null,
        })
        await expect(noGraph.service.check(REQUEST)).resolves.toMatchObject({ outcome: "run" })
        await expect(noVersion.service.check(REQUEST)).resolves.toMatchObject({ outcome: "run" })
        expect(noInstallation.graphs.stateOfInstallation).not.toHaveBeenCalled()
        expect(noGraph.decisions.record).not.toHaveBeenCalled()
        expect(noVersion.decisions.record).not.toHaveBeenCalled()
    })

    it("for a graph the owner put in shadow that cannot be read", async () => {
        const { service, decisions } = await build(stateOf({ mode: "shadow", active: null }))

        await expect(service.check(REQUEST)).resolves.toMatchObject({ outcome: "run" })
        expect(decisions.record).not.toHaveBeenCalled()
    })

    it("for a graph in shadow, which records what it would have done and decides nothing", async () => {
        const { service, decisions } = await build(stateOf({ mode: "shadow" }))

        await expect(service.check(REQUEST)).resolves.toEqual({
            outcome: "run",
            unread: [],
            unjudged: null,
            divert: null,
        })

        expect(decisions.record).toHaveBeenCalledWith(
            expect.objectContaining({ mode: "shadow", outcome: "ask", shadowDiff: true, closedAs: null }),
        )
    })

    it("for an action no node holds, and records the run as one the graph does not hold", async () => {
        const { service, decisions } = await build()

        await expect(service.check({ ...REQUEST, action: "send_quote" })).resolves.toEqual({
            outcome: "run",
            unread: [],
            unjudged: null,
            divert: null,
        })

        expect(decisions.record).toHaveBeenCalledWith(
            expect.objectContaining({ outcome: "auto", unjudged: "not_in_graph", shadowDiff: false, path: [] }),
        )
    })
})

describe("AgentGraphChecksService.check on an enforced graph", () => {
    it("records one run for what it judged, keyed on the road and the digest of the key, and answers the walk", async () => {
        const { service, decisions } = await build(stateOf({ mode: "enforced" }), { [AMOUNT_FACT]: 1_000_000 })

        await expect(service.check(REQUEST)).resolves.toEqual({
            outcome: "run",
            unread: [],
            unjudged: null,
            divert: null,
        })

        expect(decisions.record).toHaveBeenCalledTimes(1)
        expect(decisions.record).toHaveBeenCalledWith({
            workspaceId: "ws-1",
            agentId: "agent-1",
            workItemId: null,
            dedupeKey: `reply:${DIGEST}`,
            road: "reply",
            mode: "enforced",
            gateVerdict: null,
            versionId: "version-1",
            turnId: "turn-1",
            wakeId: "wake-1",
            action: PAY,
            path: ["decide", "act"],
            facts: { [AMOUNT_FACT]: 1_000_000 },
            branchKey: "small",
            outcome: "auto",
            shadowDiff: false,
            unread: [],
            unjudged: null,
            subjectType: "conversation",
            subjectId: "conv-1",
            closedAs: null,
        })
    })

    it("asks, naming what it could not read, and records the ask", async () => {
        const { service, decisions } = await build(stateOf({ mode: "enforced" }), {})

        await expect(service.check(REQUEST)).resolves.toEqual({
            outcome: "ask",
            unread: [AMOUNT_FACT],
            unjudged: "fact_unread",
            divert: null,
        })

        expect(decisions.record).toHaveBeenCalledWith(
            expect.objectContaining({ outcome: "ask", shadowDiff: true, facts: {}, unread: [AMOUNT_FACT] }),
        )
    })

    it("reads the facts of a subject with no id as an empty id", async () => {
        const { service, reader } = await build()

        await service.check({ ...REQUEST, subjectId: null })

        expect(reader.read).toHaveBeenCalledWith(
            "ws-1",
            expect.objectContaining({ id: "", workItemId: "", text: "Hello", leadId: "lead-1", attributes: {} }),
            [AMOUNT_FACT],
        )
    })

    it("records no second run for an ask that opens a work item, which records the run itself", async () => {
        const { service, decisions } = await build()

        await expect(service.check({ ...REQUEST, askOpensWork: true })).resolves.toMatchObject({ outcome: "ask" })

        expect(decisions.record).not.toHaveBeenCalled()
    })

    it("still records a run that runs or stops when the road opens work for an ask", async () => {
        const run = await build(stateOf({ mode: "enforced" }), { [AMOUNT_FACT]: 1_000_000 })

        await run.service.check({ ...REQUEST, askOpensWork: true })

        expect(run.decisions.record).toHaveBeenCalledTimes(1)
    })
})

describe("AgentGraphChecksService.check on an enforced graph that ends the work", () => {
    it("stops, closes the run as stopped and answers no divert", async () => {
        const stopping = graphOf([
            ...OWNER_EXAMPLE.slice(0, 2),
            branchOf({ key: "else", when: "else", then: "stop", next: "stop", approver: null }),
        ])
        const { service, decisions } = await build(stateOf({ mode: "enforced", active: stopping }), {
            [AMOUNT_FACT]: 30_000_000,
        })

        await expect(service.check(REQUEST)).resolves.toEqual({
            outcome: "stop",
            unread: [],
            unjudged: null,
            divert: null,
        })

        expect(decisions.record).toHaveBeenCalledWith(
            expect.objectContaining({ outcome: "stop", closedAs: "stopped", shadowDiff: true }),
        )
    })

    it("diverts to the action the path leads to and says which", async () => {
        const base = graphOf([
            branchOf({ key: "else", when: "else", then: "ask", next: "hand", approver: approverOf() }),
        ])
        const diverting = {
            ...base,
            nodes: [
                ...base.nodes.filter((node) => node.key !== "act" && node.key !== "end"),
                nodeOf({ key: "hand", action: "hand_over_conversation", handoverTo: "support", next: [] }),
            ],
        }
        const { service, decisions } = await build(stateOf({ mode: "enforced", active: diverting }))

        await expect(service.check(REQUEST)).resolves.toEqual({
            outcome: "divert",
            unread: [],
            unjudged: null,
            divert: { action: "hand_over_conversation", handoverTo: "support", asks: true },
        })

        expect(decisions.record).toHaveBeenCalledWith(
            expect.objectContaining({ outcome: "divert", closedAs: "stopped" }),
        )
    })

    it("reads a tool road by its decide point alone", async () => {
        const base = graphOf(OWNER_EXAMPLE)
        const approvalOnly = {
            ...base,
            nodes: base.nodes
                .filter((node) => node.decide === undefined)
                .map((node) => (node.key === "act" ? nodeOf({ ...node, action: "gateway_call" }) : node)),
        }
        const reply = await build(stateOf({ mode: "enforced", active: approvalOnly }))
        const tool = await build(stateOf({ mode: "enforced", active: approvalOnly }))

        await expect(reply.service.check({ ...REQUEST, action: "gateway_call" })).resolves.toMatchObject({
            outcome: "ask",
        })
        await expect(tool.service.check({ ...REQUEST, action: "gateway_call", road: "tool" })).resolves.toMatchObject({
            outcome: "run",
        })
        expect(tool.decisions.record).toHaveBeenCalledWith(
            expect.objectContaining({ road: "tool", unjudged: "not_in_graph" }),
        )
    })
})

describe("AgentGraphChecksService.check when the graph cannot be read", () => {
    it("asks, saying the version cannot be read, when an enforced graph holds no readable version", async () => {
        const { service, decisions } = await build(stateOf({ mode: "enforced", active: null }))

        await expect(service.check(REQUEST)).resolves.toEqual({
            outcome: "ask",
            unread: [],
            unjudged: "unreadable",
            divert: null,
        })
        expect(decisions.record).not.toHaveBeenCalled()
    })

    it("asks, saying it failed, and logs the key when the store or a reader fails", async () => {
        const { service, graphs, logger } = await build()
        graphs.stateOfInstallation.mockRejectedValue(new Error("db down"))

        await expect(service.check(REQUEST)).resolves.toEqual({
            outcome: "ask",
            unread: [],
            unjudged: "failed",
            divert: null,
        })

        expect(logger.error).toHaveBeenCalledWith(AgentGraphsLogEvent.DecideFailed, expect.any(Error), {
            key: "m1:abc",
        })
    })
})
