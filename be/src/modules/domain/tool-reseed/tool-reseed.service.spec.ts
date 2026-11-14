import type { GraphSpec } from "@nivo-lite/agent-sdk/graph"
import type { WorkflowTemplate } from "@nivo-lite/agent-sdk/template"
import { createMock, type MockOf } from "@starci/jest-preset"
import type {
    AgentGraphFlowService,
    AgentGraphsService,
    AgentWorkflowInstallService,
    AgentWorkflowsService,
} from "@modules/domain/agent-graphs"
import type { AgentRunDrainService } from "@modules/domain/agent-runs"
import { INSTALLED } from "@modules/domain/installed-plugins"
import type { ToolGrantsService } from "@modules/domain/tool-grants"
import type { InstallationRecord, InstallationRecordsService } from "@modules/domain/module-installations"
import type { WorkspacesService } from "@modules/domain/workspaces"
import type { Logger } from "@modules/platform/logging"
import { reseedLinesOf } from "./tool-reseed.lines"
import { ToolReseedService } from "./tool-reseed.service"

const WS = "00000000-0000-4000-8000-000000000001"
const AGENT = "00000000-0000-4000-8000-0000000000a1"
const MAP = { json: { tools: { "acme.lead.message.send": "nivo.tool.customer.message.send" } }, path: "map.json" }

const graphOf = (step: string, tool = "nivo.tool.customer.message.send"): GraphSpec => ({
    schema: "nivo/agent-graph@1",
    moduleKey: "sales",
    trigger: { kind: "tag", sources: ["agent"] },
    grant: { tools: [tool], effects: [] },
    nodes: [{ key: "end", kind: "output", step }],
})

const templateOf = (id: string, primary: boolean, version: number, graph: GraphSpec): WorkflowTemplate => ({
    id,
    moduleKey: "sales",
    primary,
    name: { vi: id, en: id },
    summary: { vi: id, en: id },
    requires: [],
    shops: 0,
    versions: [{ version, publishedAt: "2026-11-12T00:00:00.000Z", changes: [{ vi: "n", en: "n" }], graph }],
})

const MAIN = graphOf("sales.reply")
const ROUND = graphOf("sales.round")

/** Every method of every double, by `<double>.<method>`: what a run read or wrote is exactly what was called. */
const created = new Map<string, jest.Mock>()
const doubleOf = <T extends object>(name: string): MockOf<T> =>
    createMock((property) => {
        const fn = jest.fn()
        created.set(`${name}.${property}`, fn)
        return fn
    })<T>()

const calledOf = (): ReadonlyArray<string> =>
    [...created.entries()].filter(([, fn]) => fn.mock.calls.length > 0).map(([key]) => key).toSorted()

/** The methods that WRITE, by the store they write. Anything called that is in neither list fails the spec. */
const WRITES: Readonly<Record<string, string>> = {
    "flows.publish": "graphs",
    "workflows.seedAgent": "workflows",
    "workflows.adoptTemplateVersion": "workflows",
    "workflows.setStatus": "workflows",
    "grants.rekeyTools": "tool_grants",
}
const READS: ReadonlyArray<string> = [
    "workspaces.list",
    "grants.toolKeysOf",
    "installations.list",
    "workflows.list",
    "workflows.activeGraphsOf",
    "installer.plan",
    "graphs.stateOfAgent",
    "flows.holds",
    "drain.countIn",
    "logger.info",
    "logger.error",
]

const INSTALLATION: InstallationRecord = {
    id: "00000000-0000-4000-8000-0000000000b1",
    workspaceId: WS,
    moduleKey: "sales",
    name: "Sales",
    isMulti: false,
    agentId: AGENT,
    status: "live",
    operatingMode: "autopilot",
    liveEnabled: true,
    activeContextVersionId: null,
    settings: {},
    createdAt: "2026-11-12T00:00:00.000Z",
}

