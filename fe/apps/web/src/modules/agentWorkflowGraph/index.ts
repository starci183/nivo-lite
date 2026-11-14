import type { FlowGraphEdge, FlowGraphNode } from "@starci/grammar/common"

type FlowGraphChip = NonNullable<FlowGraphNode["chips"]>[number]

/*
 * The agent-level read of the Graph tab (`agentWorkflowGraph`): every workflow of one agent with its triggers, outcomes, entry and the
 * calls its ends make. The wire type is written here until codegen has the query; the adapter below is the only reader of it.
 */

/** One input of a workflow: where it is woken from, in words. */
interface WorkflowGraphTriggerWire {
    readonly key: string
    readonly sourceKind: string
    readonly sourceLabel: string
    readonly connectionId: string | null
}

/** One named end of a workflow. */
interface WorkflowGraphOutcomeWire {
    readonly key: string
    readonly label: string
    readonly outputs: ReadonlyArray<{ readonly name: string; readonly type: string }>
}

/** One hand-off: the end that makes it and the workflow it calls. */
interface WorkflowGraphCallWire {
    readonly nodeKey: string
    readonly outcome: string | null
    readonly agent: string
    readonly agentLabel: string
    /** The picture of the target agent; absent until the back end sends it (the sprout is drawn). */
    readonly agentAvatar?: string | null
    readonly workflow: string
    readonly workflowName: string | null
    readonly version: string
    readonly crossAgent: boolean
}

/** One workflow of the agent. */
interface WorkflowGraphEntryWire {
    readonly id: string
    readonly key: string
    readonly name: string
    readonly status: string
    readonly primary: boolean
    readonly activeNumber: number | null
    readonly entry: string
    readonly entryLabel: string
    readonly triggers: ReadonlyArray<WorkflowGraphTriggerWire>
    readonly inputs: ReadonlyArray<{ readonly name: string; readonly type: string; readonly required: boolean }>
    readonly outcomes: ReadonlyArray<WorkflowGraphOutcomeWire>
    readonly calls: ReadonlyArray<WorkflowGraphCallWire>
}

/** The answer of `agentWorkflowGraph`. */
interface AgentWorkflowGraphWire {
    readonly agentId: string
    readonly agentLabel: string
    readonly workflows: ReadonlyArray<WorkflowGraphEntryWire>
}

/** The words the adapter writes itself. */
interface WorkflowGraphWords {
    readonly noInput: string
    /** "open entry": the word before the required inputs of a workflow other workflows call. */
    readonly openEntry: string
    /** The words of an input name (`leadId`, `items`). */
    readonly paramLabel: (name: string) => string
}

/** Where pressing a workflow, or a block of another agent, goes. */
interface WorkflowGraphLinks {
    readonly workflowHref: (workflowKey: string) => string
    /** The Graph tab of the agent of a module; null when the workspace has none installed. */
    readonly agentGraphHref: (module: string) => string | null
}

/** What the canvas draws and the counts of its title row. */
export interface WorkflowGraphView {
    readonly nodes: ReadonlyArray<FlowGraphNode>
    readonly edges: ReadonlyArray<FlowGraphEdge>
    readonly total: number
    readonly running: number
    readonly off: number
}

/** The outcome that counts as the main success: the first one declared (the business win), the rest are neutral. */
const MAIN_OUTCOME_INDEX = 0

const FOREIGN = "x:"

/** How many names a block's line or chips spell out; the rest is a count, so the block stays one card wide. */
const LINE_NAMES = 2

/** The chips of a workflow's outcomes: the first accent, the others neutral. */
const outcomeChipsOf = (entry: WorkflowGraphEntryWire): ReadonlyArray<FlowGraphChip> => {
    const chips = entry.outcomes.slice(0, LINE_NAMES).map(
        (outcome, index): FlowGraphChip => ({
            label: outcome.label,
            tone: index === MAIN_OUTCOME_INDEX ? "accent" : "neutral",
        }),
    )
    const more = entry.outcomes.length - LINE_NAMES
    // A block is one card wide: the first two outcomes, then how many more there are (the workflow's page names them all).
    return more > 0 ? [...chips, { label: `+${more}`, tone: "neutral" }] : chips
}

/** The names of a list as one line: the first few, then "+N" for the rest. */
const shortList = (names: ReadonlyArray<string>, separator: string): string =>
    names.length <= LINE_NAMES
        ? names.join(separator)
        : `${names.slice(0, LINE_NAMES).join(separator)}${separator}+${names.length - LINE_NAMES}`

/** The input line of a workflow: its distinct trigger sources. */
const inputLineOf = (entry: WorkflowGraphEntryWire, words: WorkflowGraphWords): string => {
    const required = entry.inputs.filter((input) => input.required).map((input) => words.paramLabel(input.name))
    const labels = [
        ...new Set(
            entry.triggers.map((trigger) =>
                trigger.sourceKind === "workflow" && required.length > 0
                    ? `${words.openEntry} · ${shortList(required, ", ")}`
                    : trigger.sourceLabel,
            ),
        ),
    ]
    return labels.length === 0 ? words.noInput : shortList(labels, " · ")
}

/** The block of a workflow of another agent: dashed, named by its agent, opening that agent's Graph when it can. */
const foreignNodeOf = (
    id: string,
    call: WorkflowGraphCallWire,
    links: WorkflowGraphLinks,
): FlowGraphNode => {
    const href = links.agentGraphHref(call.agent)
    return {
        id,
        label: call.workflowName ?? call.workflow,
        kind: "action",
        agent: { name: call.agentLabel, ...(call.agentAvatar === undefined || call.agentAvatar === null ? {} : { avatar: call.agentAvatar }) },
        isPlaceholder: true,
        ...(href === null ? {} : { href }),
    }
}

/** The graph of the agent's workflows as FlowGraph `steps` nodes and edges; unconnected workflows stay as islands. */
export const workflowGraphViewOf = (
    wire: AgentWorkflowGraphWire,
    words: WorkflowGraphWords,
    links: WorkflowGraphLinks,
): WorkflowGraphView => {
    const byKey = new Map(wire.workflows.map((entry) => [entry.key, entry]))
    const nodes: FlowGraphNode[] = wire.workflows.map((entry) => ({
        id: entry.id,
        label: entry.name,
        kind: "action",
        description: inputLineOf(entry, words),
        ...(entry.status === "paused" ? { isDimmed: true } : {}),
        href: links.workflowHref(entry.key),
        chips: outcomeChipsOf(entry),
    }))
    const foreign = new Map<string, FlowGraphNode>()
    const edges: FlowGraphEdge[] = wire.workflows.flatMap((entry) =>
        entry.calls.map((call): FlowGraphEdge => {
            const local = call.crossAgent ? undefined : byKey.get(call.workflow)
            const target = local?.id ?? `${FOREIGN}${call.agent}:${call.workflow}`
            if (local === undefined && !foreign.has(target)) foreign.set(target, foreignNodeOf(target, call, links))
            const label = entry.outcomes.find((outcome) => outcome.key === call.outcome)?.label ?? call.outcome ?? undefined
            return {
                id: `${entry.id}:${call.nodeKey}->${target}`,
                source: entry.id,
                target,
                ...(label === undefined ? {} : { label }),
            }
        }),
    )
    return {
        nodes: [...nodes, ...foreign.values()],
        edges,
        total: wire.workflows.length,
        running: wire.workflows.filter((entry) => entry.status === "active").length,
        off: wire.workflows.filter((entry) => entry.status !== "active").length,
    }
}
