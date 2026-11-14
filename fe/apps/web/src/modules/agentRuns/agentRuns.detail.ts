import type { RunDetailView, RunGraphNode } from "@/modules/types"
import { canvasOf, pathViewOf, runViewOf, stepOfNode } from "./agentRuns.canvas"
import type { StepsLocale } from "@/modules/workflowSteps"
import { durationOf, runSourceOf, runStatusOf, shortIdOf, statusToneOf, stepStatusOf, stepToneOf } from "./agentRuns.format"
import { recoveredKindOf, resultOf, sentOf } from "./agentRuns.facts"
import { inputsOf, outputsOf, wireMemoryOf, type RunMemorySource } from "./agentRuns.params"
import { humanLabelOf, mapOfRun, type RunGraph } from "./agentRuns.graph"
import { runTitleOf, workflowLabelOf } from "./agentRuns.list"
import type {
    AgentRunStepWire,
    AgentRunWire,
    AgentRunsWire,
    RunContext,
    RunBranchView,
    RunFigureView,
    RunHeadView,
    RunDecisionView,
    RunLogLineView,
    RunParamView,
    RunStepDetailView,
    RunStepStatus,
    RunStepView,
    RunSwitchView,
} from "./agentRuns.types"

/** Where a person decides the work item a waiting step holds. */
export interface RunDetailContext extends RunContext {
    readonly decideHrefOf: (workItemId: string) => string
    /** A frozen customer waits for the owner on this page: its retry is the page's primary. */
    readonly isFrozen?: boolean
    /** Where a workflow of the agent opens, by its key. */
    readonly workflowHrefOf: (workflowKey: string) => string
    /** Where the workflow of the run is set up. */
    readonly setupHref: string
}

/** The title a step is told by: the node of the graph it runs, else the key of the node. */
const titleOf = (graph: ReadonlyArray<RunGraphNode>, nodeKey: string): string =>
    graph.find((node) => node.key === nodeKey)?.title ?? humanLabelOf(nodeKey)

/** The node the page opens on: the step that failed, else the one that waits, else the one that runs, else the last. */
export const defaultKeyOf = (steps: ReadonlyArray<AgentRunStepWire>): string => {
    const needs = (["failed", "waiting", "running"] as const)
        .map((status) => steps.find((step) => stepStatusOf(step.status) === status))
        .find((step) => step !== undefined)
    return (needs ?? steps.at(-1))?.nodeKey ?? ""
}

/** The words of the error of a failed step: the words of its code, else the code itself. */
const errorOf = (code: string | null, context: RunContext): string => {
    if (code === null) return ""
    return context.has(`error_${code}`) ? context.t(`error_${code}`) : context.t("errorUnknown", { code })
}

/** The line that says the AI core finished the step in place of its own code, with the kind of trouble; none on a step that ran as written. */
const recoveredLineOf = (step: AgentRunStepWire, context: RunContext): ReadonlyArray<RunLogLineView> => {
    const kind = recoveredKindOf(step)
    if (kind === null) return []
    const key = `recovered_${kind}`
    return [{ id: `${step.stepKey}:recovered`, text: context.t(context.has(key) ? key : "recovered_failed"), isFailure: false }]
}

/** The log of a step: each door call and how it ended, then the tries it took. */
const logOf = (step: AgentRunStepWire, context: RunContext): ReadonlyArray<RunLogLineView> => [
    ...recoveredLineOf(step, context),
    ...step.calls.map((call, index) => ({
        id: `${step.stepKey}:${String(index)}`,
        text: call.ok ? context.t("callOk", { tool: call.tool }) : context.t("callFailed", { tool: call.tool, why: call.failure ?? "" }),
        isFailure: !call.ok,
    })),
    ...(step.attempt > 1
        ? [
              {
                  id: `${step.stepKey}:tries`,
                  text: context.t("attempts", { attempt: step.attempt, max: step.maxAttempts }),
                  isFailure: false,
              },
          ]
        : []),
]

/** What a step came to in a line: the words of its error, what it made, or the word of its state. */
const resultLineOf = (step: AgentRunStepWire, status: RunStepStatus, context: RunContext): string => {
    if (status === "failed") return errorOf(step.errorCode, context)
    if (status === "done") return resultOf(step) === "" ? context.t("step_done") : resultOf(step)
    return context.t(`step_${status}`)
}

