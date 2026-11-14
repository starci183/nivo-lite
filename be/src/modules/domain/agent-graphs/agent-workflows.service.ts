import { Injectable, Optional } from "@nestjs/common"
import type { GraphSpec } from "@nivo-lite/agent-sdk/graph"
import { latestTemplateVersion } from "@nivo-lite/agent-sdk/template"
import { EntityEngineService, type ScopedTx, type ScopedWork } from "@modules/domain/entity-engine"
import type { Locale } from "@modules/platform/i18n"
import { eachInOrder } from "@modules/platform/primitives"
import { AgentGraphRightsService, type WorkflowRightsQuestion, type WorkflowStanding } from "./agent-graph-rights.service"
import { AgentRightsRecordsService, type RightsPlace } from "./agent-rights-records.service"
import { AgentWorkflowAdoptionService } from "./agent-workflow-adoption.service"
import { AgentWorkflowRecordsService } from "./agent-workflow-records.service"
import { AgentWorkflowStoreService, VERSION_LIMIT, WORKFLOW_LIMIT } from "./agent-workflow-store.service"
import type {
    ActiveWorkflowGraph,
    AgentWorkflowGraph,
    BlankWorkflow,
    DiffAgainst,
    ExpectedLatest,
    SnapshotDiff,
    TemplateLink,
    TemplatePick,
    TemplatePreview,
    VersionWrite,
    WorkflowAuthor,
    WorkflowCopy,
    WorkflowDetail,
    WorkflowRecord,
    WorkflowStatus,
    WorkflowVersionRecord,
    WorkflowVersionView,
    WorkflowView,
} from "./agent-workflows.contracts"
import type { FirstVersion, MadeWorkflow } from "./agent-workflow-rights.contracts"
import {
    consentOfAuthor,
    settledOr,
    type AgreedRight,
    type RightsConsent,
    type RightsSettlement,
} from "./policies/node-rights-gate.policy"
import { workflowGraphEntryOf } from "./policies/workflow-graph.policy"
import { workflowDiffOf } from "./policies/workflow-diff.policy"
import { blankGraphOf, templateMergeOf } from "./policies/workflow-template-merge.policy"
import { statusAllowed, workflowKeyOf } from "./policies/workflow-version.policy"
import {
    againstGraphOf,
    linkedGraphOf,
    optionalSnapshotOf,
    snapshotHashOf,
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

/** What the gate settled for a graph, or the settlement of a world with no gate. */
const rightsOf = (settlement: RightsSettlement | undefined, graph: GraphSpec, workflow: WorkflowRecord): RightsSettlement =>
    settledOr(settlement, snapshotHashOf(graph), workflow.agentId, workflow.id)

/** The most workflows of a workspace the Graph page reads. */
const GRAPH_WORKFLOW_LIMIT = 500

@Injectable()
/**
 * The workflows of an agent: each a named graph with its OWN append-only history of full snapshots. A workflow made from a template
 * copies the template's graph as version 1 and keeps only the provenance `{ templateId, templateVersion }`; a template that changes
 * never changes a workflow, and its newer version is offered, merged and written as a NEW version only when the owner accepts it. A
 * rollback is a new version copying an old snapshot. Checks of who may act are the caller's. Every road that makes a version the one
 * that runs (and `setStatus`, which turns a workflow on) asks the rights gate first and writes the rows it settled with the version.
 */
export class AgentWorkflowsService {
    constructor(
        private readonly engine: EntityEngineService,
        private readonly records: AgentWorkflowRecordsService,
        private readonly store: AgentWorkflowStoreService,
        private readonly adoption: AgentWorkflowAdoptionService,
        @Optional() private readonly rights?: AgentGraphRightsService,
        @Optional() private readonly rows?: AgentRightsRecordsService,
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

    /**
     * The graph every workflow of the workspace runs now: one entry per workflow that has an active version whose snapshot reads, of
     * every agent, in agent then list order. Read only (nothing is adopted or written). A workflow with no active version, or whose
     * snapshot no longer parses, has no entry.
     */
    activeGraphsOf(workspaceId: string): Promise<ReadonlyArray<ActiveWorkflowGraph>> {
        return this.engine.scoped(workspaceId, async (tx) => {
            const active: Array<ActiveWorkflowGraph> = []
            await eachInOrder(await this.records.workflowsOfWorkspace(tx, GRAPH_WORKFLOW_LIMIT), async (workflow) => {
                if (workflow.activeVersionId === null) return
                const version = await this.records.version(tx, workflow.activeVersionId)
                const graph = version === null ? null : optionalSnapshotOf(version)
                if (version === null || graph === null) return
                active.push({ workflowId: workflow.id, agentId: workflow.agentId, versionId: version.id, graph })
            })
            return active
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
            const versions = await this.records.versionsOf(tx, workflowId, VERSION_LIMIT)
            const { merged, template, link } = templateMergeOf(workflow, current, templateVersion, versions)
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
    async createFromTemplate(
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
        // A new workflow is a draft that never runs: what the agent's ticks grant is agreed with it, the rest waits for `setStatus`.
        const rights = await this.rights?.decide({
            workspaceId,
            agentId,
            workflowId: null,
            before: null,
            after: graph,
            byTemplate: true,
        })
        const made = await this.write(
            workspaceId,
            rights,
            async (tx) =>
                this.firstVersion(tx, {
                    agentId,
                    key: workflowKeyOf(slug, await this.store.keysOf(tx, agentId)),
                    name: template.name[locale],
                    link,
                    graph,
                    author,
                    locale,
                    rights,
                }),
            (written) => ({ workflowId: written.view.id, versionId: written.versionId }),
        )
        return made.view
    }

    /** Makes a draft workflow from scratch: version 1 holds a graph of the agent's module with one step that ends the run. */
    createBlank(
        workspaceId: string,
        agentId: string,
        blank: BlankWorkflow,
        author: WorkflowAuthor,
        locale: Locale,
    ): Promise<WorkflowView> {
        const graph = blankGraphOf(blank.moduleKey)
        return this.engine.scoped(workspaceId, async (tx) => {
            const made = await this.firstVersion(tx, {
                agentId,
                key: workflowKeyOf(blank.name, await this.store.keysOf(tx, agentId)),
                name: blank.name,
                link: null,
                graph,
                author,
                locale,
                rights: undefined,
            })
            return made.view
        })
    }

    /**
     * Seeds the workflows of an agent: its own graph adopted as the primary workflow, then a workflow from each other template of its
     * module it holds none of yet (a demo shop's), copied from the template's newest version: active when the template is a link of the
     * seeded chain (`seedActive`), else a draft that never runs until the owner turns it on. A rerun adds nothing. Answers how many drafts it made.
     * With `only`, nothing is adopted and only that template is copied: how an agent no seed reached (one a person installed through
     * the app) gets a workflow the engine calls by key, its chat turn; one it holds from the template stays as its owner set it.
     */
    async seedAgent(workspaceId: string, agentId: string, moduleKey: string, only?: string): Promise<number> {
        if (only === undefined) await this.adoption.adoptAgentGraph(workspaceId, agentId)
        const held = await this.adoption.missingTemplatesOf(workspaceId, agentId, moduleKey)
        const missing = only === undefined ? held : held.filter((template) => template.id === only)
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
        agreed?: ReadonlyArray<AgreedRight>,
    ): Promise<WorkflowVersionView> {
        this.store.requireSound(graph)
        const consent = consentOfAuthor(author, agreed)
        const asked = { afterOf: () => Promise.resolve(graph), consent, byTemplate: false }
        return this.version(workspaceId, workflowId, asked, async (tx, workflow) => {
            await this.store.requireCallsSound(tx, workflow, graph)
            return {
                graph,
                kind: author.kind === "nivo" ? "proposal" : "edit",
                author,
                note,
                template: workflow.template,
                fromNumber: null,
                graphVersionId: null,
                expected,
            }
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
        agreed?: ReadonlyArray<AgreedRight>,
    ): Promise<WorkflowVersionView> {
        const consent = consentOfAuthor(author, agreed)
        const sourceOf = async (tx: ScopedTx): Promise<WorkflowVersionRecord> => {
            const versions = await this.records.versionsOf(tx, workflowId, VERSION_LIMIT)
            const source = versions.find((version) => version.number === number)
            if (source === undefined) throw workflowRefused("version")
            return source
        }
        const asked = { afterOf: async (tx: ScopedTx) => snapshotOf(await sourceOf(tx)), consent, byTemplate: false }
        return this.version(workspaceId, workflowId, asked, async (tx, workflow) => {
            const source = await sourceOf(tx)
            if (source.id === workflow.activeVersionId) throw workflowRefused("already-running")
            return {
                graph: snapshotOf(source),
                kind: "rollback",
                author,
                note,
                template: source.template,
                fromNumber: source.number,
                graphVersionId: null,
                expected,
            }
        })
    }

    /**
     * Accepts a newer version of the workflow's template, after the owner reviewed `templatePreview`: the merge (the template's changes
     * on the steps the owner left alone, the owner's side kept wherever both changed) becomes a NEW version, its grant cut to what its
     * steps need, and the provenance moves to that template version. The template itself is never written. What the version asks for
     * on accounts that the agent's ticks grant today is agreed with it; what it asks beyond them needs the owner's yes.
     */
    acceptTemplate(
        workspaceId: string,
        workflowId: string,
        templateVersion: number,
        author: WorkflowAuthor,
        expected: ExpectedLatest,
        note: string,
        agreed?: ReadonlyArray<AgreedRight>,
    ): Promise<WorkflowVersionView> {
        const consent = consentOfAuthor(author, agreed)
        const acceptedOf = async (tx: ScopedTx, workflow: WorkflowRecord, current: GraphSpec): Promise<GraphSpec> => {
            const versions = await this.records.versionsOf(tx, workflow.id, VERSION_LIMIT)
            const { merged } = templateMergeOf(workflow, current, templateVersion, versions)
            return { ...merged.graph, grant: this.store.trimmedGrantOf(merged.graph) }
        }
        const asked = {
            afterOf: (tx: ScopedTx, standing: WorkflowStanding) => acceptedOf(tx, standing.workflow, standing.before),
            consent,
            byTemplate: true,
        }
        return this.version(workspaceId, workflowId, asked, async (tx, workflow, current) => {
            const link = workflow.template
            if (link === null) throw workflowRefused("no-template")
            const graph = await acceptedOf(tx, workflow, current)
            this.store.requireSound(graph)
            return {
                graph,
                kind: "accept_template",
                author,
                note,
                template: { templateId: link.templateId, templateVersion },
                fromNumber: null,
                graphVersionId: null,
                expected,
            }
        })
    }

    /**
     * Puts a workflow on a template version AS SHIPPED, with no merge: a NEW version holding that version's graph exactly, and the
     * provenance moved to it (`templateId` may name the successor of the workflow's own template). The re-seed's road: after it, the
     * workflow's link names a version the installation still ships, so a later template update merges from a base that exists. The
     * gate judges it as a template's version (`byTemplate`).
     */
    adoptTemplateVersion(
        workspaceId: string,
        workflowId: string,
        pick: { readonly templateId: string; readonly templateVersion: number },
        author: WorkflowAuthor,
        expected: ExpectedLatest,
        note: string,
    ): Promise<WorkflowVersionView> {
        // Read when asked, so a version the installation does not ship is a refused promise like every other refusal here.
        const shipped = (): GraphSpec => {
            const graph = templateGraphOf(templateRequired(pick.templateId), pick.templateVersion)
            this.store.requireSound(graph)
            return graph
        }
        const asked = { afterOf: () => Promise.resolve().then(shipped), consent: consentOfAuthor(author, undefined), byTemplate: true }
        return this.version(workspaceId, workflowId, asked, async (tx, workflow) => {
            const graph = shipped()
            await this.store.requireCallsSound(tx, workflow, graph)
            return {
                graph,
                kind: "accept_template",
                author,
                note,
                template: { templateId: pick.templateId, templateVersion: pick.templateVersion },
                fromNumber: null,
                graphVersionId: null,
                expected,
            }
        })
    }

    /**
     * Writes the next version of a workflow: the gate decides the graph that would run first (nothing is written when it refuses),
     * then the version is written with the rows the gate settled, against the workflow and the running graph read in its transaction.
     */
    private async version(
        workspaceId: string,
        workflowId: string,
        asked: Pick<WorkflowRightsQuestion, "afterOf" | "consent" | "byTemplate">,
        writeOf: (tx: ScopedTx, workflow: WorkflowRecord, before: GraphSpec) => Promise<Omit<VersionWrite, "workflow" | "rights">>,
    ): Promise<WorkflowVersionView> {
        const rights = await this.rights?.decideWorkflow({ workspaceId, workflowId, ...asked })
        const work: ScopedWork<WorkflowVersionView> = async (tx) => {
            const workflow = await this.store.workflowRequired(tx, workflowId)
            const before = snapshotOf(await this.store.runningRequired(tx, workflow))
            const write = await writeOf(tx, workflow, before)
            const written = await this.store.writeVersion(tx, {
                ...write,
                workflow,
                rights: rightsOf(rights, write.graph, workflow),
            })
            return workflowVersionViewOf(written.version, before, true)
        }
        return this.write(workspaceId, rights, work, (view) => ({ workflowId, versionId: view.id }))
    }

    /**
     * Moves a workflow to `active`, `draft` or `paused`, as `statusAllowed` permits. It writes no version and grants nothing: a
     * person turning a workflow ON passes `requireRights` first (the door does), and the seed turns on what it made with the rows
     * the ticks gave it.
     */
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

    /**
     * The gate of an activation that writes no version (turning a workflow ON): what the running version asks for beyond the
     * workflow's grant rows refuses a person who is not the owner, and the owner until every such entry is agreed; the agreed
     * entries are recorded as grant rows.
     */
    async requireRights(workspaceId: string, workflowId: string, consent: RightsConsent): Promise<void> {
        if (this.rights === undefined || this.rows === undefined) return
        const afterOf = (_tx: ScopedTx, standing: WorkflowStanding): Promise<GraphSpec> => Promise.resolve(standing.before)
        const asked = { workspaceId, workflowId, afterOf, consent, byTemplate: false }
        await this.rows.recordRunning(workspaceId, await this.rights.decideWorkflow(asked))
    }

    /** Runs a write with the rows the gate settled for it; with none it is the scoped transaction. */
    private write<T>(
        workspaceId: string,
        rights: RightsSettlement | undefined,
        work: ScopedWork<T>,
        placeOf: (written: T) => RightsPlace,
    ): Promise<T> {
        if (this.rows === undefined || rights === undefined) return this.engine.scoped(workspaceId, work)
        return this.rows.run(workspaceId, rights, work, placeOf)
    }

    private async firstVersion(tx: ScopedTx, first: FirstVersion): Promise<MadeWorkflow> {
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
            rights: rightsOf(first.rights, first.graph, workflow),
        })
        return { view: workflowViewOf(written.workflow, written.version, first.locale), versionId: written.version.id }
    }
}
