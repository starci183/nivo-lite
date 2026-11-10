import { Injectable } from "@nestjs/common"
import type { GraphSpec } from "@nivo-lite/agent-sdk/graph"
import { latestTemplateVersion } from "@nivo-lite/blocks-core/modules"
import { EntityEngineService } from "@modules/domain/entity-engine"
import type { ScopedTx } from "@modules/domain/entity-engine"
import type { Locale } from "@modules/platform/i18n"
import { eachInOrder } from "@modules/platform/primitives"
import { AgentWorkflowAdoptionService } from "./agent-workflow-adoption.service"
import { AgentWorkflowRecordsService } from "./agent-workflow-records.service"
import { AgentWorkflowStoreService, VERSION_LIMIT, WORKFLOW_LIMIT } from "./agent-workflow-store.service"
import type {
    AgentWorkflowGraph,
    BlankWorkflow,
    DiffAgainst,
    ExpectedLatest,
    MergeOutcome,
    SnapshotDiff,
    TemplateLink,
    TemplatePick,
    TemplatePreview,
    WorkflowAuthor,
    WorkflowCopy,
    WorkflowDetail,
    WorkflowRecord,
    WorkflowStatus,
    WorkflowVersionRecord,
    WorkflowVersionView,
    WorkflowView,
} from "./agent-workflows.contracts"
import { workflowGraphEntryOf } from "./policies/workflow-graph.policy"
import { workflowDiffOf } from "./policies/workflow-diff.policy"
import { mergeTemplate } from "./policies/workflow-merge.policy"
import { acceptableTemplateVersion, statusAllowed, workflowKeyOf } from "./policies/workflow-version.policy"
import {
    againstGraphOf,
    linkedGraphOf,
    snapshotOf,
    templateGraphOf,
    templateRequired,
    workflowHistoryOf,
    workflowRefused,
    workflowVersionViewOf,
    workflowViewOf,
} from "./policies/workflow-view.policy"

/** The system as the author of what a seed makes. */
const SYSTEM: WorkflowAuthor = { kind: "system", memberId: null }

/** What the first version of a new workflow is made of. */
interface FirstVersion {
    readonly agentId: string
    readonly key: string
    readonly name: string
    readonly link: TemplateLink | null
    readonly graph: GraphSpec
    readonly author: WorkflowAuthor
    readonly locale: Locale
}

/** The most workflows of a workspace the Graph page reads. */
const GRAPH_WORKFLOW_LIMIT = 500

@Injectable()
/**
 * The workflows of an agent: each a named graph with its OWN append-only history of full snapshots. A workflow made from a template
 * copies the template's graph as version 1 and keeps only the provenance `{ templateId, templateVersion }`; a template that changes
 * never changes a workflow, and its newer version is offered, merged and written as a NEW version only when the owner accepts it. A
 * rollback is a new version copying an old snapshot. Checks of who may act are the caller's.
 */
export class AgentWorkflowsService {
    constructor(
        private readonly engine: EntityEngineService,
        private readonly records: AgentWorkflowRecordsService,
        private readonly store: AgentWorkflowStoreService,
        private readonly adoption: AgentWorkflowAdoptionService,
    ) {}

    /** The workflows of an agent in list order, with the primary one adopted from the agent's graph first when it has none yet. */
    async list(workspaceId: string, agentId: string, locale: Locale): Promise<ReadonlyArray<WorkflowView>> {
        await this.adoption.adoptAgentGraph(workspaceId, agentId)
        return this.engine.scoped(workspaceId, async (tx) => {
            const views: Array<WorkflowView> = []
            await eachInOrder(await this.records.workflowsOf(tx, agentId, WORKFLOW_LIMIT), async (workflow) => {
                views.push(workflowViewOf(workflow, await this.store.runningOf(tx, workflow), locale))
            })
            return views
        })
    }

