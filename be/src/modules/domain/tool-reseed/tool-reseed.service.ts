import { Injectable } from "@nestjs/common"
import type { GraphSpec } from "@nivo-lite/agent-sdk/graph"
import { nodeIndexOf } from "@nivo-lite/agent-sdk/node"
import { latestTemplateVersion } from "@nivo-lite/agent-sdk/template"
import {
    AgentGraphFlowService,
    AgentGraphsService,
    AgentWorkflowInstallService,
    AgentWorkflowsService,
    type ActiveWorkflowGraph,
} from "@modules/domain/agent-graphs"
import { AgentRunDrainService } from "@modules/domain/agent-runs"
import { INSTALLED } from "@modules/domain/installed-plugins"
import { ToolGrantsService } from "@modules/domain/tool-grants"
import { InstallationRecordsService, type InstallationRecord } from "@modules/domain/module-installations"
import { WorkspacesService } from "@modules/domain/workspaces"
import { InjectLogger, type Logger } from "@modules/platform/logging"
import { eachInOrder } from "@modules/platform/primitives"
import type {
    ReseedFailure,
    ReseedOutput,
    ReseedReport,
    ReseedRequest,
    WorkspaceReseed,
} from "./tool-reseed.contracts"
import { reseedLinesOf } from "./tool-reseed.lines"
import { ToolReseedLogEvent } from "./tool-reseed.log-events"
import {
    ENGINE_DRAIN,
    NO_COUNT,
    addedCounts,
    oldIdsOf,
    perStore,
    reseedGraphsOf,
    toolRenameMapOf,
    workflowCountsOf,
    workflowReseedOf,
    type CurrentTemplate,
    type HeldWorkflow,
    type PlannedReseed,
    type ReseedStore,
    type StoreCount,
    type ToolRenameMap,
} from "./tool-reseed.policy"

/** How many workspaces one page of the walk reads. */
const WORKSPACE_PAGE = 200

/** The author of every version the re-seed writes: the system, no person. */
const SYSTEM = { kind: "system", memberId: null } as const

/** The note of a version the re-seed writes. */
const NOTE = "re-seed levels2026_11_12: the template's current version"


/** One agent's part of a workspace: its plan, its tick top-up, the workflows the install road adds, and (executed) whether it failed. */
interface AgentPart {
    readonly installation: InstallationRecord
    readonly agentId: string
    readonly templates: ReadonlyArray<CurrentTemplate>
    readonly plans: ReadonlyArray<PlannedReseed>
    readonly added: number
    readonly failed: ReseedFailure | null
}

const codeOf = (cause: unknown): string =>
    cause instanceof Error && "code" in cause ? String(cause.code) : "failed"

@Injectable()
/**
 * `cli tools reseed`: the ONE verb the restart owner runs after the three-level rename (`levels2026_11_12`) to put every agent of a
 * workspace on the templates the installation ships at their one current version, and its tool grants on the new tool ids. It
 * composes the roads that exist and adds no write of its own:
 * 1. the drain: the core rows of block 0 of `20261112014200` (runs, steps) counted per workspace; an
 *    `--execute` with any open is refused before anything is written; the table conditions are printed for the restart owner;
 * 2. the re-key of the tool grants (the allow-list of a road outside every node) through the rename map (`ToolGrantsService.rekeyTools`);
 * 3. per agent: the primary template's current graph published as the agent's flow (`AgentGraphFlowService.publish`, kind `spec`), the
 *    install road (`AgentWorkflowsService.seedAgent`: the primary workflow adopts the flow, a template the agent holds no workflow of
 *    becomes one), a NEW version holding the current graph for every other workflow of an installed template that runs another graph
 *    with its provenance (`AgentWorkflowsService.adoptTemplateVersion`, author system), and a pause for a workflow whose template is gone (`setStatus`);
 *    the plans of ALL agents of the workspace are read first: the re-seed of a workspace is one change, so every hand-off a written
 *    version holds (and every caller of it) is judged against the graphs the whole plan writes (`reseedGraphsOf`), never against a
 *    callee the same re-seed has not reached yet;
 * Ability ticks, node rows, endpoint rights and shadow tallies are REMOVED concepts (nivo-frame `rights`): nothing here writes them.
 * Old versions are NOT deleted: workflow and graph versions are append-only rows of their core tables, and run
 * pins (history) point at them; the new version is the one that runs. Dry unless asked to execute; a second run finds nothing to do.
 */
export class ToolReseedService {
    constructor(
        private readonly workspaces: WorkspacesService,
        private readonly installations: InstallationRecordsService,
        private readonly workflows: AgentWorkflowsService,
        private readonly installer: AgentWorkflowInstallService,
        private readonly graphs: AgentGraphsService,
        private readonly flows: AgentGraphFlowService,
        private readonly grants: ToolGrantsService,
        private readonly drain: AgentRunDrainService,
        @InjectLogger() private readonly logger: Logger,
    ) {}

