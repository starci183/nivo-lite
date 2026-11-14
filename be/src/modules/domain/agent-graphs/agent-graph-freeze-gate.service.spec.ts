import { Test } from "@nestjs/testing"
import { fakeTransaction, mock, mockEntityManager } from "@starci/jest-preset"
import type { GraphSpec } from "@nivo-lite/agent-sdk/graph"
import { AgentRunsService } from "@modules/domain/agent-runs"
import { AgentWorkHandlersService } from "@modules/domain/agent-work"
import { GraphNodeRegistryService } from "@modules/domain/graph-nodes"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { stateOf } from "@tests/fixtures/builders/agent-graph.builder"
import { runViewOf } from "@tests/fixtures/builders/agent-runs.builder"
import { agentTurnViewOf } from "@tests/fixtures/builders/agent-work.builder"
import { AgentGraphFlowRunsService } from "./agent-graph-flow-runs.service"
import type { FlowThreadRun, FlowThreads } from "./agent-graph-flow-runs.service"
import { AgentGraphCallGuardService } from "./agent-graph-call-guard.service"
import { AgentGraphFreezeGateService } from "./agent-graph-freeze-gate.service"
import type { FlowFreezePort } from "./agent-graph-freeze-gate.service"
import { AgentGraphsService } from "./agent-graphs.service"

const FLOW: GraphSpec = {
    schema: "nivo/agent-graph@1",
    moduleKey: "sales",
    trigger: { kind: "tag", sources: ["agent"] },
    grant: { tools: [], effects: [] },
    nodes: [{ key: "end", kind: "output", step: "stop" }],
}

/** A hand-off wake about a customer: the verb `workflow.called` names the person (a conversation: the customer subject), so a freeze may hold it. */
const TURN = agentTurnViewOf({ source: "tag", context: { authorAgentId: "agent-2", text: "order", conversationId: "conv-1" } })

const buildGate = async () => {
    const moduleRef = await Test.createTestingModule({ providers: [AgentGraphFreezeGateService] }).compile()
    return { gate: moduleRef.get(AgentGraphFreezeGateService) }
}

/** What waits for the founder for the customer of the specs: the step a frozen workflow stopped on, and since when. */
const WAITING = [{ step: "Mark paid", since: "2026-11-10T04:00:00.000Z" }]

const portOf = (held: boolean) =>
    mock<FlowFreezePort>({
        hold: jest.fn().mockResolvedValue(held),
        frozen: jest.fn().mockResolvedValue(held),
        waitingOf: jest.fn().mockResolvedValue(held ? WAITING : []),
    })

describe("AgentGraphFreezeGateService", () => {
    it("holds nothing and freezes nothing while no capability keeps freezes", async () => {
        const { gate } = await buildGate()
        await expect(gate.hold(TURN, {})).resolves.toBe(false)
        await expect(gate.frozen("ws-1", { leadId: "lead-1" })).resolves.toBe(false)
        await expect(gate.waitingOf("ws-1", { leadId: "lead-1" })).resolves.toEqual([])
    })

    it("asks the freezes whether a workflow of a customer is frozen and what waits for the founder, recording nothing itself", async () => {
        const { gate } = await buildGate()
        const port = portOf(true)
        gate.set(port)
        const trigger = { conversationId: "c-1", workflowId: "wf-consult" }

        await expect(gate.frozen("ws-1", trigger)).resolves.toBe(true)
        await expect(gate.waitingOf("ws-1", trigger)).resolves.toEqual(WAITING)

        expect(port.frozen).toHaveBeenCalledWith("ws-1", trigger)
        expect(port.waitingOf).toHaveBeenCalledWith("ws-1", trigger)
        expect(port.hold).not.toHaveBeenCalled()
    })

    it("asks the freezes registered last", async () => {
        const { gate } = await buildGate()
        const first = portOf(false)
        const last = portOf(true)
        gate.set(first)
        gate.set(last)

        await expect(gate.hold(TURN, { leadId: "lead-1" })).resolves.toBe(true)

        expect(last.hold).toHaveBeenCalledWith(TURN, { leadId: "lead-1" })
        expect(first.hold).not.toHaveBeenCalled()
    })

    it("tells a node step of a graph apart", async () => {
        const { gate } = await buildGate()
        expect(gate.isNodeStep("graph_node")).toBe(true)
        expect(gate.isNodeStep("tool")).toBe(false)
    })
})

