import type { GraphSpec } from "@nivo-lite/agent-sdk/graph"
import { type BindingView, type GraphNodeView, type GraphView } from "@/modules/plugin-registry"
import { workflowRowOf, type WorkflowContext, type WorkflowWire } from "@/modules/agentWorkflows"
import type {
    WorkflowCallParamView,
    WorkflowCallView,
    WorkflowChipView,
    WorkflowInputView,
    WorkflowOverviewRowView,
    WorkflowOverviewView,
    WorkflowTableRowView,
} from "@/modules/types"

/** The words of the pages of a workflow: a key of `agentWorkflowPages` and the values it embeds. */
type PageWords = (key: string, values?: Readonly<Record<string, string | number>>) => string

/** One outcome of a workflow as the graph read names it. */
interface OutcomeRead {
    readonly key: string
    readonly label: string
}

/** What the graph read of the agent says of one workflow, as the table needs it. */
interface WorkflowContractRead {
    readonly id: string
    readonly entryLabel: string
    readonly triggers: ReadonlyArray<{ readonly sourceLabel: string }>
    readonly outcomes: ReadonlyArray<OutcomeRead>
    readonly calls: ReadonlyArray<{
        readonly outcome?: string | null | undefined
        readonly workflowName: string | null
        readonly workflow: string
    }>
}

/** An outcome as a chip: its words, and the workflow it calls next when a hand-off follows it (in words, never an arrow). */
const endChipOf = (read: WorkflowContractRead, outcome: OutcomeRead, context: WorkflowContext): string => {
    const targets = read.calls
        .filter((call) => call.outcome === outcome.key)
        .map((call) => call.workflowName ?? call.workflow)
    return targets.length === 0 ? outcome.label : context.t("endThenCalls", { outcome: outcome.label, targets: targets.join(", ") })
}

/** What a row of the table is made from: the workflow, the address of the list, the words and the contract read. */
interface TableRowInput {
    readonly workflow: WorkflowWire
    readonly base: string
    readonly context: WorkflowContext
    readonly read: WorkflowContractRead | undefined
}

/** One workflow as a row of the table; `href` is the page of the workflow, by its key; `read` fills what starts and ends it. */
export const tableRowOf = (input: TableRowInput): WorkflowTableRowView => {
    const { workflow, base, context, read } = input
    const row = workflowRowOf(workflow, context)
    return {
        id: row.id,
        href: `${base}/${encodeURIComponent(workflow.key)}`,
        name: row.name,
        provenance: row.provenance,
        starts: read?.triggers.map((trigger) => trigger.sourceLabel) ?? [],
        ends: read === undefined ? [] : read.outcomes.map((outcome) => endChipOf(read, outcome, context)),
        entry: read?.entryLabel ?? "",
        versionLabel: row.versionLabel,
        runs7d: null,
        statusLabel: row.statusLabel,
        statusTone: row.statusTone,
    }
}

/** The words of a member name (`contactId`): the package's vocabulary of the member, by the language of the page. */
type MemberWords = (name: string) => string

/** The member a ref reads, as its last segment (`steps.tally.output.orderId` reads `orderId`). */
const memberOfRef = (ref: string): string => ref.split(".").at(-1) ?? ref

/** A binding as a chip: a ref bound at run time is dynamic (pink) and shows the words of the member it reads, a fixed value is plain (grey). */
const chipOfBinding = (binding: BindingView, memberWords: MemberWords): WorkflowChipView => ({
    label: binding.ref === null ? binding.text : memberWords(memberOfRef(binding.ref)),
    isDynamic: binding.kind === "ref",
})

/** Where a ref reads from, in words: the run's trigger, the customer's memory, or the outcome of a step. */
const sourceOf = (binding: BindingView, words: PageWords, stepTitles: ReadonlyMap<string, string>): string => {
    const ref = binding.ref
    if (ref === null) return ""
    if (ref.startsWith("trigger.")) return words("fromTrigger")
    if (ref.startsWith("lead.")) return words("fromLead")
    if (ref.startsWith("steps.")) {
        const key = ref.split(".")[1] ?? ""
        return words("fromStep", { step: stepTitles.get(key) ?? key })
    }
    return words("fromWorkflow")
}

const isEnd = (node: GraphNodeView): boolean => node.kind === "end" || node.kind === "output"

