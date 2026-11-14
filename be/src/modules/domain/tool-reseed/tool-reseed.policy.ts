import type { GraphSpec } from "@nivo-lite/agent-sdk/graph"
import { renameFileSchema } from "./tool-reseed.schema"

/**
 * The stores the re-seed verb WRITES, and nothing else (a spec proves it): the workflows of each agent and their append-only versions
 * (`agent_workflows`, `agent_workflow_versions`), the agent's own graph and its versions (`agent_graphs`, `agent_graph_versions`: the flow
 * the primary workflow adopts) and the tool grants re-keyed by the rename map (`mcp_tool_grants`: the allow-list of a road outside every
 * node). Ability ticks, node rows, endpoint rights and shadow tallies are REMOVED concepts (nivo-frame `rights`): nothing writes them.
 */
export const RESEED_STORES = ["workflows", "graphs", "tool_grants"] as const

/** One store of the re-seed. */
export type ReseedStore = (typeof RESEED_STORES)[number]

/** The words of a store in the printed report. */
export const RESEED_STORE_WORDS: Readonly<Record<ReseedStore, string>> = {
    workflows: "workflows + versions (agent_workflows, agent_workflow_versions)",
    graphs: "agent flows (agent_graphs, agent_graph_versions)",
    tool_grants: "tool grants re-keyed (mcp_tool_grants)",
}

/**
 * What the verb never writes: run history, the call log, the effect ledger, closed and open work, the lead memory, published template
 * packages, setup snapshots, checkpoints and every record of business data. Printed with every report.
 */
export const HISTORY_STORES: ReadonlyArray<string> = [
    "mcp_call_log",
    "agent_runs",
    "agent_run_steps",
    "run_stops",
    "agent_runs.workflow_version_id (run pins)",
    "agent_node_effects (effect ledger)",
    "contact_memory",
    "work_items",
    "approval_requests",
    "agent_checkpoints",
    "agent_template_versions.package",
    "module_context_versions.snapshot",
    "business records (leads, orders, payments, conversations, messages)",
]

/** One drain condition the verb reads from a core table of the runs: the count of rows of `table` whose status is one of `values`. */
export interface EngineDrainCondition {
    /** The name printed. */
    readonly key: string
    /** The core table: the runs or their steps. */
    readonly table: "agent_runs" | "agent_run_steps"
    /** The open statuses. */
    readonly values: ReadonlyArray<string>
}

/**
 * The drain conditions of block 0 of `20261112014200_tool-names-nivo.sql` on the core tables of the runs: read by the verb per
 * workspace (a count through TypeORM, no SQL). The verb refuses `--execute` while any is above zero.
 */
export const ENGINE_DRAIN: ReadonlyArray<EngineDrainCondition> = [
    { key: "runs", table: "agent_runs", values: ["running", "waiting", "parked", "compensating"] },
    { key: "steps", table: "agent_run_steps", values: ["pending", "running", "compensating"] },
]

/**
 * The drain conditions of block 0 that live in plain tables the verb cannot read without raw SQL or another capability's entity: the
 * restart owner checks them by hand (block 0's own SELECTs, read only) before `--execute`. Printed with every report.
 */
export const BY_HAND_DRAIN: ReadonlyArray<string> = [
    "jobs: public.jobs status IN (running, failed_awaiting_fix)",
    "outbox: public.job_outbox state IN (queued, running) on agent_turn, thread_deadline, module_jobs, payment_order_requested, decisions (the recurring ticks excluded)",
    "wakes: public.agent_wakes status IN (pending, running), or source thread with status IN (held, failed)",
    "approvals: public.approval_requests status pending",
    "work_items: public.work_items status IN (queued, waiting_decision) that are lead_frozen, a tool-approval:% key or name a runId",
    "threads: public.agent_checkpoints of a run that is running, waiting, parked or compensating",
    "care_timers: public.agent_tasks status IN (open, waiting) with next_action_at set",
    "stops: public.run_stops state open",
    "freezes: public.contact_freezes status IN (frozen, retrying)",
]

/** The parsed rename map: every old tool id with its successor. */
export interface ToolRenameMap {
    /** Old id -> new id. */
    readonly tools: ReadonlyMap<string, string>
}

/** The rename map of a parsed file (`scripts/tool-rename-20261112.json`), or null when it holds no `tools` table of ids. */
export const toolRenameMapOf = (json: unknown): ToolRenameMap | null => {
    const parsed = renameFileSchema.safeParse(json)
    return parsed.success ? { tools: new Map(Object.entries(parsed.data.tools)) } : null
}

/** The old ids of a map: every key that is not also a successor (a key equal to a new id is no old id). */
export const oldIdsOf = (map: ToolRenameMap): ReadonlySet<string> => {
    const successors = new Set(map.tools.values())
    return new Set([...map.tools.keys()].filter((id) => !successors.has(id)))
}

const isRecord = (value: unknown): value is Readonly<Record<string, unknown>> =>
    typeof value === "object" && value !== null && !Array.isArray(value)