/** The thread runs as the flow sees them: every run they are handed is kept, in order. */
const threadsOf = () => {
    const started: Array<FlowThreadRun> = []
    const threads = mock<FlowThreads>({
        owns: jest.fn().mockReturnValue(false),
        opened: jest.fn().mockResolvedValue(undefined),
        started: jest.fn((run: FlowThreadRun) => {
            started.push(run)
            return Promise.resolve({ status: "done" as const, reason: null, outcome: { runId: run.runId } })
        }),
    })
    return { threads, started }
}

/** The start of a run with the gate and the call guard as doubles, and the thread runs registered. */
const buildFlows = async (held: boolean, refusal: string | null = null, waiting: typeof WAITING = []) => {
    const gate = mock<AgentGraphFreezeGateService>({
        hold: jest.fn().mockResolvedValue(held),
        waitingOf: jest.fn().mockResolvedValue(waiting),
    })
    const calls = mock<AgentGraphCallGuardService>({ refusalOf: jest.fn().mockResolvedValue(refusal) })
    const graphs = mock<AgentGraphsService>({
        stateOfAgent: jest
            .fn()
            .mockResolvedValue(
                stateOf({ activeVersionId: "version-1", active: { nodes: [], flow: FLOW } }),
            ),
    })
    const runs = mock<AgentRunsService>({ open: jest.fn().mockResolvedValue(runViewOf({ id: "run-1" })) })
    const { threads, started } = threadsOf()
    const nodes = mock<GraphNodeRegistryService>({ installed: jest.fn().mockReturnValue({ nodes: new Map() }) })
    const handlers = mock<AgentWorkHandlersService>()
    const tx = fakeTransaction(mockEntityManager())
    const moduleRef = await Test.createTestingModule({
        providers: [
            AgentGraphFlowRunsService,
            { provide: PRIMARY_ENTITY_MANAGER, useValue: tx.em },
            { provide: AgentGraphsService, useValue: graphs },
            { provide: AgentRunsService, useValue: runs },
            { provide: AgentWorkHandlersService, useValue: handlers },
            { provide: GraphNodeRegistryService, useValue: nodes },
            { provide: AgentGraphFreezeGateService, useValue: gate },
            { provide: AgentGraphCallGuardService, useValue: calls },
        ],
    }).compile()
    const flows = moduleRef.get(AgentGraphFlowRunsService)
    flows.setThreads(threads)
    return { flows, runs, gate, threads, started }
}

describe("AgentGraphFreezeGateService at the start of a run", () => {
    it("is asked before any run opens: a held wake opens no run and starts no thread, it ends held as a pending event", async () => {
        const { flows, runs, gate, threads } = await buildFlows(true)

        await expect(flows.run(TURN)).resolves.toEqual({ status: "held", reason: "lead_frozen", outcome: null })

        expect(gate.hold).toHaveBeenCalledWith(TURN, expect.objectContaining({ text: "order", origin: "agent" }))
        expect(runs.open).not.toHaveBeenCalled()
        expect(threads.started).not.toHaveBeenCalled()
    })

    it("asks about the workflow the wake runs, so a freeze of another workflow of the customer does not hold it", async () => {
        const { flows, gate } = await buildFlows(false)

        await flows.run(TURN)

        // The agent's own graph is no workflow: the wake is asked about with no workflow, and only a freeze of the whole customer holds it.
        expect(gate.hold).toHaveBeenCalledWith(TURN, expect.objectContaining({ text: "order", workflowId: null }))
    })

    it("tells the thread's trigger what of the customer waits for the founder, and nothing of the kind when nothing waits", async () => {
        const waited = await buildFlows(false, null, WAITING)
        await waited.flows.run(TURN)

        expect(waited.gate.waitingOf).toHaveBeenCalledWith("ws-1", expect.objectContaining({ text: "order" }))
        expect(waited.started[0]?.trigger).toMatchObject({ text: "order", waitingOnFounder: WAITING })

        const plain = await buildFlows(false)
        await plain.flows.run(TURN)

        expect(plain.started[0]?.trigger).not.toHaveProperty("waitingOnFounder")
    })

    it("lets the run open and its thread start when the customer is not frozen", async () => {
        const { flows, runs, threads } = await buildFlows(false)
        await expect(flows.run(TURN)).resolves.toMatchObject({ status: "done" })
        expect(runs.open).toHaveBeenCalledTimes(1)
        expect(threads.started).toHaveBeenCalledTimes(1)
    })

    it("starts no run of a call the engine's guards refuse: the wake is skipped with why", async () => {
        const { flows, runs, threads } = await buildFlows(false, "call_duplicate")
        await expect(flows.run(TURN)).resolves.toEqual({ status: "skipped", reason: "call_duplicate", outcome: null })
        expect(runs.open).not.toHaveBeenCalled()
        expect(threads.started).not.toHaveBeenCalled()
    })
})