/** The calls that follow an outcome node, by the edges of the graph. */
const callsAfter = (graph: GraphView, outcomeKey: string): ReadonlyArray<GraphNodeView> => {
    const to = new Set(graph.edges.filter((edge) => edge.from === outcomeKey).map((edge) => edge.to))
    return graph.nodes.filter((node) => node.call !== undefined && to.has(node.id))
}

/** The inputs every trigger supplies, merged by name: what the workflow needs to start. */
const inputsOf = (graph: GraphView): ReadonlyArray<WorkflowInputView> => {
    const seen = new Map<string, WorkflowInputView>()
    for (const trigger of graph.triggers ?? [])
        for (const param of trigger.params)
            if (!seen.has(param.name)) seen.set(param.name, { name: param.name, label: param.label, isRequired: true })
    return [...seen.values()]
}

const triggerRowsOf = (graph: GraphView): ReadonlyArray<WorkflowOverviewRowView> =>
    (graph.triggers ?? []).map((trigger) => ({
        id: trigger.key,
        title: trigger.sourceLabel,
        line: trigger.conditions.map((condition) => condition.label).join(" / "),
        chips: trigger.params.map((param) => ({ label: param.label, isDynamic: false })),
        end: "",
    }))

const outcomeRowsOf = (graph: GraphView, words: PageWords): ReadonlyArray<WorkflowOverviewRowView> =>
    (graph.outcomes ?? []).map((outcome) => {
        const calls = callsAfter(graph, outcome.key)
        return {
            id: outcome.key,
            title: outcome.label,
            line: "",
            chips: outcome.outputs.map((output) => ({ label: output.label, isDynamic: false })),
            end:
                calls.length === 0
                    ? words("noCall")
                    : words("callsList", {
                          list: calls.map((call) => call.call?.workflowLabel ?? call.label).join(", "),
                      }),
        }
    })

const callsOf = (graph: GraphView, words: PageWords, memberWords: MemberWords): ReadonlyArray<WorkflowCallView> => {
    const stepTitles = new Map(graph.nodes.map((node) => [node.id, node.title ?? node.label]))
    return graph.nodes.flatMap((node) => {
        const call = node.call
        if (call === undefined) return []
        const params = call.params.map((binding): WorkflowCallParamView => ({
            name: binding.name,
            label: binding.label,
            chip: chipOfBinding(binding, memberWords),
            source: sourceOf(binding, words, stepTitles),
        }))
        return [{ id: node.id, target: call.workflowLabel, version: call.versionLabel, params }]
    })
}

/** The words of each source an older spec wakes on. */
const LEGACY_SOURCE_WORDS: Readonly<Record<string, string>> = {
    channel: "sourceChannel",
    "chats-group": "sourceChatsGroup",
    agent: "sourceAgent",
    "system-event": "sourceSystemEvent",
    schedule: "sourceSchedule",
}

/** One row per source the spec wakes on: what an older read, without the contract parts, can still show. */
const legacyTriggersOf = (spec: GraphSpec | null, words: PageWords): ReadonlyArray<WorkflowOverviewRowView> =>
    (spec?.trigger.sources ?? []).map((source) => ({
        id: source,
        title: words(LEGACY_SOURCE_WORDS[source] ?? "sourceChannel"),
        line: "",
        chips: [],
        end: "",
    }))

/**
 * The cards of the overview of a workflow, from the contract parts the graph read carries (`triggers`, `outcomes`, `entry`, and the
 * `call` of each hand-off). A graph without them (an older read) shows the sources its spec wakes on and its end steps.
 */
export const overviewOf = (
    spec: GraphSpec | null,
    graph: GraphView,
    words: PageWords,
    memberWords: MemberWords,
): WorkflowOverviewView => {
    const hasContract = graph.triggers !== undefined
    return {
        triggers: hasContract ? triggerRowsOf(graph) : legacyTriggersOf(spec, words),
        inputs: inputsOf(graph),
        entry: graph.entry?.label ?? words("entryAgent"),
        outcomes: hasContract
            ? outcomeRowsOf(graph, words)
            : graph.nodes
                  .filter((node) => isEnd(node))
                  .map((node) => ({ id: node.id, title: node.title ?? node.label, line: "", chips: [], end: "" })),
        calls: callsOf(graph, words, memberWords),
    }
}
