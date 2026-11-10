import { Injectable } from "@nestjs/common"
import { graphSpecSchema } from "@nivo-lite/agent-sdk/graph"
import type { GraphSpec } from "@nivo-lite/agent-sdk/graph"
import { WORKFLOW_TEMPLATES, workflowTemplatesOf } from "@nivo-lite/blocks-core/modules"
import { InstallationRecordsService } from "@modules/domain/module-installations"
import { WorkspaceMemberSeatsService } from "@modules/domain/workspace-members"
import { parseJsonText } from "@modules/platform/primitives"
import type { GraphActor } from "./agent-graph-admin.service"
import { AgentDirectoryService } from "@modules/domain/agents"
import { storedAvatarAddress } from "@modules/integrations/object-storage"
import { AgentGraphLayoutService } from "./agent-graph-layout.service"
import { AgentWorkflowRunsService } from "./agent-workflow-runs.service"
import { AgentWorkflowsService } from "./agent-workflows.service"
import type {
    AgentWorkflowGraph,
    RunPinView,
    WorkflowDetail,
    WorkflowEditor,
    WorkflowGraphCall,
    WorkflowGraphEntry,
} from "./agent-workflows.contracts"
import type {
    RunPinsRequest,
    TemplateRequest,
    TemplatesRequest,
    WorkflowAcceptRequest,
    LayoutSaveRequest,
    WorkflowCreateRequest,
    WorkflowDiffRequest,
    WorkflowPublishRequest,
    WorkflowRequest,
    WorkflowRollbackRequest,
    WorkflowStatusRequest,
    WorkflowTemplateVersionRequest,
    WorkflowsRequest,
} from "./agent-workflows-door.contracts"
import { AgentGraphsError, AgentGraphsErrorCode } from "./errors/agent-graphs.error"
import type { GraphLayoutPosition } from "./policies/graph-layout.policy"
import { requireNoWidening } from "./policies/workflow-widening.policy"
import {
    diffAgainstOf,
    templateRequired,
    workflowLocaleOf,
    workflowRefused,
    workflowStatusOf,
} from "./policies/workflow-view.policy"
import {
    templatePreviewWireOf,
    templateWireOf,
    workflowDetailWireOf,
    workflowDiffWireOf,
    workflowVersionWireOf,
    workflowWireOf,
} from "./policies/workflow-wire.policy"
import type {
    TemplatePreviewWire,
    TemplateWire,
    WorkflowDetailWire,
    WorkflowDiffWire,
    WorkflowVersionWire,
    WorkflowWire,
} from "./policies/workflow-wire.policy"

/** The agent of an installation and the module it runs. */
interface Seat {
    readonly agentId: string
    readonly moduleKey: string
    readonly name: string
}

/** One end hand-off with the picture of the agent it calls. */
export interface WorkflowGraphCallWire extends WorkflowGraphCall {
    /** The picture of the agent that runs the target, or null (the page then shows the module icon). */
    readonly agentAvatar: string | null
}

/** One workflow of the Graph page with its hand-offs pictured. */
export interface WorkflowGraphEntryWire extends Omit<WorkflowGraphEntry, "calls"> {
    /** Its end hand-offs, each with the picture of the agent it calls. */
    readonly calls: ReadonlyArray<WorkflowGraphCallWire>
}

/** The agent Graph page with the display name and the picture of the installed agent. */
export interface AgentWorkflowGraphWire extends Omit<AgentWorkflowGraph, "workflows"> {
    /** The installed agent display name. */
    readonly agentLabel: string
    /** The installed agent picture, or null. */
    readonly agentAvatar: string | null
    /** Every workflow of the agent. */
    readonly workflows: ReadonlyArray<WorkflowGraphEntryWire>
}

/** The saved layout of the Graph page. */
export interface GraphLayoutWire {
    /** Where each workflow sits; a workflow without a position is placed by the page. */
    readonly positions: ReadonlyArray<GraphLayoutPosition>
}