/** The node of the graph a key names. */
const node = (graph: ReadonlyArray<RunGraphNode>, key: string): RunGraphNode | undefined =>
    graph.find((entry) => entry.key === key)

/** The clock of a moment, to the second; empty for none. */
const clockOf = (iso: string | null, context: RunContext): string => (iso === null ? "" : context.clockOf(iso))

/** The words an edge of the map names its way out by: the port it leaves from, else its own label. */
type WayWords = ReadonlyArray<{ readonly source: string; readonly target: string; readonly words: string }>

/** The words of every labelled edge of the map, by the nodes it joins: where a route key is told in the reader's language. */
export const wayWordsOf = (edges: ReadonlyArray<{ readonly source: string; readonly target: string; readonly sourcePort?: string; readonly label?: string }>): WayWords =>
    edges.flatMap((edge) => {
        const words = edge.sourcePort ?? edge.label ?? ""
        return words === "" ? [] : [{ source: edge.source, target: edge.target, words }]
    })

/** A way out of a node: its route key (empty for the plain next step) and the nodes it joins. */
interface WayRef {
    readonly label: string
    readonly source: string
    readonly target: string
}

/** The name of a way out of a node: the words the map gives that edge, the plain next step by its own word. */
const wayLabelOf = (way: WayRef, words: WayWords, context: RunContext): string => {
    const told = words.find((entry) => entry.source === way.source && entry.target === way.target)
    if (told !== undefined && way.label !== "") return told.words
    if (way.label === "") return context.t("branchNext")
    return humanLabelOf(way.label)
}

/** The ways out of a step, the one the run took marked: the step the run went to after it is the one that was taken. */
const branchesOf = (
    wire: AgentRunWire,
    graph: ReadonlyArray<RunGraphNode>,
    step: AgentRunStepWire,
    words: WayWords,
    context: RunContext,
): ReadonlyArray<RunBranchView> => {
    const node = graph.find((entry) => entry.key === step.nodeKey)
    if (node === undefined) return []
    const followed = wire.steps.find((entry) => entry.ordinal > step.ordinal)?.nodeKey
    const ways = [...node.next.map((target) => ({ label: "", target })), ...node.routes]
    return ways.map((way, index) => ({
        id: `${step.stepKey}:way:${String(index)}`,
        label: wayLabelOf({ ...way, source: node.key }, words, context),
        target: titleOf(graph, way.target),
        isTaken: followed !== undefined && way.target === followed,
    }))
}

/** The line under the ways out: which one the run took, or why it ended at the step. */
const branchNoteOf = (
    branches: ReadonlyArray<RunBranchView>,
    status: RunStepStatus,
    title: string,
    context: RunContext,
): string => {
    const taken = branches.find((way) => way.isTaken)
    if (taken !== undefined) return context.t("branchTaken", { label: taken.label, target: taken.target })
    if (status === "failed") return context.t("branchStopped", { title })
    if (branches.length === 0) return context.t("branchEnd")
    return status === "done" ? context.t("branchNone") : ""
}

/** What a finished step that made nothing came to when it chose a way out: that way, as its result ("closed -> classify"). */
const outputsWithWayOf = (
    outputs: ReadonlyArray<RunParamView>,
    branches: ReadonlyArray<RunBranchView>,
    stepKey: string,
    status: RunStepStatus,
    context: RunContext,
): ReadonlyArray<RunParamView> => {
    const taken = branches.find((way) => way.isTaken)
    if (outputs.length > 0 || taken === undefined || status !== "done" || branches.length < 2) return outputs
    return [
        {
            id: `${stepKey}:out:way`,
            name: context.t("fact_branch"),
            value: `${taken.label} → ${taken.target}`,
            source: "",
            isMasked: false,
            isMissing: false,
            raw: "",
            href: "",
        },
    ]
}

/** The line of a failure: its words, and its code when it has one. */
const errorLineOf = (words: string, code: string | null): string => (code === null ? words : `${words} (${code})`)

