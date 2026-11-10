import { runTotalsOf } from "@modules/domain/ai-usage-events"
import type { RunDetail, RunListEntry, RunStepDetail } from "@modules/domain/agent-runs"
import { isRecord } from "@modules/platform/primitives"
import type { WorkItem } from "@modules/domain/work-items"
import type {
    AgentRunDetail,
    AgentRunFact,
    AgentRunItem,
    AgentRunRow,
    AgentRunStepLine,
    AgentRunWorkflow,
    AgentRunsBoard,
    RunBoardStatus,
    RunSource,
    RunStepStatus,
} from "./read-agent-runs.contracts"
import { evidenceOf } from "./agent-work-log.policy"

/** The limit the board tells when the app names none: the same default the engine uses. */
const DEFAULT_CONCURRENCY = 4

/** The key of the workflow of a run that had no graph. */
export const NO_WORKFLOW = "none"

/** The most facts one step tells of what it was given or stored, and the longest a value is. */
const FACTS_MAX = 8
const VALUE_MAX = 160

/** The keys of a graph step's input that are the engine's own bookkeeping, not what the step was given. */
const BOOKKEEPING: ReadonlySet<string> = new Set(["versionId", "nodeKey", "approval"])

/** Where a run stands as a person tells it; a run that has not begun a step is queued, or scheduled when the clock woke it. */
export const boardStatusOf = (entry: RunListEntry): RunBoardStatus => {
    const { status } = entry.run
    if (status === "done") return "done"
    if (status === "cancelled") return "cancelled"
    if (status === "waiting") return "waiting"
    if (status === "running" || status === "compensating") {
        if (entry.stepBegun > 0 || entry.run.status === "compensating") return "running"
        return sourceOf(entry.run.context) === "schedule" ? "scheduled" : "queued"
    }
    return "failed"
}

/** What woke a run, by the ids its context carries. */
export const sourceOf = (context: Readonly<Record<string, unknown>>): RunSource => {
    const has = (key: string): boolean => typeof context[key] === "string" && context[key] !== ""
    if (has("slot") || has("triggerId") || context.tagSource === "schedule") return "schedule"
    if (has("authorAgentId")) return "agent"
    if (has("authorUserId")) return "person"
    if (has("conversationId") || has("messageId")) return "customer"
    return "event"
}

/** The sentence of a work item: what it did, else what it proposed. */
const sentenceOf = (item: WorkItem): string => item.result?.summary ?? item.proposal.summary

/** One run as a row of the list; `queuePosition` is its place among the runs that have not begun. */
export const rowOf = (
    entry: RunListEntry,
    context: {
        readonly versions: ReadonlyMap<string, number>
        readonly items: ReadonlyMap<string, WorkItem>
        readonly now: Date
        readonly queuePosition: number | null
        readonly credits?: ReadonlyMap<string, number>
    },
): AgentRunRow => {
    const { run } = entry
    const status = boardStatusOf(entry)
    const started = run.startedAt ?? context.now
    const ended = run.endedAt
    const item = entry.workItemId === null ? undefined : context.items.get(entry.workItemId)
    return {
        id: run.id,
        status,
        source: sourceOf(run.context),
        title: item === undefined ? "" : sentenceOf(item),
        workflowKey: run.graphVersionId ?? NO_WORKFLOW,
        versionNumber: run.graphVersionId === null ? null : (context.versions.get(run.graphVersionId) ?? null),
        startedAt: started.toISOString(),
        endedAt: ended === null ? null : ended.toISOString(),
        durationMs: Math.max(0, (ended ?? context.now).getTime() - started.getTime()),
        stepTotal: entry.stepTotal,
        stepNumber: Math.min(Math.max(entry.stepDone + 1, 1), Math.max(entry.stepTotal, 1)),
        queuePosition: status === "queued" || status === "scheduled" ? context.queuePosition : null,
        errorCode: run.errorCode,
        workItemId: entry.workItemId,
        creditsUsed: context.credits?.get(run.id) ?? 0,
        cancelledAt: run.cancelledAt === null ? null : run.cancelledAt.toISOString(),
    }
}

