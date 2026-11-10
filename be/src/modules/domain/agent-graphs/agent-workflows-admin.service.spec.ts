import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import type { GraphSpec } from "@nivo-lite/agent-sdk/graph"
import { AgentDirectoryService } from "@modules/domain/agents"
import { InstallationRecordsService } from "@modules/domain/module-installations"
import type { InstallationRecord } from "@modules/domain/module-installations"
import { WorkspaceMemberSeatsService } from "@modules/domain/workspace-members"
import type { MemberSeatRecord } from "@modules/domain/workspace-members"
import { AgentGraphLayoutService } from "./agent-graph-layout.service"
import { AgentWorkflowRunsService } from "./agent-workflow-runs.service"
import { AgentWorkflowsAdminService } from "./agent-workflows-admin.service"
import { AgentWorkflowsService } from "./agent-workflows.service"
import type {
    AgentWorkflowGraph,
    TemplatePreview,
    WorkflowDetail,
    WorkflowDiff,
    WorkflowVersionView,
    WorkflowView,
} from "./agent-workflows.contracts"
import { AgentGraphsErrorCode } from "./errors/agent-graphs.error"

type Role = "owner" | "manager" | "staff"

const ACTOR = { workspaceId: "ws-1", principalId: "user-1" }

const GRAPH: GraphSpec = {
    schema: "nivo/agent-graph@1",
    moduleKey: "accounting",
    trigger: { kind: "tag", sources: ["schedule"] },
    grant: { rights: [], tools: [], effects: [] },
    nodes: [{ key: "end", kind: "output", step: "stop" }],
}

const WIDER: GraphSpec = { ...GRAPH, grant: { ...GRAPH.grant, tools: ["nivo.ledger.entry.append"] } }

const VIEW: WorkflowView = {
    id: "wf-1",
    agentId: "agent-1",
    key: "reports",
    name: "Reports",
    status: "draft",
    primary: false,
    activeNumber: 1,
    latestNumber: 1,
    template: null,
    templateName: null,
    templateLatest: null,
    templateChangedSteps: null,
    stepCount: 1,
    updatedAt: "2026-11-09T02:00:00.000Z",
}

const VERSION: WorkflowVersionView = {
    id: "wfv-2",
    number: 2,
    changeKind: "edit",
    authorKind: "owner",
    authorId: "member-1",
    note: "",
    template: null,
    fromNumber: null,
    publishedAt: "2026-11-09T02:00:00.000Z",
    stepCount: 1,
    changedSteps: 0,
    active: true,
}

const DETAIL: WorkflowDetail = { workflow: VIEW, graph: GRAPH, versions: [VERSION], templateDiff: null }

const NO_DIFF: WorkflowDiff = {
    steps: [],
    triggerChanged: false,
    grant: {
        rightsAdded: [],
        rightsRemoved: [],
        toolsAdded: [],
        toolsRemoved: [],
        effectsAdded: [],
        effectsRemoved: [],
    },
}

/** A template preview whose merge holds `merged` over the workflow's `current`. */
const previewOf = (current: GraphSpec, merged: GraphSpec): TemplatePreview => ({
    templateVersion: 2,
    changes: [],
    current,
    merged,
    diff: NO_DIFF,
    conflicts: [],
})

type AgentIdentityCard = Awaited<ReturnType<AgentDirectoryService["identitiesOf"]>>[number]

const build = async (role: Role | null = "owner") => {
    const seats = mock<WorkspaceMemberSeatsService>()
    seats.activeSeatOfUser.mockResolvedValue(
        role === null ? null : mock<MemberSeatRecord>({ memberId: "member-1", role }),
    )
    const installations = mock<InstallationRecordsService>()
    installations.find.mockResolvedValue(mock<InstallationRecord>({ agentId: "agent-1", moduleKey: "accounting" }))
    const workflows = mock<AgentWorkflowsService>()
    workflows.detail.mockResolvedValue(DETAIL)
    workflows.list.mockResolvedValue([VIEW])
    workflows.publish.mockResolvedValue(VERSION)
    workflows.createFromTemplate.mockResolvedValue(VIEW)
    workflows.createBlank.mockResolvedValue(VIEW)
    const runs = mock<AgentWorkflowRunsService>()
    const layouts = mock<AgentGraphLayoutService>()
    layouts.read.mockResolvedValue([{ workflowKey: "reports", x: 10, y: 20 }])
    layouts.save.mockResolvedValue([{ workflowKey: "reports", x: 10, y: 20 }])
    const agents = mock<AgentDirectoryService>()
    agents.identitiesOf.mockResolvedValue([])
    const moduleRef = await Test.createTestingModule({
        providers: [
            AgentWorkflowsAdminService,
            { provide: WorkspaceMemberSeatsService, useValue: seats },
            { provide: InstallationRecordsService, useValue: installations },
            { provide: AgentWorkflowsService, useValue: workflows },
            { provide: AgentWorkflowRunsService, useValue: runs },
            { provide: AgentGraphLayoutService, useValue: layouts },
            { provide: AgentDirectoryService, useValue: agents },
        ],
    }).compile()
    return { admin: moduleRef.get(AgentWorkflowsAdminService), workflows, installations, runs, layouts, agents }
}