/** The detail of the step a person selected: how it went, the params it ran with and what it made, the way out it took. */
const selectedOf = (
    wire: AgentRunWire,
    graph: ReadonlyArray<RunGraphNode>,
    key: string,
    kind: string,
    ways: WayWords,
    memory: RunMemorySource,
    context: RunDetailContext,
): RunStepDetailView | null => {
    const step = stepOfNode(wire.steps, key)
    if (step === undefined) return null
    const status = stepStatusOf(step.status)
    const title = titleOf(graph, step.nodeKey)
    const ended =
        step.startedAt !== null && step.durationMs !== null && status !== "running"
            ? new Date(new Date(step.startedAt).getTime() + step.durationMs).toISOString()
            : null
    const failure = memory.steps[step.nodeKey]?.error ?? null
    const branches = branchesOf(wire, graph, step, ways, context)
    const code = failure?.code === "" ? null : (failure?.code ?? step.errorCode)
    const words = failure !== null && failure.message !== "" ? failure.message : errorOf(code, context)
    return {
        id: step.stepKey,
        title,
        kindLabel: kind,
        status,
        statusLabel: context.t(`step_${status}`),
        statusTone: stepToneOf(status),
        startedLabel: clockOf(step.startedAt, context),
        endedLabel: clockOf(ended, context),
        error: status === "failed" ? errorLineOf(words, code) : "",
        attemptLabel: step.attempt > 1 ? context.t("attemptOf", { attempt: step.attempt, max: step.maxAttempts }) : "",
        inputs: inputsOf(node(graph, step.nodeKey)?.bindings ?? {}, step, memory, context),
        outputs: outputsWithWayOf(outputsOf(step, memory, context), branches, step.stepKey, status, context),
        branches,
        branchNote: branchNoteOf(branches, status, title, context),
        sent: sentOf(step),
        log: logOf(step, context),
        decideHref: status === "waiting" && step.workItemId !== null ? context.decideHrefOf(step.workItemId) : "",
    }
}

/** The steps of the left pane: each titled by its node, with its length of time, a step of a group drawn indented. */
const stepsOf = (
    wire: AgentRunWire,
    graph: ReadonlyArray<RunGraphNode>,
    context: RunContext,
): ReadonlyArray<RunStepView> =>
    wire.steps.map((step) => {
        const status = stepStatusOf(step.status)
        const node = graph.find((entry) => entry.key === step.nodeKey)
        return {
            id: step.nodeKey,
            nodeKey: step.nodeKey,
            label: node?.title ?? humanLabelOf(step.nodeKey),
            status,
            statusLabel: context.t(`step_${status}`),
            durationLabel: status === "pending" ? "" : durationOf(step.durationMs, context),
            isNested: (node?.group ?? "") !== "",
            result: resultLineOf(step, status, context),
        }
    })

/** What woke the run, in words: the channel and the customer, else the kind of source. */
const triggerOf = (wire: AgentRunWire, context: RunContext): string => {
    const facts = wire.steps[0]?.input ?? []
    const valueOf = (key: string): string => facts.find((fact) => fact.key === key)?.value ?? ""
    const channel = valueOf("channel")
    const channelWords = channel !== "" && context.has(`channel_${channel}`) ? context.t(`channel_${channel}`) : ""
    const lead = context.entityOf?.("leadId", valueOf("leadId"))?.label ?? ""
    const words = [channelWords, lead].filter((part) => part !== "").join(" · ")
    return words === "" ? context.t(`source_${runSourceOf(wire.row.source)}`) : words
}

/** The head of a run. */
const headOf = (wire: AgentRunWire, context: RunDetailContext): RunHeadView => {
    const { row } = wire
    const status = runStatusOf(row.status)
    return {
        id: row.id,
        title: row.title === "" ? context.t("runTitleBare") : row.title,
        shortId: shortIdOf(row.id),
        status,
        statusLabel: context.t(`status_${status}`),
        statusTone: statusToneOf(status),
        meta: context.t("headMeta", {
            time: context.timeOf(row.startedAt),
            trigger: triggerOf(wire, context),
            step: row.stepNumber,
            total: row.stepTotal,
        }),
        workflowName: row.workflowName ?? "",
        canvasTitle: row.workflowName === null || row.workflowName === undefined ? "" : context.t("canvasHead", { name: row.workflowName }),
        stepCount: row.stepTotal,
        versionLabel: row.versionNumber === null ? "" : context.t("versionChip", { version: row.versionNumber }),
        workflowHref: row.workflowName === null || row.workflowName === undefined ? "" : context.workflowHrefOf(row.workflowKey),
        isRetryNeutral: wire.decision !== null || context.isFrozen === true,
        canResume: wire.canResume,
        canCancel: wire.canCancel,
    }
}