/** The runs that have not begun, oldest first, each with its place from one. */
const queuePositionsOf = (entries: ReadonlyArray<RunListEntry>): ReadonlyMap<string, number> => {
    const waiting = entries
        .filter((entry) => ["queued", "scheduled"].includes(boardStatusOf(entry)))
        .toSorted((a, b) => (a.run.startedAt?.getTime() ?? 0) - (b.run.startedAt?.getTime() ?? 0))
    return new Map(waiting.map((entry, index) => [entry.run.id, index + 1]))
}

/** The workflows of the rows: one per graph version, the newest version first, a run with no graph last. */
const workflowsOf = (rows: ReadonlyArray<AgentRunRow>): ReadonlyArray<AgentRunWorkflow> => {
    const found = new Map<string, AgentRunWorkflow>()
    for (const row of rows) {
        const held = found.get(row.workflowKey)
        found.set(row.workflowKey, {
            key: row.workflowKey,
            versionNumber: row.versionNumber,
            count: (held?.count ?? 0) + 1,
        })
    }
    return [...found.values()].toSorted((a, b) => (b.versionNumber ?? -1) - (a.versionNumber ?? -1))
}

/** The list of an agent: the rows, the workflows and what is running and queued now. */
export const boardOf = (
    entries: ReadonlyArray<RunListEntry>,
    versions: ReadonlyMap<string, number>,
    items: ReadonlyMap<string, WorkItem>,
    now: Date,
    extra: { readonly credits?: ReadonlyMap<string, number>; readonly concurrencyLimit?: number } = {},
): AgentRunsBoard => {
    const positions = queuePositionsOf(entries)
    const runs = entries.map((entry) =>
        rowOf(entry, {
            versions,
            items,
            now,
            queuePosition: positions.get(entry.run.id) ?? null,
            ...(extra.credits === undefined ? {} : { credits: extra.credits }),
        }),
    )
    return {
        runs,
        workflows: workflowsOf(runs),
        runningCount: runs.filter((row) => row.status === "running" || row.status === "waiting").length,
        queuedCount: runs.filter((row) => row.status === "queued" || row.status === "scheduled").length,
        concurrencyLimit: extra.concurrencyLimit ?? DEFAULT_CONCURRENCY,
        activeCount: runs.filter((row) => row.status === "running").length,
    }
}

/** The plain facts of an object (text, numbers and flags), cut to a length; the rest of it is not told. */
export const factsOf = (value: unknown): ReadonlyArray<AgentRunFact> => {
    if (!isRecord(value) || Array.isArray(value)) return []
    return Object.entries(value)
        .filter(
            (entry): entry is [string, string | number | boolean] =>
                ["string", "number", "boolean"].includes(typeof entry[1]) && !BOOKKEEPING.has(entry[0]),
        )
        .slice(0, FACTS_MAX)
        .map(([key, held]) => {
            const text = String(held)
            return { key, value: text.length > VALUE_MAX ? `${text.slice(0, VALUE_MAX - 1)}…` : text }
        })
}

/** The kinds of trouble the AI core takes a step over from. */
const RECOVERED_KINDS: ReadonlySet<string> = new Set(["threw", "refused", "failed", "confused"])

/**
 * The mark the engine leaves in the result of a step whose output the AI core produced in place of the node
 * (`result.recovered = { by: "ai", code, kind }`), as two facts: `recovered` (the kind of trouble) and `recoveredCode`. None on a
 * step that ran as written.
 */
export const recoveredFactsOf = (result: unknown): ReadonlyArray<AgentRunFact> => {
    const mark = isRecord(result) ? result.recovered : undefined
    if (!isRecord(mark) || mark.by !== "ai") return []
    const kind = typeof mark.kind === "string" && RECOVERED_KINDS.has(mark.kind) ? mark.kind : "failed"
    const code = typeof mark.code === "string" ? mark.code.slice(0, VALUE_MAX) : ""
    return [
        { key: "recovered", value: kind },
        { key: "recoveredCode", value: code },
    ]
}

