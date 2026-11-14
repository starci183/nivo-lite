import { Injectable, Optional } from "@nestjs/common"
import { nodeIndexOf } from "@nivo-lite/agent-sdk/node"
import { latestTemplateVersion, type WorkflowTemplate } from "@nivo-lite/agent-sdk/template"
import { EntityEngineService } from "@modules/domain/entity-engine"
import { GraphNodeRegistryService } from "@modules/domain/graph-nodes"
import { INSTALLED } from "@modules/domain/installed-plugins"
import { AgentGraphFlowService } from "./agent-graph-flow.service"
import { AgentGraphsService } from "./agent-graphs.service"
import { AgentWorkflowRecordsService } from "./agent-workflow-records.service"
import type { WorkflowStatus } from "./agent-workflows.contracts"
import { AgentWorkflowsService } from "./agent-workflows.service"

/** The most workflows of one agent a plan reads. */
const WORKFLOW_LIMIT = 50

/** The agent whose templates become workflows. */
export interface WorkflowInstallInput {
    /** The workspace. */
    readonly workspaceId: string
    /** The agent. */
    readonly agentId: string
    /** The installation the agent runs as. */
    readonly installationId: string
    /** The module the agent runs: its plugin ships the templates. */
    readonly moduleKey: string
}

/**
 * What became of the module's PRIMARY template: `published` (its newest graph is now the flow the agent runs), `kept` (the agent
 * already runs a flow, which is never replaced), `waits` (the agent's graph still follows the rules it was seeded from, or holds an
 * edit nobody published: the flow comes when the setup is applied), `none` (the module ships no primary template).
 */
export type PrimaryFlowInstall = "published" | "kept" | "waits" | "none"

/** What one install did. */
export interface WorkflowInstallResult {
    /** What became of the primary template. */
    readonly flow: PrimaryFlowInstall
    /** How many workflows were made from the other templates of the module. */
    readonly made: number
}

/**
 * What an install does about one template of the module: `add` (a workflow is made from it), `present` (the agent holds a workflow
 * of it, left exactly as it is), `waits` (the primary template of an agent whose setup is not applied: nothing is made yet).
 */
export type PlannedAction = "add" | "present" | "waits"

/** One template of the agent's module, and what an install does about it. */
export interface PlannedWorkflow {
    /** The template. */
    readonly templateId: string
    /** Its newest version: the one a workflow is made from. */
    readonly version: number
    /** True for the module's primary template. */
    readonly primary: boolean
    /** What an install does. */
    readonly action: PlannedAction
    /** The status of the workflow the agent holds of it (`active`, `paused`, `draft`), or null when it holds none. */
    readonly status: WorkflowStatus | null
}

/** Where the agent's own graph stands for the primary template; `publish` = an install puts the template's graph on it. */
type PrimaryStanding = "publish" | "kept" | "waits" | "none"

@Injectable()
/**
 * Gives an agent a person installed through the app the workflows its plugin ships, through the two functions the stack seed gives
 * a seeded shop its own with: `AgentGraphFlowService.publish` puts the newest graph of the module's primary template on the agent's
 * graph as the flow it runs (the seed publishes its spec file the same way), and `AgentWorkflowsService.seedAgent` adopts that
 * flow as the primary workflow and copies every other template the agent holds no workflow of. It is safe to call at every door and
 * again: a flow the agent already runs is never replaced, a template the agent holds a workflow of is never copied twice, and an
 * edit of the workspace is never written over. `plan` says, writing nothing, what `install` would do.
 *
 * The primary flow is put on a graph a person has published (an applied setup, a template, a copy), never on a graph that still
 * follows the rules it was seeded from: a flow stops that following, and the setup chat is still writing those rules. The rights the
 * workflows ask for on the agent's connected accounts pass the rights gate of the roads `seedAgent` takes (a template, no person).
 */
export class AgentWorkflowInstallService {
    constructor(
        private readonly graphs: AgentGraphsService,
        private readonly flows: AgentGraphFlowService,
        private readonly workflows: AgentWorkflowsService,
        private readonly engine: EntityEngineService,
        private readonly records: AgentWorkflowRecordsService,
        @Optional() private readonly nodes?: GraphNodeRegistryService,
    ) {}

    /** Makes the templates of the agent's module its workflows, where it holds none of them yet. */
    async install(input: WorkflowInstallInput): Promise<WorkflowInstallResult> {
        const { workspaceId, agentId, installationId, moduleKey } = input
        const standing = await this.primaryStanding(input)
        const template = INSTALLED.templatesOf(moduleKey).find((entry) => entry.primary)
        if (standing === "publish" && template !== undefined) {
            const { graph } = latestTemplateVersion(template)
            // The nodes a flow is judged against: the app's registry, or what the installation declares where the app has none.
            const installed = this.nodes?.installed() ?? nodeIndexOf(INSTALLED.nodeInstall())
            await this.flows.publish({ workspaceId, agentId, installationId, flow: graph, installed })
        }
        const made = await this.workflows.seedAgent(workspaceId, agentId, moduleKey)
        return { flow: standing === "publish" ? "published" : standing, made }
    }

    /**
     * What `install` would do for the agent, template by template, writing nothing: the same reads `install` decides by (the agent's
     * graph for the primary template, the workflows it holds for every template).
     */
    async plan(input: WorkflowInstallInput): Promise<ReadonlyArray<PlannedWorkflow>> {
        const { workspaceId, agentId, moduleKey } = input
        const standing = await this.primaryStanding(input)
        const held = await this.engine.scoped(workspaceId, (tx) =>
            this.records.workflowsOf(tx, agentId, WORKFLOW_LIMIT),
        )
        return INSTALLED.templatesOf(moduleKey).map((template) => {
            const { version } = latestTemplateVersion(template)
            const { id: templateId, primary } = template
            const mine = held.find((workflow) =>
                primary ? workflow.primary : workflow.template?.templateId === templateId,
            )
            if (mine !== undefined) return { templateId, version, primary, action: "present", status: mine.status }
            // A flow the agent runs with no primary workflow yet is adopted as one; any other template is copied.
            const action = primary && (standing === "waits" || standing === "none") ? "waits" : "add"
            return { templateId, version, primary, action, status: null }
        })
    }

    /** Where the agent's own graph stands for the primary template of its module: read only. */
    private async primaryStanding(input: WorkflowInstallInput): Promise<PrimaryStanding> {
        const state = await this.graphs.stateOfAgent(input.workspaceId, input.agentId)
        if (state?.active?.flow !== undefined) return "kept"
        if (!INSTALLED.templatesOf(input.moduleKey).some((entry: WorkflowTemplate) => entry.primary)) return "none"
        const active = state?.active ?? null
        // Publishing a flow replaces the draft: a graph nobody published yet, or one with an unpublished edit, is left alone.
        const settled = active !== null && JSON.stringify(state?.draft) === JSON.stringify(active)
        return !settled || state?.activeKind === "seed" ? "waits" : "publish"
    }
}