const build = (open = 0) => {
    created.clear()
    jest.spyOn(INSTALLED, "templatesOf").mockReturnValue([
        templateOf("sales.main", true, 7, MAIN),
        templateOf("sales.round", false, 4, ROUND),
    ])
    const workspaces = doubleOf<WorkspacesService>("workspaces")
    const installations = doubleOf<InstallationRecordsService>("installations")
    const workflows = doubleOf<AgentWorkflowsService>("workflows")
    const installer = doubleOf<AgentWorkflowInstallService>("installer")
    const graphs = doubleOf<AgentGraphsService>("graphs")
    const flows = doubleOf<AgentGraphFlowService>("flows")
    const grants = doubleOf<ToolGrantsService>("grants")
    const drain = doubleOf<AgentRunDrainService>("drain")
    const logger = doubleOf<Logger>("logger")
    // Three grant rows: one under an old id the map moves, one under an id the map does not name, one already on a new id.
    grants.toolKeysOf.mockResolvedValue([
        { agentId: AGENT, tool: "acme.lead.message.send" },
        { agentId: AGENT, tool: "acme.retired.tool" },
        { agentId: "agent-2", tool: "nivo.tool.customer.message.send" },
    ])
    grants.rekeyTools.mockResolvedValue({ rekeyed: 1, merged: 0 })
    installations.list.mockResolvedValue([INSTALLATION, { ...INSTALLATION, id: "i2", agentId: null }])
    workflows.activeGraphsOf.mockResolvedValue([
        { workflowId: "main", agentId: AGENT, versionId: "v1", graph: graphOf("sales.reply-old", "acme.lead.message.send") },
        { workflowId: "round", agentId: AGENT, versionId: "v2", graph: graphOf("sales.round-old") },
        { workflowId: "gone", agentId: AGENT, versionId: "v3", graph: graphOf("sales.gone") },
        { workflowId: "blank", agentId: AGENT, versionId: "v4", graph: graphOf("x", "acme.lead.message.send") },
    ])
    const viewOf = (id: string, primary: boolean, templateId: string | null) => ({
        id,
        agentId: AGENT,
        key: id,
        name: id,
        status: "active" as const,
        primary,
        activeNumber: 1,
        latestNumber: 3,
        template: templateId === null ? null : { templateId, templateVersion: 2 },
        templateName: null,
        templateLatest: null,
        templateChangedSteps: null,
        stepCount: 1,
        updatedAt: "2026-11-12T00:00:00.000Z",
    })
    workflows.list.mockResolvedValue([
        viewOf("main", true, "sales.main"),
        viewOf("round", false, "sales.round"),
        viewOf("gone", false, "sales.gone"),
        viewOf("blank", false, null),
    ])
    installer.plan.mockResolvedValue([{ templateId: "sales.new", version: 1, primary: false, action: "add", status: null }])
    graphs.stateOfAgent.mockResolvedValue({
        workspaceId: WS,
        agentId: AGENT,
        installationId: INSTALLATION.id,
        mode: "enforced",
        draft: { nodes: [] },
        draftRev: 1,
        activeVersionId: "g1",
        active: { nodes: [], flow: graphOf("sales.reply-old") },
        activeKind: "spec",
    })
    flows.holds.mockResolvedValue(false)
    drain.countIn.mockResolvedValue(open)
    const service = new ToolReseedService(
        workspaces,
        installations,
        workflows,
        installer,
        graphs,
        flows,
        grants,
        drain,
        logger,
    )
    return { service, workflows, flows, grants, drain }
}