    /** Runs the re-seed and prints its report, one line each. */
    async reseedFor(out: ReseedOutput, request: ReseedRequest): Promise<ReseedReport> {
        const report = await this.reseed(request)
        for (const line of reseedLinesOf(report)) out.write(`${line}\n`)
        return report
    }

    /** Reads, plans and (when asked to execute and drained) re-seeds, one workspace after the other. */
    async reseed(request: ReseedRequest): Promise<ReseedReport> {
        const asked = request.execute === true
        const empty = { mapPath: request.map.path, workspaces: [], totals: perStore(() => NO_COUNT), failed: 0 }
        const map = toolRenameMapOf(request.map.json)
        if (map === null) return { ...empty, executed: false, refusal: "bad_map" }
        const ids = await this.workspaceIds(request.workspaceId)
        const drains = new Map<string, Readonly<Record<string, number>>>()
        await eachInOrder(ids, async (workspaceId) => {
            drains.set(workspaceId, await this.drainOf(workspaceId))
        })
        const open = [...drains.values()].some((drain) => Object.values(drain).some((count) => count > 0))
        const executed = asked && !open
        const workspaces: Array<WorkspaceReseed> = []
        await eachInOrder(ids, async (workspaceId) => {
            workspaces.push(await this.workspace(workspaceId, drains.get(workspaceId) ?? {}, map, executed))
        })
        const totals = perStore((store) =>
            workspaces.reduce<StoreCount>((sum, part) => addedCounts(sum, part.counts[store]), NO_COUNT),
        )
        const failed = workspaces.reduce((sum, part) => sum + part.failed.length, 0)
        const report: ReseedReport = {
            ...empty,
            executed,
            refusal: asked && open ? "not_drained" : null,
            workspaces,
            totals,
            failed,
        }
        if (executed) this.logger.info(ToolReseedLogEvent.Reseeded, { workspaces: workspaces.length, failed, ...totals })
        return report
    }

    /** One workspace: the re-key of the tool grants, then the agents. A refused execute still reads and plans everything. */
    private async workspace(
        workspaceId: string,
        drain: Readonly<Record<string, number>>,
        map: ToolRenameMap,
        executed: boolean,
    ): Promise<WorkspaceReseed> {
        const counts: Record<ReseedStore, StoreCount> = perStore(() => NO_COUNT)
        const notes: Array<string> = []
        counts.tool_grants = await this.grantsRekeyed(workspaceId, map, executed)
        const active = await this.workflows.activeGraphsOf(workspaceId)
        const planned: Array<AgentPart> = []
        await eachInOrder(await this.installations.list(workspaceId), async (installation) => {
            const part = await this.agent(installation, active, map)
            if (part !== null) planned.push(part)
        })
        // The workspace's re-seed is ONE change: every hand-off is judged against the graphs ALL its agents' plans write, so two ends of
        // a hand-off that change together pass whichever is written first (a caller that passes a new input to a callee that takes it now).
        const together = new Map(planned.flatMap((part) => reseedGraphsOf(part.plans, part.templates)))
        const parts: Array<AgentPart> = []
        await eachInOrder(planned, async (part) => {
            parts.push(executed ? await this.executed(part, together) : part)
        })
        const plans = parts.flatMap((part) => part.plans)
        const added = parts.reduce((sum, part) => sum + part.added, 0)
        const workflowCounts = workflowCountsOf(plans, added)
        counts.workflows = workflowCounts.workflows
        counts.graphs = workflowCounts.graphs
        for (const plan of plans.filter((entry) => entry.action === "orphan" || entry.action === "waits")) {
            notes.push(
                `${plan.action} workflow=${plan.workflowId} template=${plan.templateId ?? "none"} old ids ${plan.oldIds} (left as it is)`,
            )
        }
        return {
            workspaceId,
            counts,
            drain,
            plans,
            notes,
            failed: parts.flatMap((part) => (part.failed === null ? [] : [part.failed])),
        }
    }