/** Where a step stands as a person tells it. */
export const stepStatusOf = (step: RunStepDetail): RunStepStatus => {
    if (step.status === "running") return step.waitItemId === null ? "running" : "waiting"
    if (step.status === "compensating" || step.status === "compensated") return "undone"
    return step.status
}

/** One step of a run. */
export const stepLineOf = (step: RunStepDetail): AgentRunStepLine => ({
    stepKey: step.stepKey,
    nodeKey: step.nodeKey,
    ordinal: step.ordinal,
    status: stepStatusOf(step),
    attempt: step.attempt,
    maxAttempts: step.maxAttempts,
    startedAt: step.startedAt === null ? null : step.startedAt.toISOString(),
    durationMs: step.durationMs,
    errorCode: step.errorCode,
    workItemId: step.waitItemId ?? step.workItemId,
    input: factsOf(isRecord(step.input.trigger) ? step.input.trigger : step.input),
    output: [...factsOf(step.result), ...recoveredFactsOf(step.result)],
    calls: step.calls.map((call) => ({ ...call })),
})

/** The work item a run is about, as its step detail shows it. */
export const itemOf = (item: WorkItem): AgentRunItem => ({
    id: item.id,
    action: item.action,
    summary: sentenceOf(item),
    status: item.status,
    reason: item.reason,
    evidence: evidenceOf(item).map((entry) => ({ key: entry.key, value: entry.value })),
    error: item.error,
})

/** The statuses of a run that stopped on a failed step and may be run again from it. */
const RESUMABLE: ReadonlySet<string> = new Set(["parked", "failed", "dead"])

/** The statuses of a run of the old engine its owner may cancel: queued or running, waiting, or parked for a later try (given up). */
const CANCELLABLE: ReadonlySet<string> = new Set(["running", "waiting", "parked"])

/**
 * What the run page offers on a run. A run of the old engine: Resume from its failed step, Cancel while it runs, waits or is parked. A
 * run on a LangGraph thread never offers the old Resume (its stop is answered on its card); its Cancel is the stop's `skip`, so it is
 * offered only while the thread waits at a stop.
 */
export const runActionsOf = (
    detail: RunDetail,
    stepFailed: number,
    undone: boolean,
): { readonly canResume: boolean; readonly canCancel: boolean } =>
    detail.engine === "langgraph"
        ? { canResume: false, canCancel: detail.run.status === "waiting" }
        : {
              canResume: RESUMABLE.has(detail.run.status) && !undone && stepFailed > 0,
              canCancel: CANCELLABLE.has(detail.run.status),
          }

/** One run with its steps: the row is made from the steps, so it agrees with them. */
export const detailOf = (
    detail: RunDetail,
    versions: ReadonlyMap<string, number>,
    item: WorkItem | null,
    now: Date,
    credits: ReadonlyMap<string, number> = new Map(),
): AgentRunDetail => {
    const { steps } = detail
    const done = steps.filter((step) => step.status === "done" || step.status === "compensated").length
    const entry: RunListEntry = {
        run: detail.run,
        stepTotal: steps.length,
        stepDone: done,
        stepBegun: steps.filter((step) => step.status !== "pending").length,
        stepFailed: steps.filter((step) => step.status === "failed").length,
        workItemId: item?.id ?? steps.find((step) => step.workItemId !== null)?.workItemId ?? null,
    }
    const undone = steps.some((step) => step.status === "compensating" || step.status === "compensated")
    return {
        row: rowOf(entry, {
            versions,
            items: item === null ? new Map() : new Map([[item.id, item]]),
            now,
            queuePosition: null,
            credits,
        }),
        steps: steps.map(stepLineOf),
        item: item === null ? null : itemOf(item),
        ...runActionsOf(detail, entry.stepFailed, undone),
        decision: null,
        aiCalls: [],
        aiTotals: runTotalsOf([]),
    }
}