    /**
     * The agent's Graph page: every workflow of the agent with its input contract, triggers, outcomes, entry rule and end hand-offs, each
     * hand-off naming the workflow it calls among all the workflows of the workspace.
     */
    async graphOf(workspaceId: string, agentId: string, locale: Locale): Promise<AgentWorkflowGraph> {
        await this.adoption.adoptAgentGraph(workspaceId, agentId)
        return this.engine.scoped(workspaceId, async (tx) => {
            const all = await this.records.workflowsOfWorkspace(tx, GRAPH_WORKFLOW_LIMIT)
            const running = new Map<string, WorkflowVersionRecord | null>()
            await eachInOrder(all, async (workflow) => {
                running.set(workflow.id, await this.store.runningOf(tx, workflow))
            })
            const graphOfWorkflow = (workflow: WorkflowRecord): GraphSpec | null => {
                const version = running.get(workflow.id)
                return version === null || version === undefined ? null : snapshotOf(version)
            }
            const targets = all.flatMap((workflow) => {
                const graph = graphOfWorkflow(workflow)
                return graph === null
                    ? []
                    : [{ agentId: workflow.agentId, moduleKey: graph.moduleKey, key: workflow.key, name: workflow.name }]
            })
            const mine = all.filter((workflow) => workflow.agentId === agentId)
            return {
                agentId,
                workflows: mine.map((workflow) =>
                    workflowGraphEntryOf(
                        workflow,
                        graphOfWorkflow(workflow),
                        workflow.activeVersionId === null ? null : (running.get(workflow.id)?.number ?? null),
                        targets,
                        locale,
                    ),
                ),
            }
        })
    }

    /** One workflow with the graph that runs, its history and how it differs from its template version. */
    detail(workspaceId: string, workflowId: string, locale: Locale): Promise<WorkflowDetail> {
        return this.engine.scoped(workspaceId, async (tx) => {
            const workflow = await this.store.workflowRequired(tx, workflowId)
            const versions = await this.records.versionsOf(tx, workflowId, VERSION_LIMIT)
            const running = await this.store.runningRequired(tx, workflow)
            const graph = snapshotOf(running)
            const base = linkedGraphOf(workflow.template)
            return {
                workflow: workflowViewOf(workflow, running, locale),
                graph,
                versions: workflowHistoryOf(versions, workflow.activeVersionId),
                templateDiff: base === null ? null : workflowDiffOf(base, graph),
            }
        })
    }

    /** How one version differs from the one before it, from another version, or from a template version (its own when none is named). */
    versionDiff(workspaceId: string, workflowId: string, number: number, against: DiffAgainst): Promise<SnapshotDiff> {
        return this.engine.scoped(workspaceId, async (tx) => {
            const workflow = await this.store.workflowRequired(tx, workflowId)
            const versions = await this.records.versionsOf(tx, workflowId, VERSION_LIMIT)
            const target = versions.find((version) => version.number === number)
            if (target === undefined) throw workflowRefused("version")
            const after = snapshotOf(target)
            const before = againstGraphOf(workflow, versions, target, against)
            return { before, after, diff: workflowDiffOf(before, after) }
        })
    }

    /** What accepting a newer version of the workflow's template would write, for the owner to review; nothing is written. */
    templatePreview(
        workspaceId: string,
        workflowId: string,
        templateVersion: number,
        locale: Locale,
    ): Promise<TemplatePreview> {
        return this.engine.scoped(workspaceId, async (tx) => {
            const workflow = await this.store.workflowRequired(tx, workflowId)
            const current = snapshotOf(await this.store.runningRequired(tx, workflow))
            const { merged, template, link } = this.mergeOf(workflow, current, templateVersion)
            return {
                templateVersion,
                changes: template.versions
                    .filter((version) => version.version > link.templateVersion && version.version <= templateVersion)
                    .map((version) => ({
                        version: version.version,
                        lines: version.changes.map((line) => line[locale]),
                    })),
                current,
                merged: merged.graph,
                diff: workflowDiffOf(current, merged.graph),
                conflicts: merged.conflicts.map((entry) => entry.key),
            }
        })
    }