    /** One agent's plan; null for an installation with no agent. */
    private async agent(
        installation: InstallationRecord,
        active: ReadonlyArray<ActiveWorkflowGraph>,
        map: ToolRenameMap,
    ): Promise<AgentPart | null> {
        const { agentId, workspaceId, moduleKey } = installation
        if (agentId === null) return null
        const old = oldIdsOf(map)
        const templates: ReadonlyArray<CurrentTemplate> = INSTALLED.templatesOf(moduleKey).map((template) => {
            const { version, graph } = latestTemplateVersion(template)
            return { id: template.id, primary: template.primary, version, graph }
        })
        const primary = templates.find((template) => template.primary)
        const state = await this.graphs.stateOfAgent(workspaceId, agentId)
        const standing = {
            runsFlow: state?.active?.flow !== undefined,
            holdsCurrent: primary !== undefined && (await this.flows.holds(workspaceId, agentId, primary.graph)),
        }
        const held: ReadonlyArray<HeldWorkflow> = (await this.workflows.list(workspaceId, agentId, "vi")).map((view) => ({
            id: view.id,
            primary: view.primary,
            status: view.status,
            latestNumber: view.latestNumber,
            template: view.template,
            running: active.find((entry) => entry.workflowId === view.id)?.graph ?? null,
        }))
        const plans = workflowReseedOf(held, templates, standing, old)
        const input = { workspaceId, agentId, installationId: installation.id, moduleKey }
        const added = (await this.installer.plan(input)).filter((row) => row.action === "add").length
        return { installation, agentId, templates, plans, added, failed: null }
    }

    /** One agent's re-seed, its hand-offs judged against the workspace's set (`together`). A failure is kept, the rest goes on. */
    private async executed(part: AgentPart, together: ReadonlyMap<string, GraphSpec>): Promise<AgentPart> {
        const { installation, agentId } = part
        try {
            await this.applied(installation, agentId, part.plans, part.templates, part.added, together)
            return part
        } catch (cause: unknown) {
            this.logger.error(ToolReseedLogEvent.AgentFailed, cause, { workspaceId: installation.workspaceId, agentId })
            return { ...part, failed: { agentId, code: codeOf(cause) } }
        }
    }

    /**
     * The tool grant rows of one workspace re-keyed by the map (an old id carried onto its successor in the same mode; a row whose
     * successor the agent already holds merges into it). A dry run counts what would move.
     */
    private async grantsRekeyed(workspaceId: string, map: ToolRenameMap, executed: boolean): Promise<StoreCount> {
        const keys = await this.grants.toolKeysOf(workspaceId)
        const moves = [...map.tools.entries()].filter(([from]) => keys.some((key) => key.tool === from)).map(([from, to]) => ({ from, to }))
        if (!executed) return { found: keys.length, rewritten: moves.length, removed: 0, orphans: 0 }
        const outcome = await this.grants.rekeyTools(workspaceId, moves)
        return { found: keys.length, rewritten: outcome.rekeyed, removed: outcome.merged, orphans: 0 }
    }

    /** The writes of one agent's plan, through the roads that exist, in the order the plan needs them. */
    private async applied(
        installation: InstallationRecord,
        agentId: string,
        plans: ReadonlyArray<PlannedReseed>,
        templates: ReadonlyArray<CurrentTemplate>,
        added: number,
        together: ReadonlyMap<string, GraphSpec>,
    ): Promise<void> {
        const { workspaceId, moduleKey } = installation
        const primary = templates.find((template) => template.primary)
        const republish = plans.some((plan) => plan.action === "republish")
        if (republish && primary !== undefined) {
            await this.flows.publish({
                workspaceId,
                agentId,
                installationId: installation.id,
                flow: primary.graph,
                installed: nodeIndexOf(INSTALLED.nodeInstall()),
            })
        }
        // The install road: the primary workflow adopts the flow just published; a template the agent holds none of becomes a workflow.
        if (republish || added > 0) await this.workflows.seedAgent(workspaceId, agentId, moduleKey)
        await eachInOrder(plans, async (plan) => {
            if (plan.action === "pause") await this.workflows.setStatus(workspaceId, plan.workflowId, "paused")
            if (plan.action !== "replace") return
            const template = templates.find((entry) => entry.id === plan.toTemplateId)
            if (template === undefined) return
            // The template's current version as shipped, graph and provenance: a later update merges from a version that exists.
            const pick = { templateId: template.id, templateVersion: template.version }
            await this.workflows.adoptTemplateVersion(workspaceId, plan.workflowId, pick, SYSTEM, plan.latestNumber, NOTE, together)
        })
    }

    /** The open rows of block 0 in one workspace, by condition: a read-only count of the core tables of the runs, no SQL. */
    private async drainOf(workspaceId: string): Promise<Readonly<Record<string, number>>> {
        const counts: Record<string, number> = {}
        await eachInOrder(ENGINE_DRAIN, async (condition) => {
            counts[condition.key] = await this.drain.countIn(workspaceId, condition.table, condition.values)
        })
        return counts
    }

    /** The workspace named, or every workspace in id order, a page at a time. */
    private async workspaceIds(only: string | undefined): Promise<ReadonlyArray<string>> {
        if (only !== undefined) return [only]
        const ids: Array<string> = []
        let after: string | undefined
        for (;;) {
            const page = await this.workspaces.list(WORKSPACE_PAGE, after)
            ids.push(...page.map((workspace) => workspace.id))
            after = page.at(-1)?.id
            if (page.length < WORKSPACE_PAGE || after === undefined) return ids
        }
    }
}