/** The summary: what woke the run, where it stands, how long it took and the graph it ran on. */
const figuresOf = (wire: AgentRunWire, context: RunDetailContext): ReadonlyArray<RunFigureView> => {
    const { row } = wire
    const status = runStatusOf(row.status)
    return [
        {
            id: "trigger",
            term: context.t("sumTrigger"),
            value: [context.t(`source_${runSourceOf(row.source)}`), context.timeOf(row.startedAt)].join(" · "),
            href: "",
        },
        { id: "status", term: context.t("sumStatus"), value: context.t(`status_${status}`), tone: statusToneOf(status), href: "" },
        { id: "duration", term: context.t("sumDuration"), value: durationOf(row.durationMs, context), href: "" },
        {
            id: "workflow",
            term: context.t("sumWorkflow"),
            value: workflowLabelOf(row.versionNumber, context, row.workflowName),
            href: context.setupHref,
        },
        {
            id: "credit",
            term: context.t("sumCredit"),
            value: context.t("creditValue", { count: row.creditsUsed }),
            href: "",
        },
    ]
}

/** The runs that are running now, other than this one, for the quick switch. */
const switchesOf = (runs: AgentRunsWire | undefined, openId: string, context: RunContext): ReadonlyArray<RunSwitchView> =>
    (runs?.runs ?? [])
        .filter((row) => row.id !== openId && (row.status === "running" || row.status === "waiting"))
        .map((row) => ({ id: row.id, label: runTitleOf(row, context), href: context.hrefOf(row.id) }))

/** The decision the run waits on, or null when it waits on none. */
const decisionOf = (wire: AgentRunWire): RunDecisionView | null =>
    wire.decision === null
        ? null
        : { title: wire.decision.title, positive: wire.decision.options.includes("retry") ? "retry" : "approve" }

/** The namespace of the workflow a run executes (`<module>.<workflow>`), as far as the read says: the key of its workflow, else `main`. */
const namespaceOf = (wire: AgentRunWire): string => wire.row.workflowKey ?? "main"

/** The page of a run: the head, the summary, the steps, the map painted by them and the step the person selected. */
export const runDetailViewOf = (
    wire: AgentRunWire,
    graph: RunGraph,
    selection: string,
    runs: AgentRunsWire | undefined,
    context: RunDetailContext,
    locale: StepsLocale,
    memory?: RunMemorySource,
): RunDetailView => {
    const selectedKey = selection === "" ? defaultKeyOf(wire.steps) : selection
    const isFinished = ["done", "failed"].includes(wire.row.status)
    const map = mapOfRun(graph.nodes, wire.steps, locale, (key) => (context.has(`nodeName_${key}`) ? context.t(`nodeName_${key}`) : undefined))
    const canvas = canvasOf(wire.steps, pathViewOf(runViewOf(graph.view, map, locale), wire.steps), isFinished, selectedKey, context, locale)
    const kindOf = canvas.nodes.find((node) => node.id === selectedKey)?.kind
    const kind = canvas.kinds.find((entry) => entry.kind === kindOf)?.label ?? ""
    const words = wayWordsOf(canvas.edges)
    return {
        head: headOf(wire, context),
        figures: figuresOf(wire, context),
        steps: stepsOf(wire, map, context),
        canvas,
        selected: selectedOf(wire, map, selectedKey, kind, words, memory ?? wireMemoryOf(wire.steps, wire.row.id, namespaceOf(wire)), context),
        decision: decisionOf(wire),
        switches: switchesOf(runs, wire.row.id, context),
        selectedKey,
    }
}