describe("AgentWorkflowsAdminService: seats", () => {
    it("lists the workflows of the installation's agent for a manager, as wires", async () => {
        const { admin, workflows } = await build("manager")

        const listed = await admin.list(ACTOR, { installationId: "inst-1", locale: "en" })

        expect(workflows.list).toHaveBeenCalledWith("ws-1", "agent-1", "en")
        expect(listed).toEqual([expect.objectContaining({ id: "wf-1", templateId: null, templateVersion: null })])
    })

    it("refuses staff and an account with no seat", async () => {
        const staff = await build("staff")
        const none = await build(null)

        await expect(staff.admin.list(ACTOR, { installationId: "inst-1" })).rejects.toMatchObject({
            code: AgentGraphsErrorCode.Forbidden,
        })
        await expect(none.admin.templates(ACTOR, {})).rejects.toMatchObject({ code: AgentGraphsErrorCode.Forbidden })
    })

    it("refuses a workflow of another agent, and an installation with no agent", async () => {
        const { admin, workflows, installations } = await build()
        workflows.detail.mockResolvedValue({ ...DETAIL, workflow: { ...VIEW, agentId: "agent-9" } })

        await expect(admin.detail(ACTOR, { installationId: "inst-1", workflowId: "wf-1" })).rejects.toMatchObject({
            code: AgentGraphsErrorCode.WorkflowNotFound,
        })
        installations.find.mockResolvedValue(null)
        await expect(admin.list(ACTOR, { installationId: "inst-x" })).rejects.toMatchObject({
            code: AgentGraphsErrorCode.GraphNotFound,
        })
    })

    it("lets staff read the templates and the run pins", async () => {
        const { admin, runs } = await build("staff")
        runs.pinsOf.mockResolvedValue([])

        // Accounting ships three templates: reconcile (which took the payment claim in), the reports and the team chat turn (C1).
        await expect(admin.templates(ACTOR, { moduleKey: "accounting" })).resolves.toHaveLength(3)
        await expect(admin.template(ACTOR, { templateId: "sales.consult" })).resolves.toMatchObject({ primary: true })
        await expect(admin.runPins(ACTOR, { installationId: "inst-1", runIds: ["run-1"] })).resolves.toEqual([])
    })
})