/**
 * How many times a JSON document holds an old id as a WHOLE string value or as an object key: an exact id comparison (integrity, as the
 * migration's rewriter compares), never a reading of words. A longer string that contains an id is not counted.
 */
export const oldIdCountIn = (json: unknown, old: ReadonlySet<string>): number => {
    if (typeof json === "string") return old.has(json) ? 1 : 0
    if (Array.isArray(json)) return json.reduce<number>((sum, item) => sum + oldIdCountIn(item, old), 0)
    if (!isRecord(json)) return 0
    return Object.entries(json).reduce((sum, [key, value]) => sum + (old.has(key) ? 1 : 0) + oldIdCountIn(value, old), 0)
}

/** A JSON value with every object's keys in order, so two graphs that differ only in key order compare equal. */
const canonicalOf = (json: unknown): unknown => {
    if (Array.isArray(json)) return json.map((item) => canonicalOf(item))
    if (!isRecord(json)) return json
    return Object.fromEntries(
        Object.keys(json)
            .toSorted((a, b) => Number(a > b) - Number(a < b))
            .map((key) => [key, canonicalOf(json[key])]),
    )
}

/** Whether two graphs are the same graph, whatever the order of their keys. */
export const sameGraph = (left: unknown, right: unknown): boolean =>
    JSON.stringify(canonicalOf(left)) === JSON.stringify(canonicalOf(right))

/** A workflow an agent holds, as the plan reads it. */
export interface HeldWorkflow {
    /** The workflow. */
    readonly id: string
    /** True for the agent's primary workflow. */
    readonly primary: boolean
    /** `active`, `paused` or `draft`. */
    readonly status: string
    /** The newest version number. */
    readonly latestNumber: number
    /** The template provenance, or null for one made from scratch. */
    readonly template: { readonly templateId: string; readonly templateVersion: number } | null
    /** The graph of the version that runs, or null when none reads. */
    readonly running: unknown
}

/** A template of the agent's module at its ONE current version, as the installation ships it. */
export interface CurrentTemplate {
    /** The template id. */
    readonly id: string
    /** True for the module's primary template. */
    readonly primary: boolean
    /** The current (newest) version. */
    readonly version: number
    /** Its graph. */
    readonly graph: GraphSpec
}

/** Where the agent's own graph stands for the primary template. */
export interface PrimaryStanding {
    /** True when the agent runs a flow (its graph's live version holds one): only then is a flow republished. */
    readonly runsFlow: boolean
    /** True when the live version is a spec already holding the primary template's current graph. */
    readonly holdsCurrent: boolean
}

/**
 * What the re-seed does about one workflow:
 * - `current`: it runs its template's current graph already; nothing.
 * - `republish`: the primary workflow; the primary template's current graph is published as the agent's flow and the workflow adopts it.
 * - `waits`: the primary workflow of an agent that runs no flow (its setup still writes the rules): nothing, as at an install.
 * - `replace`: a workflow of an installed template that runs another graph; a NEW version holds the template's current graph.
 * - `pause`: a workflow of a template the installation no longer ships, still active or draft; it is paused (never deleted).
 * - `orphan`: made from scratch, or a primary workflow of a module with no primary template, or already paused with its template gone:
 *   left as it is and listed.
 */
export type WorkflowReseedAction = "current" | "republish" | "waits" | "replace" | "pause" | "orphan"

/**
 * The template a stored workflow's template id is carried onto when the installation renamed or merged it: old id -> the id of its
 * successor, as DATA (never derived from the words of a key). Empty for the template-agent flip of 2026-11-12: every old template id
 * is the key of exactly one graph of the template agents (`<module>.<workflow>`, all 37 checked), so each workflow keeps its id. A
 * later rename adds its line here (or, cleaner, the graph declares it: a `supersedes` member on the graph's catalogue entry, which the
 * installation would read into this map).
 */
export const TEMPLATE_SUCCESSORS: ReadonlyMap<string, string> = new Map<string, string>()

/** The template id a stored workflow's template id stands for now: its declared successor, else itself. */
export const successorOf = (templateId: string, successors: ReadonlyMap<string, string> = TEMPLATE_SUCCESSORS): string =>
    successors.get(templateId) ?? templateId

/** The plan of one workflow. */
export interface PlannedReseed {
    /** The workflow. */
    readonly workflowId: string
    /** Its template, or null. */
    readonly templateId: string | null
    /** True for the agent's primary workflow (its flow is the agent graph's). */
    readonly primary: boolean
    /** What the re-seed does. */
    readonly action: WorkflowReseedAction
    /** The template it moves onto (`replace`: its own, or the declared successor), else null. */
    readonly toTemplateId: string | null
    /** The current template version it moves to (`republish`, `replace`), else null. */
    readonly toVersion: number | null
    /** The newest version number the plan read (the expected latest of a `replace`). */
    readonly latestNumber: number
    /** How many old ids its running graph holds (after the re-seed, an `orphan` or `waits` still holds them). */
    readonly oldIds: number
}

