import { useState } from "react"
import { Cluster, EmptyNotice, Link, SurfaceCard, Text, type HeaderZone, type TableRowData } from "@starci/grammar/common"
import { AgentRunStatusMark, nivoIconSource } from "@/components/leaves/Icon"
import { ALL } from "@/hooks/agentRuns"
import type { RunsTableCopy, RunChipView, RunRowView, RunWorkflowView, RunsFilter, RunsView } from "@/modules/types"

/** How many runs a page of the table holds. */
const RUNS_PAGE_SIZE = 10

/** What the table of runs draws and what it does. */
interface AgentRunsListTableProps {
    readonly props: {
        readonly copy: RunsTableCopy
        readonly view: RunsView
        readonly filter: RunsFilter
        /** The workflows as a select inside the card: what a phone has in place of the column of workflows. */
        readonly workflows: ReadonlyArray<RunWorkflowView> | null
        readonly isLoading: boolean
        /** The page of the table, from one; the table keeps its own page when the page does not own it. */
        readonly page?: number
    }
    readonly on: {
        readonly filter: (next: Partial<RunsFilter>) => void
        readonly tab: (key: string) => void
        readonly page?: (page: number) => void
    }
}

/** The cells of one run: its number (a link), the workflow it ran, when it began, how long it took, and how it ended (an outline mark and the word). */
const rowOf = (row: RunRowView): TableRowData => ({
    id: row.id,
    href: row.href,
    cells: {
        run: (
            <Link variant="plain" href={row.href}>
                {row.idLabel}
            </Link>
        ),
        workflow: <Text>{row.workflowName}</Text>,
        started: <Text tone="muted">{row.startedLabel}</Text>,
        duration: <Text tone="muted">{row.durationLabel}</Text>,
        result: (
            <Cluster gap="inline" wrap={false}>
                <AgentRunStatusMark props={{ status: row.status, label: row.statusLabel }} />
                <Text>{row.statusLabel}</Text>
            </Cluster>
        ),
    },
})

/** A compact select of the search zone that narrows the runs by one thing; its first value lets everything through. */
const selectOf = (
    label: string,
    options: ReadonlyArray<{ readonly id: string; readonly label: string }>,
    value: string,
    onChange: (value: string) => void,
) => ({
    label,
    prefix: `${label}:`,
    options,
    value,
    onChange: (next: string | null) => onChange(next ?? ALL),
})

/** The chips of a select as its options. */
const optionsOf = (chips: ReadonlyArray<RunChipView>) => chips.map((chip) => ({ id: chip.value, label: chip.label }))

/** The tabs that count work waiting for the owner or an error: their chip is pink. */
const ATTENTION: ReadonlySet<string> = new Set(["waiting", "failed"])

/** The header zones of the card: the status tabs with their count chips, then the search row with its selects. */
const headersOf = (props: AgentRunsListTableProps): ReadonlyArray<HeaderZone> => {
    const { copy, view, filter, workflows } = props.props
    return [
                {
                    kind: "filter",
                    label: copy.statusFilter,
                    items: view.tabs.map((chip) => ({
                        id: chip.value,
                        label: chip.label,
                        count: chip.count,
                        ...(ATTENTION.has(chip.value) && chip.count > 0 ? { isAttention: true } : {}),
                    })),
                    selectedKey: filter.tab,
                    onSelect: props.on.tab,
                },
                {
                    kind: "search",
                    label: copy.searchLabel,
                    placeholder: copy.searchPlaceholder,
                    clearLabel: copy.searchClear,
                    value: filter.query,
                    onChange: (query) => props.on.filter({ query }),
                    filters: [
                        ...(workflows === null
                            ? []
                            : [
                                  selectOf(
                                      copy.workflowFilter,
                                      workflows.map((workflow) => ({
                                          id: workflow.key,
                                          label: workflow.key === ALL ? (view.sources[0]?.label ?? workflow.label) : workflow.label,
                                      })),
                                      filter.workflow,
                                      (workflow) => props.on.filter({ workflow }),
                                  ),
                              ]),
                        selectOf(copy.sourceFilter, optionsOf(view.sources), filter.source, (source) =>
                            props.on.filter({ source }),
                        ),
                    ],
                },
            ]
}

/**
 * The runs of an agent as one table card: the title with the count of runs as a chip, the status tabs with their count chips, the search
 * with the selects of the workflow and of what triggered the run on the same row, and the table (run, workflow, start, time, result)
 * with its pager; a row opens its run. The empty state is frameless.
 */
export const AgentRunsListTable = (props: AgentRunsListTableProps) => {
    const { copy, view } = props.props
    const [ownPage, setOwnPage] = useState(1)
    const page = props.props.page ?? ownPage
    const onPage = props.on.page ?? setOwnPage
    const total = view.rows.length
    const pageCount = Math.max(1, Math.ceil(total / RUNS_PAGE_SIZE))
    const current = Math.min(Math.max(page, 1), pageCount)
    const from = (current - 1) * RUNS_PAGE_SIZE
    const shown = view.rows.slice(from, from + RUNS_PAGE_SIZE)
    return (
        <SurfaceCard
            kind="table"
            label={view.title}
            count={view.total ?? total}
            headingLevel={2}
            isLoading={props.props.isLoading}
            headers={headersOf(props)}
            columns={[
                { id: "run", label: copy.run, width: "fit" },
                { id: "workflow", label: copy.workflow, width: "fill", truncate: true },
                { id: "started", label: copy.started, priority: "low", width: "fit" },
                { id: "duration", label: copy.duration, priority: "low", width: "fit" },
                { id: "result", label: copy.result, width: "fit" },
            ]}
            rows={shown.map((row) => rowOf(row))}
            footers={
                pageCount > 1
                    ? [
                          {
                              kind: "paging" as const,
                              page: current,
                              pageCount,
                              onPage,
                              labels: {
                                  nav: copy.pagerLabel,
                                  previous: copy.previous,
                                  next: copy.next,
                                  page: copy.pageLabel,
                                  summary: copy.summary(from + 1, from + shown.length, total),
                              },
                          },
                      ]
                    : []
            }
            empty={
                <EmptyNotice
                    message={view.isFiltered ? copy.emptyFiltered : copy.empty}
                    iconSource={nivoIconSource("history", "leading")}
                />
            }
        />
    )
}
