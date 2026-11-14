import { Injectable, Optional } from "@nestjs/common"
import { graphSpecSchema, type GraphSpec } from "@nivo-lite/agent-sdk/graph"
import type { AgentRightsAgreed } from "./agent-workflow-rights.contracts"
import type { WorkflowTemplate } from "@nivo-lite/agent-sdk/template"
import { INSTALLED } from "@modules/domain/installed-plugins"
import { isNodeMode } from "@modules/domain/tools"
import { InstallationRecordsService } from "@modules/domain/module-installations"
import { WorkspaceMemberSeatsService } from "@modules/domain/workspace-members"
import { WorkspaceEnterpriseService } from "@modules/domain/workspaces"
import { InjectLogger, type Logger } from "@modules/platform/logging"
import { parseJsonText } from "@modules/platform/primitives"
import type { GraphActor } from "./agent-graph-admin.service"
import { AgentDirectoryService } from "@modules/domain/agents"
import { storedAvatarAddress } from "@modules/integrations/object-storage"
import { AgentGraphLayoutService } from "./agent-graph-layout.service"
import { AgentGraphsLogEvent } from "./agent-graphs.log-events"
import { AgentStepTitlesService } from "./agent-step-titles.service"
import { AgentWorkflowInstallService } from "./agent-workflow-install.service"
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
    AgentRightsAgreeRequest,
    AgreedRightsRequest,
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
    WorkflowNodeModeRequest,
    WorkflowTemplateVersionRequest,
    WorkflowsRequest,
} from "./agent-workflows-door.contracts"
import { AgentGraphsError, AgentGraphsErrorCode } from "./errors/agent-graphs.error"
import type { GraphLayoutPosition } from "./policies/graph-layout.policy"
import { agreedRightsOf, type AgreedRight } from "./policies/node-rights-gate.policy"
import { graphWithNodeMode } from "./policies/node-mode-override.policy"
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
    type TemplatePreviewWire,
    type TemplateWire,
    type WorkflowDetailWire,
    type WorkflowDiffWire,
    type WorkflowVersionWire,
    type WorkflowWire,
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