/** The text of a graph the editor sent, read as a graph; one that is not JSON or not a graph is refused. */
const graphOfText = (text: string): GraphSpec => {
    const read = parseJsonText(text)
    const parsed = read.ok ? graphSpecSchema.safeParse(read.value) : null
    if (parsed?.success !== true) throw new AgentGraphsError({ code: AgentGraphsErrorCode.DocumentInvalid })
    return parsed.data
}

@Injectable()
/**
 * The door of the workflows tab and the template pages: every call checks the seat (owner or manager to read or change workflows, any
 * member for the templates and the run pins) and that the workflow belongs to the agent of the installation named, then answers the
 * wire the transport sends. A version that gives the agent more reach (rights, tools or effects its running version does not hold) is
 * the owner's alone to publish, as with the agent graph.
 */
export class AgentWorkflowsAdminService {
    constructor(
        private readonly seats: WorkspaceMemberSeatsService,
        private readonly installations: InstallationRecordsService,
        private readonly workflows: AgentWorkflowsService,
        private readonly runs: AgentWorkflowRunsService,
        private readonly layouts: AgentGraphLayoutService,
        private readonly agents: AgentDirectoryService,
    ) {}

    /** The workflows of the agent of an installation. */
    async list(actor: GraphActor, request: WorkflowsRequest): Promise<ReadonlyArray<WorkflowWire>> {
        await this.editorOf(actor)
        const seat = await this.seatOf(actor, request.installationId)
        const views = await this.workflows.list(actor.workspaceId, seat.agentId, workflowLocaleOf(request.locale))
        return views.map(workflowWireOf)
    }

    /** The agent Graph page: every workflow of the agent of an installation, the agent named and each cross-agent hand-off naming its target agent. */
    async graph(actor: GraphActor, request: WorkflowsRequest): Promise<AgentWorkflowGraphWire> {
        await this.editorOf(actor)
        const seat = await this.seatOf(actor, request.installationId)
        const graph = await this.workflows.graphOf(actor.workspaceId, seat.agentId, workflowLocaleOf(request.locale))
        const targets = new Set(
            graph.workflows.flatMap((workflow) =>
                workflow.calls.filter((call) => call.crossAgent).map((call) => call.agent),
            ),
        )
        const found = await Promise.all(
            [...targets].map(async (moduleKey) => ({
                moduleKey,
                target: await this.installations.firstOfModule(actor.workspaceId, moduleKey),
            })),
        )
        const agentIds = [seat.agentId, ...found.flatMap(({ target }) => (target?.agentId ? [target.agentId] : []))]
        const avatars = new Map(
            (await this.agents.identitiesOf(actor.workspaceId, agentIds)).map((card) => [
                card.id,
                storedAvatarAddress(card.avatarUrl),
            ]),
        )
        const targetOf = new Map(found.map(({ moduleKey, target }) => [moduleKey, target]))
        const labelled = (call: WorkflowGraphCall): WorkflowGraphCallWire => {
            const target = call.crossAgent ? (targetOf.get(call.agent) ?? null) : null
            const name = target?.name.trim() ?? ""
            return {
                ...call,
                agentLabel: name === "" ? call.agentLabel : (target?.name ?? call.agentLabel),
                agentAvatar: target?.agentId ? (avatars.get(target.agentId) ?? null) : null,
            }
        }
        return {
            ...graph,
            agentLabel: seat.name,
            agentAvatar: avatars.get(seat.agentId) ?? null,
            workflows: graph.workflows.map((workflow) => ({ ...workflow, calls: workflow.calls.map(labelled) })),
        }
    }

    /** Where the owner placed each workflow on the Graph page of the agent of an installation. */
    async layout(actor: GraphActor, request: WorkflowsRequest): Promise<GraphLayoutWire> {
        await this.editorOf(actor)
        const seat = await this.seatOf(actor, request.installationId)
        return { positions: await this.layouts.read(actor.workspaceId, request.installationId, seat.agentId) }
    }