describe("AgentWorkflowsAdminService: graph", () => {
    const CALL = {
        nodeKey: "hand",
        outcome: "done",
        agent: "sales",
        agentLabel: "Sales",
        workflow: "quote",
        workflowName: "Quote",
        version: "latest",
        crossAgent: true,
    }
    const OWN = { ...CALL, nodeKey: "own", agent: "accounting", agentLabel: "Accounting", crossAgent: false }
    const ENTRY = {
        id: "wf-1",
        key: "reports",
        name: "Reports",
        status: "active" as const,
        primary: true,
        activeNumber: 1,
        entry: "any" as const,
        entryLabel: "Anyone",
        inputs: [],
        triggers: [],
        outcomes: [],
        calls: [CALL, OWN],
    }
    const GRAPH_PAGE: AgentWorkflowGraph = { agentId: "agent-1", workflows: [ENTRY] }

    it("names the installed agent and the agent of each cross-agent target, for a manager", async () => {
        const { admin, workflows, installations, agents } = await build("manager")
        installations.find.mockResolvedValue(
            mock<InstallationRecord>({ agentId: "agent-1", moduleKey: "accounting", name: "Accounting Ann" }),
        )
        installations.firstOfModule.mockResolvedValue(
            mock<InstallationRecord>({ name: "Sales Ben", agentId: "agent-2" }),
        )
        agents.identitiesOf.mockResolvedValue([
            mock<AgentIdentityCard>({ id: "agent-1", avatarUrl: null }),
            mock<AgentIdentityCard>({ id: "agent-2", avatarUrl: "https://cdn.example.org/ben.png" }),
        ])
        workflows.graphOf.mockResolvedValue(GRAPH_PAGE)

        const page = await admin.graph(ACTOR, { installationId: "inst-1", locale: "en" })

        expect(workflows.graphOf).toHaveBeenCalledWith("ws-1", "agent-1", "en")
        expect(installations.firstOfModule).toHaveBeenCalledTimes(1)
        expect(installations.firstOfModule).toHaveBeenCalledWith("ws-1", "sales")
        expect(page.agentLabel).toBe("Accounting Ann")
        expect(page.agentAvatar).toBeNull()
        expect(page.workflows[0]?.calls).toEqual([
            { ...CALL, agentLabel: "Sales Ben", agentAvatar: "https://cdn.example.org/ben.png" },
            { ...OWN, agentAvatar: null },
        ])
    })

    it("keeps the domain's label when the target module is not installed, refuses staff and an unknown installation", async () => {
        const { admin, workflows, installations } = await build("owner")
        installations.firstOfModule.mockResolvedValue(null)
        workflows.graphOf.mockResolvedValue(GRAPH_PAGE)

        const page = await admin.graph(ACTOR, { installationId: "inst-1" })

        expect(page.workflows[0]?.calls[0]?.agentLabel).toBe("Sales")
        const staff = await build("staff")
        await expect(staff.admin.graph(ACTOR, { installationId: "inst-1" })).rejects.toMatchObject({
            code: AgentGraphsErrorCode.Forbidden,
        })
        installations.find.mockResolvedValue(null)
        await expect(admin.graph(ACTOR, { installationId: "inst-x" })).rejects.toMatchObject({
            code: AgentGraphsErrorCode.GraphNotFound,
        })
    })
})

describe("AgentWorkflowsAdminService: layout", () => {
    const positions = [{ workflowKey: "reports", x: 10, y: 20 }]

    it("reads and saves the layout of the installation's agent for a manager", async () => {
        const { admin, layouts } = await build("manager")

        await expect(admin.layout(ACTOR, { installationId: "inst-1" })).resolves.toEqual({ positions })
        await expect(admin.saveLayout(ACTOR, { installationId: "inst-1", positions })).resolves.toEqual({ positions })
        expect(layouts.read).toHaveBeenCalledWith("ws-1", "inst-1", "agent-1")
        expect(layouts.save).toHaveBeenCalledWith("ws-1", "inst-1", "agent-1", positions)
    })

    it("refuses staff on both roads", async () => {
        const { admin, layouts } = await build("staff")

        await expect(admin.layout(ACTOR, { installationId: "inst-1" })).rejects.toMatchObject({
            code: AgentGraphsErrorCode.Forbidden,
        })
        await expect(admin.saveLayout(ACTOR, { installationId: "inst-1", positions })).rejects.toMatchObject({
            code: AgentGraphsErrorCode.Forbidden,
        })
        expect(layouts.save).not.toHaveBeenCalled()
    })
})

