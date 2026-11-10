import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import type { GraphSpec, GraphSpecNode } from "@nivo-lite/agent-sdk/graph"
import type { JsonValue } from "@nivo-lite/agent-sdk/schema"
import type { WorkflowRecord } from "../agent-workflows.contracts"
import { AGENT_LABELS } from "@nivo-lite/blocks-core/graph"
import * as policy from "./workflow-graph.policy"
import type { WorkflowGraphTarget } from "./workflow-graph.policy"

const SUBJECT = Symbol("workflow-graph.policy")

/** The policy, bound as a kit double over its real functions. */
const policyDouble = mock<typeof policy>({ ...policy })

/** The policy as Nest hands it to a caller. */
const buildPolicy = async (): Promise<typeof policy> => {
    const moduleRef = await Test.createTestingModule({
        providers: [{ provide: SUBJECT, useValue: policyDouble }],
    }).compile()
    return moduleRef.get<typeof policy>(SUBJECT)
}


const WORKFLOW: WorkflowRecord = {
    id: "wf-1",
    workspaceId: "ws-1",
    fence: "f-1",
    agentId: "agent-chatbot",
    key: "front-desk",
    name: "Front desk",
    status: "active",
    primary: true,
    position: 0,
    activeVersionId: "v-3",
    latestNumber: 3,
    template: null,
    createdBy: null,
    createdAt: new Date("2026-11-02T00:00:00.000Z"),
    updatedAt: new Date("2026-11-02T00:00:00.000Z"),
}

const node = (key: string, step: string, params: Record<string, JsonValue>, next?: string): GraphSpecNode => ({
    key,
    kind: "execute",
    step,
    params,
    ...(next === undefined ? {} : { next }),
})

const GRAPH: GraphSpec = {
    schema: "nivo/agent-graph@1",
    moduleKey: "chatbot",
    trigger: { kind: "tag", sources: ["channel"] },
    contract: { inputs: [{ name: "text", type: "string", required: true }] },
    triggers: [{ key: "zalo", source: { kind: "zalo", connectionId: "oa-1" } }],
    outcomes: [{ key: "sell", label: "Customer wants to buy", outputs: [{ name: "leadId", type: "string" }] }],
    entry: { openTo: "agent" },
    grant: { rights: [], tools: [], effects: [] },
    nodes: [
        node("end", "core.outcome", { outcome: "sell", outputs: { leadId: { $ref: "trigger.leadId" } } }, "hand"),
        node("hand", "core.call-workflow", { agent: "sales", workflow: "consult", version: "latest", inputs: {} }),
        node("far", "core.call-workflow", { agent: "sales", workflow: "gone", version: 2, inputs: {} }),
    ],
}

const TARGETS: ReadonlyArray<WorkflowGraphTarget> = [
    { agentId: "agent-sales", moduleKey: "sales", key: "consult", name: "Consult" },
    { agentId: "agent-chatbot", moduleKey: "sales", key: "consult", name: "Consult (own)" },
]

describe("workflowGraphEntryOf", () => {
    it("reads a workflow with its contract, triggers, outcomes, entry and the hand-offs it ends with", async () => {
        const subject = await buildPolicy()
        const entry = subject.workflowGraphEntryOf(WORKFLOW, GRAPH, 3, TARGETS, "en")

        expect(entry).toMatchObject({
            id: "wf-1",
            key: "front-desk",
            name: "Front desk",
            status: "active",
            primary: true,
            activeNumber: 3,
            entry: "agent",
            inputs: [{ name: "text", type: "string", required: true }],
            triggers: [{ key: "zalo", sourceKind: "zalo", connectionId: "oa-1" }],
            outcomes: [{ key: "sell", label: "Customer wants to buy", outputs: [{ name: "leadId", type: "string" }] }],
        })
        expect(entry.entryLabel).not.toBe("")
        expect(entry.triggers[0]?.sourceLabel).not.toBe("")
    })

    it("names the target of a hand-off, preferring the workflow of the calling agent, and flags a call across agents", async () => {
        const subject = await buildPolicy()
        const entry = subject.workflowGraphEntryOf(WORKFLOW, GRAPH, 3, TARGETS, "vi")

        expect(entry.calls).toEqual([
            {
                nodeKey: "hand",
                outcome: "sell",
                agent: "sales",
                agentLabel: AGENT_LABELS.sales?.vi,
                workflow: "consult",
                workflowName: "Consult (own)",
                version: "latest",
                crossAgent: false,
            },
            {
                nodeKey: "far",
                outcome: null,
                agent: "sales",
                agentLabel: AGENT_LABELS.sales?.vi,
                workflow: "gone",
                workflowName: null,
                version: "2",
                crossAgent: true,
            },
        ])
        expect(subject.workflowGraphEntryOf(WORKFLOW, GRAPH, 3, TARGETS.slice(0, 1), "vi").calls[0]).toMatchObject({
            workflowName: "Consult",
            crossAgent: true,
        })
    })

})

describe("workflowGraphEntryOf: a workflow with nothing to draw", () => {
    it("reads a workflow that runs nothing as open to any, with nothing drawn", async () => {
        const subject = await buildPolicy()
        const entry = subject.workflowGraphEntryOf({ ...WORKFLOW, status: "draft" }, null, null, TARGETS, "en")

        expect(entry).toMatchObject({
            status: "draft",
            activeNumber: null,
            entry: "any",
            entryLabel: "",
            inputs: [],
            triggers: [],
            outcomes: [],
            calls: [],
        })
    })

    it("reads a graph from before contracts as open to any with no triggers", async () => {
        const subject = await buildPolicy()
        const old: GraphSpec = { ...GRAPH, nodes: [] }
        const { contract: _contract, triggers: _triggers, outcomes: _outcomes, entry: _entry, ...bare } = old

        expect(subject.workflowGraphEntryOf(WORKFLOW, bare, 1, TARGETS, "en")).toMatchObject({
            entry: "any",
            inputs: [],
            triggers: [],
            outcomes: [],
            calls: [],
        })
    })
})