    /** Replaces the layout of the Graph page of the agent of an installation. */
    async saveLayout(actor: GraphActor, request: LayoutSaveRequest): Promise<GraphLayoutWire> {
        await this.editorOf(actor)
        const seat = await this.seatOf(actor, request.installationId)
        const positions = await this.layouts.save(
            actor.workspaceId,
            request.installationId,
            seat.agentId,
            request.positions,
        )
        return { positions }
    }

    /** One workflow with its graph, its history and how it differs from its template. */
    async detail(actor: GraphActor, request: WorkflowRequest): Promise<WorkflowDetailWire> {
        await this.editorOf(actor)
        return workflowDetailWireOf(await this.owned(actor, request))
    }

    /** How one version differs from another, from the one before or from a template version. */
    async diff(actor: GraphActor, request: WorkflowDiffRequest): Promise<WorkflowDiffWire> {
        await this.editorOf(actor)
        await this.owned(actor, request)
        const against = diffAgainstOf(request.against, request.againstNumber ?? null)
        return workflowDiffWireOf(
            await this.workflows.versionDiff(actor.workspaceId, request.workflowId, request.number, against),
        )
    }

    /** What accepting a newer template version would write; nothing is written. */
    async templatePreview(actor: GraphActor, request: WorkflowTemplateVersionRequest): Promise<TemplatePreviewWire> {
        await this.editorOf(actor)
        await this.owned(actor, request)
        const locale = workflowLocaleOf(request.locale)
        return templatePreviewWireOf(
            await this.workflows.templatePreview(
                actor.workspaceId,
                request.workflowId,
                request.templateVersion,
                locale,
            ),
        )
    }

    /** Adds a workflow from a template version (the newest when none is named), or from scratch when no template is named. */
    async create(actor: GraphActor, request: WorkflowCreateRequest): Promise<WorkflowWire> {
        const author = await this.editorOf(actor)
        const seat = await this.seatOf(actor, request.installationId)
        const locale = workflowLocaleOf(request.locale)
        const templateId = request.templateId ?? null
        if (templateId !== null) {
            const pick = { templateId, version: request.templateVersion ?? null }
            return workflowWireOf(
                await this.workflows.createFromTemplate(actor.workspaceId, seat.agentId, pick, author, locale),
            )
        }
        const name = request.name?.trim() ?? ""
        if (name === "") throw workflowRefused("name")
        const blank = { name, moduleKey: seat.moduleKey }
        return workflowWireOf(await this.workflows.createBlank(actor.workspaceId, seat.agentId, blank, author, locale))
    }

    /** Publishes the graph the editor sent as the next version of the workflow. */
    async publish(actor: GraphActor, request: WorkflowPublishRequest): Promise<WorkflowVersionWire> {
        const author = await this.editorOf(actor)
        const detail = await this.owned(actor, request)
        const graph = graphOfText(request.graphJson)
        requireNoWidening(detail.graph, graph, author.role)
        const expected = request.expectedLatest ?? null
        return workflowVersionWireOf(
            await this.workflows.publish(actor.workspaceId, request.workflowId, graph, author, expected, request.note),
        )
    }

    /** Rolls the workflow back to an older version, as a new version. */
    async rollback(actor: GraphActor, request: WorkflowRollbackRequest): Promise<WorkflowVersionWire> {
        const author = await this.editorOf(actor)
        const detail = await this.owned(actor, request)
        const target = await this.workflows.versionDiff(actor.workspaceId, request.workflowId, request.number, {
            kind: "previous",
        })
        requireNoWidening(detail.graph, target.after, author.role)
        const expected = request.expectedLatest ?? null
        return workflowVersionWireOf(
            await this.workflows.rollback(
                actor.workspaceId,
                request.workflowId,
                request.number,
                author,
                expected,
                request.note,
            ),
        )
    }