describe("AgentWorkflowsAdminService: changes", () => {
    const publishing = { installationId: "inst-1", workflowId: "wf-1", note: "", expectedLatest: 1 }

    it("publishes the editor's graph as the owner, and refuses a manager's change that widens the agent", async () => {
        const owner = await build("owner")
        const manager = await build("manager")

        await expect(
            owner.admin.publish(ACTOR, { ...publishing, graphJson: JSON.stringify(WIDER) }),
        ).resolves.toMatchObject({
            id: "wfv-2",
        })
        expect(owner.workflows.publish).toHaveBeenCalledWith(
            "ws-1",
            "wf-1",
            WIDER,
            { kind: "owner", memberId: "member-1", role: "owner" },
            1,
            "",
        )
        await expect(
            manager.admin.publish(ACTOR, { ...publishing, graphJson: JSON.stringify(WIDER) }),
        ).rejects.toMatchObject({ code: AgentGraphsErrorCode.WidensNeedsOwner })
    })

    it("keeps a widening the owner's alone on every road: a rollback and a template sync too, while a manager may narrow", async () => {
        const manager = await build("manager")
        const changing = { installationId: "inst-1", workflowId: "wf-1", note: "", expectedLatest: 1 }
        manager.workflows.versionDiff.mockResolvedValue({ before: null, after: WIDER, diff: NO_DIFF })
        manager.workflows.templatePreview.mockResolvedValue(previewOf(GRAPH, WIDER))

        await expect(manager.admin.rollback(ACTOR, { ...changing, number: 1 })).rejects.toMatchObject({
            code: AgentGraphsErrorCode.WidensNeedsOwner,
        })
        await expect(manager.admin.acceptTemplate(ACTOR, { ...changing, templateVersion: 2 })).rejects.toMatchObject({
            code: AgentGraphsErrorCode.WidensNeedsOwner,
        })
        expect(manager.workflows.rollback).not.toHaveBeenCalled()
        expect(manager.workflows.acceptTemplate).not.toHaveBeenCalled()

        manager.workflows.detail.mockResolvedValue({ ...DETAIL, graph: WIDER })
        await expect(
            manager.admin.publish(ACTOR, { ...publishing, graphJson: JSON.stringify(GRAPH) }),
        ).resolves.toMatchObject({ id: "wfv-2" })
    })

    it("refuses a manager's version that makes a right reach the whole workspace instead of the turn", async () => {
        const manager = await build("manager")
        const turn: GraphSpec = {
            ...GRAPH,
            grant: { ...GRAPH.grant, rights: [{ kind: "order", access: "read", scope: "turn", fields: ["id"] }] },
        }
        const workspace: GraphSpec = {
            ...GRAPH,
            grant: { ...GRAPH.grant, rights: [{ kind: "order", access: "read", scope: "workspace", fields: ["id"] }] },
        }
        manager.workflows.detail.mockResolvedValue({ ...DETAIL, graph: turn })

        await expect(
            manager.admin.publish(ACTOR, { ...publishing, graphJson: JSON.stringify(workspace) }),
        ).rejects.toMatchObject({ code: AgentGraphsErrorCode.WidensNeedsOwner })
    })

    it("refuses a graph text that is not a graph", async () => {
        const { admin } = await build()

        await expect(admin.publish(ACTOR, { ...publishing, graphJson: "{not json" })).rejects.toMatchObject({
            code: AgentGraphsErrorCode.DocumentInvalid,
        })
        await expect(admin.publish(ACTOR, { ...publishing, graphJson: "{}" })).rejects.toMatchObject({
            code: AgentGraphsErrorCode.DocumentInvalid,
        })
    })
})

describe("AgentWorkflowsAdminService: adding and mapping", () => {
    it("adds a workflow from a template, or from scratch with a name", async () => {
        const { admin, workflows } = await build()

        await admin.create(ACTOR, { installationId: "inst-1", templateId: "accounting.reports" })
        await admin.create(ACTOR, { installationId: "inst-1", name: " Chi " })

        expect(workflows.createFromTemplate).toHaveBeenCalledWith(
            "ws-1",
            "agent-1",
            { templateId: "accounting.reports", version: null },
            expect.objectContaining({ memberId: "member-1" }),
            "vi",
        )
        expect(workflows.createBlank).toHaveBeenCalledWith(
            "ws-1",
            "agent-1",
            { name: "Chi", moduleKey: "accounting" },
            expect.anything(),
            "vi",
        )
        await expect(admin.create(ACTOR, { installationId: "inst-1", name: "  " })).rejects.toMatchObject({
            code: AgentGraphsErrorCode.WorkflowRefused,
        })
    })

    it("maps a status and a diff request onto the service", async () => {
        const { admin, workflows } = await build()
        workflows.versionDiff.mockResolvedValue({
            before: null,
            after: GRAPH,
            diff: {
                steps: [],
                triggerChanged: false,
                grant: {
                    rightsAdded: [],
                    rightsRemoved: [],
                    toolsAdded: [],
                    toolsRemoved: [],
                    effectsAdded: [],
                    effectsRemoved: [],
                },
            },
        })

        await expect(
            admin.setStatus(ACTOR, { installationId: "inst-1", workflowId: "wf-1", status: "active" }),
        ).resolves.toBe(true)
        const diff = await admin.diff(ACTOR, {
            installationId: "inst-1",
            workflowId: "wf-1",
            number: 1,
            against: "previous",
        })

        expect(workflows.setStatus).toHaveBeenCalledWith("ws-1", "wf-1", "active")
        expect(workflows.versionDiff).toHaveBeenCalledWith("ws-1", "wf-1", 1, { kind: "previous" })
        expect(diff).toMatchObject({ beforeJson: null, afterJson: JSON.stringify(GRAPH) })
    })
})
