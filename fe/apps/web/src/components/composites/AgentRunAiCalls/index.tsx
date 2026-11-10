import { DataTable, EmptyNotice, Section, Stack, Text, type DataTableColumn, type DataTableRow } from "@starci/grammar/common"
import type { AiCallRowView } from "@/hooks/agentRuns"

/** The words of the "AI calls" section. */
interface AgentRunAiCallsCopy {
    readonly title: string
    /** The chip after the title: "<n> kinds". */
    readonly kinds: string
    readonly empty: string
    readonly purpose: string
    readonly calls: string
    readonly prompt: string
    readonly completion: string
    readonly time: string
    readonly cost: string
    readonly model: string
}

/** What the section draws: its words and one row per call kind. */
export interface AgentRunAiCallsProps {
    readonly copy: AgentRunAiCallsCopy
    readonly rows: ReadonlyArray<AiCallRowView>
}

/** One row of the table. */
interface AiCallRow extends DataTableRow {
    readonly view: AiCallRowView
}

/** A cell's main figure, its 12 muted line, and whether it is a number (end-aligned, tabular). */
interface FigureProps {
    readonly main: string
    readonly note: string
    readonly isNumeric: boolean
}

/** A figure over its 12 muted line (none when the line is empty). */
const Figure = ({ main, note, isNumeric }: FigureProps) =>
    note === "" ? (
        <Text tabular={isNumeric}>{main}</Text>
    ) : (
        <Stack gap="identity" align={isNumeric ? "end" : "start"}>
            <Text tabular={isNumeric}>{main}</Text>
            <Text size="xs" tone="muted" tabular={isNumeric}>
                {note}
            </Text>
        </Stack>
    )

/** What one cell draws: the column's figure and, under it, its secondary line. */
const cellOf = (row: AiCallRowView, columnId: string) => {
    if (columnId === "purpose") return <Figure main={row.purpose} note={row.finish} isNumeric={false} />
    if (columnId === "calls") return <Figure main={row.calls} note={row.callsNote} isNumeric />
    if (columnId === "prompt") return <Figure main={row.prompt} note={row.promptNote} isNumeric />
    if (columnId === "completion") return <Figure main={row.completion} note={row.completionNote} isNumeric />
    if (columnId === "time") return <Figure main={row.time} note={row.timeNote} isNumeric />
    if (columnId === "cost") return <Text tabular>{row.cost}</Text>
    return <Text>{row.model}</Text>
}

/**
 * The AI calls of a run under its graph: a section head (label and the "<n> kinds" chip) over Grammar's table, one row per call kind in
 * the order of its first call, at most seven columns; the secondary numbers (cache, reasoning, slowest, max try) are 12 muted lines
 * under the main ones. A phone keeps the table and scrolls it sideways.
 */
export const AgentRunAiCalls = (props: AgentRunAiCallsProps) => {
    const { copy } = props
    const columns: ReadonlyArray<DataTableColumn<AiCallRow>> = [
        { id: "purpose", label: copy.purpose, isRowHeader: true, width: "fill", minWidth: 160 },
        { id: "calls", label: copy.calls, isNumeric: true },
        { id: "prompt", label: copy.prompt, isNumeric: true },
        { id: "completion", label: copy.completion, isNumeric: true },
        { id: "time", label: copy.time, isNumeric: true },
        { id: "cost", label: copy.cost, isNumeric: true },
        { id: "model", label: copy.model, width: "fit" },
    ]
    return (
        <Section title={copy.title} fact={copy.kinds} headingLevel={2}>
            <DataTable
                label={copy.title}
                columns={columns}
                rows={props.rows.map((view) => ({ id: view.id, view }))}
                renderCell={(row, columnId) => cellOf(row.view, columnId)}
                phone="table"
                emptyContent={<EmptyNotice message={copy.empty} />}
            />
        </Section>
    )
}