/** The plan of one primary workflow. */
const primaryPlanOf = (
    held: HeldWorkflow,
    template: CurrentTemplate | undefined,
    standing: PrimaryStanding,
): Pick<PlannedReseed, "action" | "toTemplateId" | "toVersion"> => {
    if (template === undefined) return { action: "orphan", toTemplateId: null, toVersion: null }
    if (!standing.runsFlow) return { action: "waits", toTemplateId: null, toVersion: null }
    if (standing.holdsCurrent && sameGraph(held.running, template.graph)) {
        return { action: "current", toTemplateId: null, toVersion: null }
    }
    return { action: "republish", toTemplateId: null, toVersion: template.version }
}

/**
 * The plan of one other workflow, against the template its id stands for now (`successorOf`). Running that template's current graph
 * under that template's current version: nothing. Else a `replace` puts it on that version as shipped, the graph AND the provenance, so
 * a later update merges from a version the installation still ships. A template the installation no longer ships pauses it.
 */
const otherPlanOf = (
    held: HeldWorkflow,
    templates: ReadonlyArray<CurrentTemplate>,
    successors: ReadonlyMap<string, string>,
): Pick<PlannedReseed, "action" | "toTemplateId" | "toVersion"> => {
    if (held.template === null) return { action: "orphan", toTemplateId: null, toVersion: null }
    const { templateId, templateVersion } = held.template
    const now = successorOf(templateId, successors)
    const template = templates.find((entry) => entry.id === now && !entry.primary)
    if (template === undefined) {
        return { action: held.status === "paused" ? "orphan" : "pause", toTemplateId: null, toVersion: null }
    }
    const linked = now === templateId && templateVersion === template.version
    if (linked && sameGraph(held.running, template.graph)) return { action: "current", toTemplateId: null, toVersion: null }
    return { action: "replace", toTemplateId: template.id, toVersion: template.version }
}

/**
 * The plan of the workflows of one agent against the templates of its module at their one current version: one entry per workflow it
 * holds, in the order given. The workflows the agent holds none of are the install road's (`AgentWorkflowInstallService.plan`).
 */
export const workflowReseedOf = (
    held: ReadonlyArray<HeldWorkflow>,
    templates: ReadonlyArray<CurrentTemplate>,
    standing: PrimaryStanding,
    old: ReadonlySet<string>,
    successors: ReadonlyMap<string, string> = TEMPLATE_SUCCESSORS,
): ReadonlyArray<PlannedReseed> =>
    held.map((workflow) => {
        const planned = workflow.primary
            ? primaryPlanOf(workflow, templates.find((entry) => entry.primary), standing)
            : otherPlanOf(workflow, templates, successors)
        return {
            workflowId: workflow.id,
            templateId: workflow.template?.templateId ?? null,
            primary: workflow.primary,
            ...planned,
            latestNumber: workflow.latestNumber,
            oldIds: oldIdCountIn(workflow.running, old),
        }
    })

/** The counts of one store in one workspace. */
export interface StoreCount {
    /** Rows (or records) the verb read that hold a re-seeded value. */
    readonly found: number
    /** Rows rewritten (a new version, a renamed id, a re-derived row, a workflow added or paused). */
    readonly rewritten: number
    /** Rows removed (a merged duplicate, a row no longer derived). */
    readonly removed: number
    /** Rows left as they are because nothing succeeds them (listed). */
    readonly orphans: number
}

/** A count of nothing. */
export const NO_COUNT: StoreCount = { found: 0, rewritten: 0, removed: 0, orphans: 0 }

/** Two counts added member by member. */
export const addedCounts = (left: StoreCount, right: StoreCount): StoreCount => ({
    found: left.found + right.found,
    rewritten: left.rewritten + right.rewritten,
    removed: left.removed + right.removed,
    orphans: left.orphans + right.orphans,
})

/** A value per store. */
export const perStore = <T>(make: (store: ReseedStore) => T): Record<ReseedStore, T> => ({
    workflows: make("workflows"),
    graphs: make("graphs"),
    tool_grants: make("tool_grants"),
})

/** The counts of the workflows and flows of a set of plans, and of the workflows the install road adds. */
export const workflowCountsOf = (
    plans: ReadonlyArray<PlannedReseed>,
    added: number,
): Pick<Record<ReseedStore, StoreCount>, "workflows" | "graphs"> => {
    const of = (action: WorkflowReseedAction): number => plans.filter((plan) => plan.action === action).length
    return {
        workflows: {
            found: plans.length,
            rewritten: of("replace") + of("republish") + of("pause") + added,
            removed: 0,
            orphans: of("orphan"),
        },
        graphs: {
            found: plans.filter((plan) => plan.primary).length,
            rewritten: of("republish"),
            removed: 0,
            orphans: 0,
        },
    }
}

/** The words of the counts of one store. */
export const countWordsOf = (count: StoreCount, executed: boolean): string =>
    `found ${count.found}, ${executed ? "rewritten" : "to rewrite"} ${count.rewritten}, ${executed ? "removed" : "to remove"} ${count.removed}, orphans ${count.orphans}`