    /** Makes a draft workflow of the agent from a template version (the newest when none is named): version 1 is a full copy of its graph. */
    createFromTemplate(
        workspaceId: string,
        agentId: string,
        pick: TemplatePick,
        author: WorkflowAuthor,
        locale: Locale,
    ): Promise<WorkflowView> {
        const template = templateRequired(pick.templateId)
        const at = pick.version ?? latestTemplateVersion(template).version
        const graph = templateGraphOf(template, at)
        this.store.requireSound(graph)
        const link: TemplateLink = { templateId: template.id, templateVersion: at }
        const slug = template.id.split(".").at(-1) ?? template.id
        return this.engine.scoped(workspaceId, async (tx) =>
            this.firstVersion(tx, {
                agentId,
                key: workflowKeyOf(slug, await this.store.keysOf(tx, agentId)),
                name: template.name[locale],
                link,
                graph,
                author,
                locale,
            }),
        )
    }

    /** Makes a draft workflow from scratch: version 1 holds a graph of the agent's module with one step that ends the run. */
    createBlank(
        workspaceId: string,
        agentId: string,
        blank: BlankWorkflow,
        author: WorkflowAuthor,
        locale: Locale,
    ): Promise<WorkflowView> {
        const graph: GraphSpec = {
            schema: "nivo/agent-graph@1",
            moduleKey: blank.moduleKey,
            trigger: { kind: "tag", sources: ["agent"] },
            grant: { rights: [], tools: [], effects: [] },
            nodes: [{ key: "end", kind: "output", step: "stop" }],
        }
        return this.engine.scoped(workspaceId, async (tx) =>
            this.firstVersion(tx, {
                agentId,
                key: workflowKeyOf(blank.name, await this.store.keysOf(tx, agentId)),
                name: blank.name,
                link: null,
                graph,
                author,
                locale,
            }),
        )
    }

    /**
     * Seeds the workflows of an agent: its own graph adopted as the primary workflow, then a workflow from each other template of its
     * module it holds none of yet (a demo shop's), copied from the template's newest version: active when the template is a link of the
     * seeded chain (`seedActive`), else a draft that never runs until the owner turns it on. A rerun adds nothing. Answers how many drafts it made.
     */
    async seedAgent(workspaceId: string, agentId: string, moduleKey: string): Promise<number> {
        await this.adoption.adoptAgentGraph(workspaceId, agentId)
        const missing = await this.adoption.missingTemplatesOf(workspaceId, agentId, moduleKey)
        await eachInOrder(missing, async (template) => {
            const made = await this.createFromTemplate(
                workspaceId,
                agentId,
                { templateId: template.id, version: null },
                SYSTEM,
                "vi",
            )
            // A link of the demo shop's chain (the thank-you a payment hands off to) runs from the start; the rest wait for the owner.
            if (template.seedActive === true) await this.setStatus(workspaceId, made.id, "active")
        })
        return missing.length
    }

    /**
     * Copies every workflow of one installation's agent to another's of the same module, each with its CURRENT snapshot as version 1
     * and its template provenance: the "copy setup from" of a new agent of the role. A rerun copies nothing twice. Answers how many.
     */
    copyWorkflows(workspaceId: string, copy: WorkflowCopy, author: WorkflowAuthor): Promise<number> {
        return this.adoption.copyWorkflows(workspaceId, copy, author)
    }

    /** Publishes a graph as the next version of a workflow (an edit by the owner or a proposal of NIVO), after judging it. */
    publish(
        workspaceId: string,
        workflowId: string,
        graph: GraphSpec,
        author: WorkflowAuthor,
        expected: ExpectedLatest,
        note: string,
    ): Promise<WorkflowVersionView> {
        this.store.requireSound(graph)
        return this.engine.scoped(workspaceId, async (tx) => {
            const workflow = await this.store.workflowRequired(tx, workflowId)
            const before = snapshotOf(await this.store.runningRequired(tx, workflow))
            await this.store.requireCallsSound(tx, workflow, graph)
            const written = await this.store.writeVersion(tx, {
                workflow,
                graph,
                kind: author.kind === "nivo" ? "proposal" : "edit",
                author,
                note,
                template: workflow.template,
                fromNumber: null,
                graphVersionId: null,
                expected,
            })
            return workflowVersionViewOf(written.version, before, true)
        })
    }

