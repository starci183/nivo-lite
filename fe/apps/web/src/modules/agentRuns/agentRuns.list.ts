import { durationOf, runSourceOf, runStatusOf, shortIdOf, statusToneOf } from "./agentRuns.format"
import type {
    AgentRunRowWire,
    AgentRunsWire,
    RunChipView,
    RunContext,
    RunRowView,
    RunSource,
    RunStatus,
    RunTab,
    RunsFilter,
    RunsView,
} from "./agentRuns.types"

/** The key of a filter that lets every run through. */
export const ALL = "all"

/** The filters of a list nobody has narrowed. */
export const NO_FILTER: RunsFilter = { workflow: ALL, tab: "all", source: ALL, query: "" }

/** The tabs in the order they are drawn. */
const TABS: ReadonlyArray<RunTab> = ["all", "running", "queued", "waiting", "done", "failed"]

/** The sources in the order they are offered. */
const SOURCES: ReadonlyArray<RunSource> = ["customer", "schedule", "event", "agent", "person"]

/** The statuses each tab lets through. */
const TAB_STATUSES: Readonly<Record<RunTab, ReadonlyArray<RunStatus>>> = {
    all: ["queued", "scheduled", "running", "waiting", "done", "failed", "cancelled"],
    running: ["running"],
    queued: ["queued", "scheduled"],
    waiting: ["waiting"],
    done: ["done"],
    failed: ["failed"],
}

/** The name of the workflow a run is pinned to with its version ("Reconcile · Version 3"; the name alone when the version is unknown), or the word for a run with no workflow. */
export const workflowLabelOf = (versionNumber: number | null, context: RunContext, name?: string | null): string => {
    if (name === undefined || name === null || name === "") return context.t("workflowNone")
    return versionNumber === null ? name : context.t("workflowNamed", { name, version: versionNumber })
}

/** The title of a run: the sentence of its work item, else its short id. */
export const runTitleOf = (row: AgentRunRowWire, context: RunContext): string =>
    row.title === "" ? context.t("runTitle", { id: shortIdOf(row.id) }) : row.title

/** Where a run stands in words: the step it is at, its place in the queue, or, for a run that stopped, why. */
export const stepLineOf = (row: AgentRunRowWire, context: RunContext): string => {
    const status = runStatusOf(row.status)
    const line = context.t(`line_${status}`, {
        step: row.stepNumber,
        total: row.stepTotal,
        position: row.queuePosition ?? 1,
    })
    const code = row.errorCode
    return status === "failed" && code !== null && context.has(`error_${code}`)
        ? [line, context.t(`error_${code}`)].join(" · ")
        : line
}

/** How long a run took, or has taken so far; a run that has not begun says how long it has waited. */
const lengthOf = (row: AgentRunRowWire, status: RunStatus, context: RunContext): string => {
    const length = durationOf(row.durationMs, context)
    return status === "queued" || status === "scheduled" ? context.t("durWaiting", { duration: length }) : length
}

/** One run as a row of the table. */
export const rowViewOf = (row: AgentRunRowWire, context: RunContext): RunRowView => {
    const status = runStatusOf(row.status)
    return {
        id: row.id,
        status,
        title: runTitleOf(row, context),
        idLabel: `#${shortIdOf(row.id)}`,
        workflowName: row.workflowName ?? context.t("workflowNone"),
        startedLabel: context.timeOf(row.startedAt),
        workflowLabel: [
            workflowLabelOf(row.versionNumber, context, row.workflowName),
            context.t(`source_${runSourceOf(row.source)}`),
        ].join(" · "),
        stepLine: stepLineOf(row, context),
        durationLabel: lengthOf(row, status, context),
        statusLabel: context.t(`status_${status}`),
        statusTone: statusToneOf(status),
        href: context.hrefOf(row.id),
    }
}

/** Whether a run holds the text the person typed, ignoring case: its title, its workflow line and its short id. */
const matchesQuery = (row: RunRowView, query: string): boolean => {
    const text = query.trim().toLowerCase()
    return text === "" || [row.title, row.workflowLabel, row.stepLine, row.id].join(" ").toLowerCase().includes(text)
}

/** The runs of the agent that pass the workflow, the source and the text; the tab narrows after them so every tab counts the same runs. */
const narrowed = (
    wire: AgentRunsWire,
    filter: RunsFilter,
    context: RunContext,
): ReadonlyArray<{ readonly wire: AgentRunRowWire; readonly view: RunRowView }> =>
    wire.runs
        .map((row) => ({ wire: row, view: rowViewOf(row, context) }))
        .filter(
            (entry) =>
                (filter.workflow === ALL || entry.wire.workflowKey === filter.workflow) &&
                (filter.source === ALL || runSourceOf(entry.wire.source) === filter.source) &&
                matchesQuery(entry.view, filter.query),
        )

/** The tabs with how many of the narrowed runs each holds. */
const tabsOf = (
    narrow: ReadonlyArray<{ readonly view: RunRowView }>,
    context: RunContext,
): ReadonlyArray<RunChipView> =>
    TABS.map((tab) => ({
        value: tab,
        label: context.t(`tab_${tab}`),
        count: narrow.filter((entry) => TAB_STATUSES[tab].includes(entry.view.status)).length,
    }))

/** The sources offered by the select, the first letting everything through. */
const sourcesOf = (wire: AgentRunsWire, context: RunContext): ReadonlyArray<RunChipView> => [
    { value: ALL, label: context.t("source_all"), count: wire.runs.length },
    ...SOURCES.map((source) => ({
        value: source,
        label: context.t(`source_${source}`),
        count: wire.runs.filter((row) => runSourceOf(row.source) === source).length,
    })),
]

/**
 * The list of runs as the page draws it: the workflows with their counts, the rows after every filter, the tabs and the head line. The
 * count of the title is the runs of the workflow the list is narrowed to (every run when it is not), so the page of one workflow counts only its own.
 */
export const runsViewOf = (wire: AgentRunsWire, filter: RunsFilter, context: RunContext): RunsView => {
    const narrow = narrowed(wire, filter, context)
    return {
        workflows: [
            { key: ALL, label: context.t("workflowAll"), count: wire.runs.length },
            ...wire.workflows.map((workflow) => ({
                key: workflow.key,
                label: workflow.name ?? context.t("workflowNone"),
                count: workflow.count,
            })),
        ],
        rows: narrow.filter((entry) => TAB_STATUSES[filter.tab].includes(entry.view.status)).map((entry) => entry.view),
        tabs: tabsOf(narrow, context),
        sources: sourcesOf(wire, context),
        headLine: context.t("headLine", {
            running: wire.activeCount,
            limit: wire.concurrencyLimit,
            queued: wire.queuedCount,
        }),
        title: context.t("title"),
        total: wire.runs.filter((row) => filter.workflow === ALL || row.workflowKey === filter.workflow).length,
        isFiltered:
            filter.workflow !== ALL || filter.tab !== "all" || filter.source !== ALL || filter.query.trim() !== "",
    }
}

/** The tab a key names; a key no tab has reads as all. */
export const tabOf = (key: string): RunTab => TABS.find((tab) => tab === key) ?? "all"