describe("ToolReseedService", () => {
    afterEach(() => {
        jest.restoreAllMocks()
    })

    it("plans every store on a dry run and writes nothing: only reads are called, the grants' re-key only counted", async () => {
        const { service, grants } = build()

        const report = await service.reseed({ workspaceId: WS, map: MAP })

        expect(report.executed).toBe(false)
        expect(report.refusal).toBeNull()
        expect(calledOf().filter((key) => !READS.includes(key))).toEqual([])
        expect(grants.toolKeysOf.mock.calls).toEqual([[WS]])
        expect(report.workspaces[0]?.plans.map((plan) => [plan.workflowId, plan.action, plan.oldIds])).toEqual([
            ["main", "republish", 1],
            ["round", "replace", 0],
            ["gone", "pause", 0],
            ["blank", "orphan", 1],
        ])
        expect(report.totals).toEqual({
            workflows: { found: 4, rewritten: 4, removed: 0, orphans: 1 },
            graphs: { found: 1, rewritten: 1, removed: 0, orphans: 0 },
            tool_grants: { found: 3, rewritten: 1, removed: 0, orphans: 0 },
        })
    })

    it("writes, when drained, ONLY through the write roads of its three stores, in order, and never a history store", async () => {
        const { service, workflows, flows, grants } = build()

        const report = await service.reseed({ workspaceId: WS, map: MAP, execute: true })

        expect(report.executed).toBe(true)
        const writes = calledOf().filter((key) => !READS.includes(key))
        expect(writes).toEqual(Object.keys(WRITES).toSorted())
        expect(calledOf().every((key) => READS.includes(key) || key in WRITES)).toBe(true)
        expect(flows.publish.mock.calls[0]?.[0]).toMatchObject({ workspaceId: WS, agentId: AGENT, flow: MAIN })
        expect(workflows.seedAgent.mock.calls).toEqual([[WS, AGENT, "sales"]])
        expect(workflows.adoptTemplateVersion.mock.calls).toEqual([
            [
                WS,
                "round",
                { templateId: "sales.round", templateVersion: 4 },
                { kind: "system", memberId: null },
                3,
                "re-seed levels2026_11_12: the template's current version",
            ],
        ])
        expect(workflows.setStatus.mock.calls).toEqual([[WS, "gone", "paused"]])
        // The flow is published before the install road adopts it.
        expect(flows.publish.mock.invocationCallOrder[0]).toBeLessThan(workflows.seedAgent.mock.invocationCallOrder[0] ?? 0)
        // The grants are re-keyed by the map's moves that a row holds, first, then the workflows are written.
        expect(grants.rekeyTools.mock.calls).toEqual([[WS, [{ from: "acme.lead.message.send", to: "nivo.tool.customer.message.send" }]]])
        expect(grants.rekeyTools.mock.invocationCallOrder[0]).toBeLessThan(flows.publish.mock.invocationCallOrder[0] ?? 0)
        expect(report.totals.tool_grants).toEqual({ found: 3, rewritten: 1, removed: 0, orphans: 0 })
    })

    it("refuses --execute while a record is open, writes nothing, and still prints the plan", async () => {
        const { service } = build(1)

        const report = await service.reseed({ workspaceId: WS, map: MAP, execute: true })

        expect(report.executed).toBe(false)
        expect(report.refusal).toBe("not_drained")
        expect(calledOf().filter((key) => key in WRITES)).toEqual([])
        expect(report.workspaces[0]?.plans.length).toBe(4)
        expect(report.workspaces[0]?.drain).toEqual({ runs: 1, steps: 1 })
        expect(reseedLinesOf(report).at(-1)).toMatch(/^tools reseed REFUSED not_drained: workspaces 1, failed 0;/u)
    })

    it("refuses a map with no tools table and reads nothing", async () => {
        const { service } = build()

        const report = await service.reseed({ map: { json: { nope: 1 }, path: "bad.json" }, execute: true })

        expect(report.refusal).toBe("bad_map")
        expect(calledOf()).toEqual([])
        expect(reseedLinesOf(report)).toEqual([
            "tools reseed REFUSED (bad_map): the map file must hold { tools: { <old id>: <new id> } }; nothing read",
        ])
    })

    it("keeps an agent's failure to itself, counts it and goes on", async () => {
        const { service, workflows } = build()
        workflows.seedAgent.mockRejectedValue(Object.assign(new Error("x"), { code: "WORKFLOW_REFUSED" }))

        const report = await service.reseed({ workspaceId: WS, map: MAP, execute: true })

        expect(report.failed).toBe(1)
        expect(report.workspaces[0]?.failed).toEqual([{ agentId: AGENT, code: "WORKFLOW_REFUSED" }])
        expect(reseedLinesOf(report)).toContain(`  FAILED agent=${AGENT} WORKFLOW_REFUSED`)
    })

    it("depends on exactly the stores it names: no call log, run, memory, work item or record store is reachable", () => {
        const names = (Reflect.getMetadata("design:paramtypes", ToolReseedService) as ReadonlyArray<{ readonly name: string }>).map(
            (type) => type.name,
        )
        expect(names).toEqual([
            "WorkspacesService",
            "InstallationRecordsService",
            "AgentWorkflowsService",
            "AgentWorkflowInstallService",
            "AgentGraphsService",
            "AgentGraphFlowService",
            "ToolGrantsService",
            "AgentRunDrainService",
            "Object",
        ])
    })
})