/** The entries the owner agreed, as the last argument of a version write: none when the request agreed nothing. */
const agreedOf = (request: AgreedRightsRequest): [] | [ReadonlyArray<AgreedRight>] => {
    const agreed = agreedRightsOf(request.agreedRights)
    return agreed.length === 0 ? [] : [agreed]
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
 * the owner's alone to publish, as with the agent graph; one whose nodes ask for more on connected accounts activates only with the
 * owner's agreed list (the rights gate of `AgentWorkflowsService`).
 */
export class AgentWorkflowsAdminService {
    constructor(
        private readonly seats: WorkspaceMemberSeatsService,
        private readonly installations: InstallationRecordsService,
        private readonly workflows: AgentWorkflowsService,
        private readonly runs: AgentWorkflowRunsService,
        private readonly layouts: AgentGraphLayoutService,
        private readonly agents: AgentDirectoryService,
        @Optional() private readonly enterprise?: WorkspaceEnterpriseService,
        @Optional() private readonly installer?: AgentWorkflowInstallService,
        @Optional() @InjectLogger() private readonly logger?: Logger,
        @Optional() private readonly titles?: AgentStepTitlesService,
    ) {}

    /** The title of a step as its installed node declares it; none in an app that installed no nodes. */
    private readonly stepTitleOf = (step: string) => this.titles?.titleOf(step) ?? null

    /** The workflows of the agent of an installation. */
    async list(actor: GraphActor, request: WorkflowsRequest): Promise<ReadonlyArray<WorkflowWire>> {
        await this.editorOf(actor)
        const seat = await this.seatOf(actor, request.installationId)
        await this.installed(actor.workspaceId, request.installationId, seat)
        const views = await this.workflows.list(actor.workspaceId, seat.agentId, workflowLocaleOf(request.locale))
        return views.map(workflowWireOf)
    }

    /** The agent Graph page: every workflow of the agent of an installation, the agent named and each cross-agent hand-off naming its target agent. */
    async graph(actor: GraphActor, request: WorkflowsRequest): Promise<AgentWorkflowGraphWire> {
        await this.editorOf(actor)
        const seat = await this.seatOf(actor, request.installationId)
        await this.installed(actor.workspaceId, request.installationId, seat)
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
        return workflowDetailWireOf(await this.owned(actor, request), this.stepTitleOf)
    }

    /** How one version differs from another, from the one before or from a template version. */
    async diff(actor: GraphActor, request: WorkflowDiffRequest): Promise<WorkflowDiffWire> {
        await this.editorOf(actor)
        await this.owned(actor, request)
        const against = diffAgainstOf(request.against, request.againstNumber ?? null)
        return workflowDiffWireOf(
            await this.workflows.versionDiff(actor.workspaceId, request.workflowId, request.number, against),
            this.stepTitleOf,
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
            this.stepTitleOf,
        )
    }

    /** Adds a workflow from a template version (the newest when none is named), or from scratch when no template is named. */
    async create(actor: GraphActor, request: WorkflowCreateRequest): Promise<WorkflowWire> {
        const author = await this.editorOf(actor)
        const seat = await this.seatOf(actor, request.installationId)
        const locale = workflowLocaleOf(request.locale)
        const templateId = request.templateId ?? null
        if (templateId !== null) {
            await this.openTemplate(actor.workspaceId, templateId)
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
        const { workspaceId } = actor
        return workflowVersionWireOf(
            await this.workflows.publish(
                workspaceId,
                request.workflowId,
                graph,
                author,
                expected,
                request.note,
                ...agreedOf(request),
            ),
        )
    }

    /**
     * Sets ONE node of the workflow's running graph to `auto` or `ask`, for the OWNER alone (nivo-frame `rights`: account attachments + one
     * mode per node are the hard rights; rule 5: a shop overrides a node's mode on its own graph copy, and a template update keeps it). It
     * writes a NEW version of the workflow (the running graph with that node's mode replaced) through the same road as every edit, so the
     * history shows it and a run pins it; the tool door reads the mode from the version a run is pinned to: `ask` raises the approval stop
     * with the whole content of the call (rule 11 h) on the next run, while runs in flight keep the version they started on. A node already
     * in that mode writes nothing and answers the running version. Refused, typed: a manager or staff (`FORBIDDEN`), a mode that is not
     * `auto` / `ask` (`mode`), a key no node has (`node`), an engine control step (`node-control`), a newer version than the one read.
     */
    async setNodeMode(actor: GraphActor, request: WorkflowNodeModeRequest): Promise<WorkflowVersionWire> {
        const author = await this.editorOf(actor)
        if (author.role !== "owner") throw new AgentGraphsError({ code: AgentGraphsErrorCode.Forbidden })
        if (!isNodeMode(request.mode)) throw workflowRefused("mode")
        const detail = await this.owned(actor, request)
        const graph = graphWithNodeMode(detail.graph, request.nodeKey, request.mode, (step) => INSTALLED.stepOf(step)?.control === true)
        if (graph === null) {
            const running = detail.versions.find((version) => version.active)
            if (running === undefined) throw workflowRefused("version")
            return workflowVersionWireOf(running)
        }
        return workflowVersionWireOf(
            await this.workflows.publish(
                actor.workspaceId,
                request.workflowId,
                graph,
                author,
                request.expectedLatest ?? null,
                `${request.nodeKey}: ${request.mode}`,
            ),
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
                ...agreedOf(request),
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
                ...agreedOf(request),
            ),
        )
    }

    /** Moves the workflow to `active`, `draft` or `paused`. */
    async setStatus(actor: GraphActor, request: WorkflowStatusRequest): Promise<boolean> {
        const editor = await this.editorOf(actor)
        await this.owned(actor, request)
        const status = workflowStatusOf(request.status)
        const { workspaceId } = actor
        // Turning a workflow on activates its running version: what it asks beyond its grant rows needs the owner's agreed list first.
        if (status === "active" && editor.memberId !== null) {
            const agreed = agreedRightsOf(request.agreedRights)
            const consent = { memberId: editor.memberId, role: editor.role, agreed }
            await this.workflows.requireRights(workspaceId, request.workflowId, consent)
        }
        await this.workflows.setStatus(workspaceId, request.workflowId, status)
        return true
    }

    /**
     * The road of the REMOVED rights agreement (nivo-frame `rights`: no rights-upgrade gate, nothing to agree): it agrees nothing and
     * answers so. What stays on it is no right: the OWNER picks the one source of each stream two attached accounts read (`triggerPicks`,
     * owner key `triggerOneSource2026_11_12`): every pick is checked first (`TRIGGER_PICK_REFUSED` refuses the call, nothing written), a
     * manager's pick is refused `FORBIDDEN`.
     */
    async agreeRights(actor: GraphActor, request: AgentRightsAgreeRequest): Promise<AgentRightsAgreed> {
        const editor = await this.editorOf(actor)
        const seat = await this.seatOf(actor, request.installationId)
        const picks = request.triggerPicks ?? []
        if (picks.length > 0 && (editor.role !== "owner" || editor.memberId === null))
            throw new AgentGraphsError({ code: AgentGraphsErrorCode.Forbidden })
        const checked = await this.runs.triggerPicksOf(actor.workspaceId, seat.agentId, picks)
        if (checked.length > 0 && editor.memberId !== null)
            await this.runs.recordTriggerPicks(actor.workspaceId, seat.agentId, editor.memberId, checked)
        return { nodeRightsDecide: true, agreed: 0 }
    }

    /** The workflow templates of the market, of one module or of all, for any member of the workspace. */
    async templates(actor: GraphActor, request: TemplatesRequest): Promise<ReadonlyArray<TemplateWire>> {
        await this.memberOf(actor)
        const locale = workflowLocaleOf(request.locale)
        const listed = request.moduleKey == null ? INSTALLED.templates() : INSTALLED.templatesOf(request.moduleKey)
        // A template of a private plugin is listed only to the enterprise workspaces the plugin names.
        const open = await Promise.all(listed.map((template) => this.opens(actor.workspaceId, template.moduleKey)))
        return listed.filter((_, at) => open[at] === true).map((template) => templateWireOf(template, locale))
    }

    /** One workflow template, for any member of the workspace. */
    async template(actor: GraphActor, request: TemplateRequest): Promise<TemplateWire> {
        await this.memberOf(actor)
        return templateWireOf(
            await this.openTemplate(actor.workspaceId, request.templateId),
            workflowLocaleOf(request.locale),
        )
    }

    /**
     * Whether the workspace may use what a module ships: always for a module of a public plugin (no read); for a module of a private
     * plugin only when the workspace's enterprise identifier is one the plugin names. An app without the workspaces capability
     * opens no private module.
     */
    private async opens(workspaceId: string, moduleKey: string): Promise<boolean> {
        if (INSTALLED.isOpenTo(moduleKey, null)) return true
        return (await this.enterprise?.opens(workspaceId, moduleKey)) ?? false
    }

    /** The template of this id as the workspace may use it; one of a module closed to the workspace is the not-found of an unknown id. */
    private async openTemplate(workspaceId: string, templateId: string): Promise<WorkflowTemplate> {
        const template = templateRequired(templateId)
        // An unknown id and a closed template answer the same refusal: nothing tells a private template from no template.
        if (!(await this.opens(workspaceId, template.moduleKey))) return templateRequired("")
        return template
    }

    /** The workflow and version each of these runs of the installation's agent executes, for any member of the workspace. */
    async runPins(actor: GraphActor, request: RunPinsRequest): Promise<ReadonlyArray<RunPinView>> {
        await this.memberOf(actor)
        await this.seatOf(actor, request.installationId)
        return this.runs.pinsOf(actor.workspaceId, request.runIds)
    }

    /**
     * Before the workflows of an agent are listed, the agent is given the ones its plugin ships where it holds none: how an agent
     * installed before the install doors made them (or through a door that makes none) is repaired the first time an owner or a
     * manager opens its workflows. It changes nothing for an agent that holds them; a failure is logged and the page is answered.
     */
    private async installed(workspaceId: string, installationId: string, seat: Seat): Promise<void> {
        const made = { workspaceId, agentId: seat.agentId, installationId, moduleKey: seat.moduleKey }
        try {
            await this.installer?.install(made)
        } catch (cause: unknown) {
            if (this.logger === undefined) throw cause
            this.logger.error(AgentGraphsLogEvent.WorkflowInstallFailed, cause, made)
        }
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