    /** Rolls a workflow back: a NEW version that copies the snapshot of an older one, so history only grows. */
    rollback(
        workspaceId: string,
        workflowId: string,
        number: number,
        author: WorkflowAuthor,
        expected: ExpectedLatest,
        note: string,
    ): Promise<WorkflowVersionView> {
        return this.engine.scoped(workspaceId, async (tx) => {
            const workflow = await this.store.workflowRequired(tx, workflowId)
            const versions = await this.records.versionsOf(tx, workflowId, VERSION_LIMIT)
            const source = versions.find((version) => version.number === number)
            if (source === undefined) throw workflowRefused("version")
            if (source.id === workflow.activeVersionId) throw workflowRefused("already-running")
            const before = snapshotOf(await this.store.runningRequired(tx, workflow))
            const written = await this.store.writeVersion(tx, {
                workflow,
                graph: snapshotOf(source),
                kind: "rollback",
                author,
                note,
                template: source.template,
                fromNumber: source.number,
                graphVersionId: null,
                expected,
            })
            return workflowVersionViewOf(written.version, before, true)
        })
    }

    /**
     * Accepts a newer version of the workflow's template, after the owner reviewed `templatePreview`: the merge (the template's changes
     * on the steps the owner left alone, the owner's side kept wherever both changed) becomes a NEW version, its grant cut to what its
     * steps need, and the provenance moves to that template version. The template itself is never written.
     */
    acceptTemplate(
        workspaceId: string,
        workflowId: string,
        templateVersion: number,
        author: WorkflowAuthor,
        expected: ExpectedLatest,
        note: string,
    ): Promise<WorkflowVersionView> {
        return this.engine.scoped(workspaceId, async (tx) => {
            const workflow = await this.store.workflowRequired(tx, workflowId)
            const current = snapshotOf(await this.store.runningRequired(tx, workflow))
            const { merged, link } = this.mergeOf(workflow, current, templateVersion)
            const graph: GraphSpec = { ...merged.graph, grant: this.store.trimmedGrantOf(merged.graph) }
            this.store.requireSound(graph)
            const written = await this.store.writeVersion(tx, {
                workflow,
                graph,
                kind: "accept_template",
                author,
                note,
                template: { templateId: link.templateId, templateVersion },
                fromNumber: null,
                graphVersionId: null,
                expected,
            })
            return workflowVersionViewOf(written.version, current, true)
        })
    }

    /** Moves a workflow to `active`, `draft` or `paused`, as `statusAllowed` permits. */
    setStatus(workspaceId: string, workflowId: string, status: WorkflowStatus): Promise<void> {
        return this.engine.scoped(workspaceId, async (tx) => {
            const workflow = await this.store.workflowRequired(tx, workflowId)
            if (!statusAllowed({ primary: workflow.primary, hasVersion: workflow.activeVersionId !== null }, status)) {
                throw workflowRefused("status")
            }
            if (workflow.status === status) return
            if ((await this.records.patchWorkflow(tx, workflow, { status })) === null) throw workflowRefused("stale")
        })
    }

    private mergeOf(workflow: WorkflowRecord, current: GraphSpec, templateVersion: number): MergeOutcome {
        const link = workflow.template
        if (link === null) throw workflowRefused("no-template")
        const template = templateRequired(link.templateId)
        if (!acceptableTemplateVersion(link, template.id, templateVersion)) throw workflowRefused("template-version")
        const merged = mergeTemplate(
            templateGraphOf(template, link.templateVersion),
            current,
            templateGraphOf(template, templateVersion),
        )
        return { merged, template, link }
    }

    private async firstVersion(tx: ScopedTx, first: FirstVersion): Promise<WorkflowView> {
        const workflow = await this.store.insertWorkflow(tx, {
            agentId: first.agentId,
            key: first.key,
            name: first.name,
            status: "draft",
            primary: false,
            template: first.link,
            createdBy: first.author.memberId,
        })
        const written = await this.store.writeVersion(tx, {
            workflow,
            graph: first.graph,
            kind: first.link === null ? "blank" : "template",
            author: first.author,
            note: "",
            template: first.link,
            fromNumber: null,
            graphVersionId: null,
            expected: 0,
        })
        return workflowViewOf(written.workflow, written.version, first.locale)
    }
}
