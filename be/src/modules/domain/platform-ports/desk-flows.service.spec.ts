import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import { AgentWorkflowsService } from "@modules/domain/agent-graphs"
import type { ActiveWorkflowGraph } from "@modules/domain/agent-graphs"
import { DeskFlowsService } from "./desk-flows.service"

type GraphEntry = Awaited<ReturnType<AgentWorkflowsService["graphOf"]>>["workflows"][number]

const entryOf = (over: Partial<GraphEntry>): GraphEntry => ({
    id: "wf-1",
    key: "answer",
    name: "Answer the team",
    status: "active",
    primary: false,
    activeNumber: 1,
    entry: "any",
    entryLabel: "",
    inputs: [],
    triggers: [],
    outcomes: [],
    calls: [],
    ...over,
})

const graphOf = (moduleKey: string): ActiveWorkflowGraph["graph"] => mock<ActiveWorkflowGraph["graph"]>({ moduleKey })

const build = async () => {
    const workflows = mock<AgentWorkflowsService>()
    workflows.graphOf.mockResolvedValue({
        agentId: "agent-1",
        workflows: [
            entryOf({ id: "wf-1", key: "lookup", name: "Look up" }),
            entryOf({ id: "wf-2", key: "main", name: "Main", primary: true }),
            entryOf({ id: "wf-3", key: "paused", name: "Paused", status: "paused" }),
            entryOf({ id: "wf-4", key: "broken", name: "Snapshot unreadable" }),
        ],
    })
    workflows.activeGraphsOf.mockResolvedValue([
        { workflowId: "wf-1", agentId: "agent-1", versionId: "v-1", graph: graphOf("crm") },
        { workflowId: "wf-2", agentId: "agent-1", versionId: "v-2", graph: graphOf("crm") },
        { workflowId: "wf-3", agentId: "agent-1", versionId: "v-3", graph: graphOf("crm") },
        { workflowId: "wf-9", agentId: "agent-2", versionId: "v-9", graph: graphOf("sales") },
    ])
    const moduleRef = await Test.createTestingModule({
        providers: [DeskFlowsService, { provide: AgentWorkflowsService, useValue: workflows }],
    }).compile()
    return { service: moduleRef.get(DeskFlowsService), workflows }
}

describe("DeskFlowsService: how an agent works", () => {
    it("lists the active workflows with the graph each runs, the primary first; a paused or unreadable one has no card", async () => {
        const { service, workflows } = await build()

        const view = await service.flows("ws-1", "agent-1", "vi")

        expect(view.flows.map((flow) => [flow.key, flow.name, flow.isPrimary])).toEqual([
            ["main", "Main", true],
            ["lookup", "Look up", false],
        ])
        expect(JSON.parse(view.flows[0]?.graphJson ?? "null")).toMatchObject({ moduleKey: "crm" })
        expect(workflows.graphOf).toHaveBeenCalledWith("ws-1", "agent-1", "vi")
        expect(workflows.activeGraphsOf).toHaveBeenCalledWith("ws-1")
    })
})