    /** Accepts a newer version of the workflow's template, as a new version, after the owner reviewed the preview. */
    async acceptTemplate(actor: GraphActor, request: WorkflowAcceptRequest): Promise<WorkflowVersionWire> {
        const author = await this.editorOf(actor)
        await this.owned(actor, request)
        const { workspaceId } = actor
        const preview = await this.workflows.templatePreview(
            workspaceId,
            request.workflowId,
            request.templateVersion,
            "vi",
        )
        requireNoWidening(preview.current, preview.merged, author.role)
        const expected = request.expectedLatest ?? null
        return workflowVersionWireOf(
            await this.workflows.acceptTemplate(
                workspaceId,
                request.workflowId,
                request.templateVersion,
                author,
                expected,
                request.note,
            ),
        )
    }

    /** Moves the workflow to `active`, `draft` or `paused`. */
    async setStatus(actor: GraphActor, request: WorkflowStatusRequest): Promise<boolean> {
        await this.editorOf(actor)
        await this.owned(actor, request)
        await this.workflows.setStatus(actor.workspaceId, request.workflowId, workflowStatusOf(request.status))
        return true
    }

    /** The workflow templates of the market, of one module or of all, for any member of the workspace. */
    async templates(actor: GraphActor, request: TemplatesRequest): Promise<ReadonlyArray<TemplateWire>> {
        await this.memberOf(actor)
        const locale = workflowLocaleOf(request.locale)
        const listed = request.moduleKey == null ? WORKFLOW_TEMPLATES : workflowTemplatesOf(request.moduleKey)
        return listed.map((template) => templateWireOf(template, locale))
    }

    /** One workflow template, for any member of the workspace. */
    async template(actor: GraphActor, request: TemplateRequest): Promise<TemplateWire> {
        await this.memberOf(actor)
        return templateWireOf(templateRequired(request.templateId), workflowLocaleOf(request.locale))
    }

    /** The workflow and version each of these runs of the installation's agent executes, for any member of the workspace. */
    async runPins(actor: GraphActor, request: RunPinsRequest): Promise<ReadonlyArray<RunPinView>> {
        await this.memberOf(actor)
        await this.seatOf(actor, request.installationId)
        return this.runs.pinsOf(actor.workspaceId, request.runIds)
    }

    private async owned(actor: GraphActor, request: WorkflowRequest): Promise<WorkflowDetail> {
        const seat = await this.seatOf(actor, request.installationId)
        const detail = await this.workflows.detail(
            actor.workspaceId,
            request.workflowId,
            workflowLocaleOf(request.locale),
        )
        if (detail.workflow.agentId !== seat.agentId) {
            throw new AgentGraphsError({ code: AgentGraphsErrorCode.WorkflowNotFound })
        }
        return detail
    }

    private async seatOf(actor: GraphActor, installationId: string): Promise<Seat> {
        const installation = await this.installations.find(actor.workspaceId, installationId)
        if (!installation?.agentId) throw new AgentGraphsError({ code: AgentGraphsErrorCode.GraphNotFound })
        return { agentId: installation.agentId, moduleKey: installation.moduleKey, name: installation.name }
    }

    private async memberOf(actor: GraphActor): Promise<void> {
        const seat = await this.seats.activeSeatOfUser(actor.workspaceId, actor.principalId)
        if (seat === null) throw new AgentGraphsError({ code: AgentGraphsErrorCode.Forbidden })
    }

    private async editorOf(actor: GraphActor): Promise<WorkflowEditor> {
        const seat = await this.seats.activeSeatOfUser(actor.workspaceId, actor.principalId)
        if (seat === null || (seat.role !== "owner" && seat.role !== "manager"))
            throw new AgentGraphsError({ code: AgentGraphsErrorCode.Forbidden })
        return { kind: "owner", memberId: seat.memberId, role: seat.role }
    }
}
