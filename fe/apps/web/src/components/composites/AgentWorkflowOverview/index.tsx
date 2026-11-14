import {
    DataTable,
    EmptyNotice,
    Section,
    Stack,
    Text,
    type DataTableColumn,
    type DataTableRow,
    type SectionRow,
} from "@starci/grammar/common"
import { nivoIconSource } from "@/components/leaves/Icon"
import { WorkflowChips } from "@/components/leaves/WorkflowChips"
import type { WorkflowInputView, WorkflowOverviewRowView, WorkflowOverviewView } from "@/modules/types"
import { CallCard } from "./callCard"

/** The words of the overview sections. */
export interface AgentWorkflowOverviewCopy {
    readonly startTitle: string
    readonly startEmpty: string
    readonly startNote: string
    readonly inputsTitle: string
    readonly inputsEmpty: string
    readonly inputName: string
    readonly inputRequired: string
    readonly yes: string
    readonly entryLine: (entry: string) => string
    readonly endTitle: string
    readonly endEmpty: string
    readonly callTitle: (target: string) => string
    readonly callParam: string
    readonly callValue: string
    readonly callFrom: string
}

/** What the overview draws. */
interface AgentWorkflowOverviewProps {
    readonly props: {
        readonly copy: AgentWorkflowOverviewCopy
        readonly view: WorkflowOverviewView
        readonly isLoading: boolean
    }
}

/** What one section of the overview needs: the words, its rows and whether the read is under way. */
interface PartProps<Rows> {
    readonly copy: AgentWorkflowOverviewCopy
    readonly rows: Rows
    readonly isLoading: boolean
}

const emptyOf = (message: string) => (
    <EmptyNotice message={message} iconSource={nivoIconSource("overview", "leading")} />
)

/** A row of a list section: its title and line, its chips under them, a note at the end of the row. */
const listRowOf = (row: WorkflowOverviewRowView): SectionRow => ({
    id: row.id,
    title: row.title,
    ...(row.line === "" ? {} : { description: row.line }),
    ...(row.chips.length === 0 && row.end === ""
        ? {}
        : {
              detail: (
                  <Stack gap="identity">
                      {row.chips.length === 0 ? null : <WorkflowChips chips={row.chips} />}
                      {row.end === "" ? null : (
                          <Text size="xs" tone="muted">
                              {row.end}
                          </Text>
                      )}
                  </Stack>
              ),
          }),
})

/** What starts the workflow: one row per source, with its conditions and the params it supplies. */
const Triggers = (props: PartProps<WorkflowOverviewView["triggers"]>) => (
    <Section
        kind="list"
        title={props.copy.startTitle}
        headingLevel={2}
        count={props.rows.length}
        caption={props.copy.startNote}
        isLoading={props.isLoading}
        empty={emptyOf(props.copy.startEmpty)}
        items={props.rows.map((row) => listRowOf(row))}
    />
)

/** One row of the inputs table: a param the workflow needs. */
interface InputRow extends DataTableRow {
    readonly input: WorkflowInputView
}

/** What the inputs section needs besides its rows: who may call the workflow. */
interface InputsProps extends PartProps<WorkflowOverviewView["inputs"]> {
    readonly entry: string
}

/** What one cell of an input row draws. */
const inputCellOf = (input: WorkflowInputView, columnId: string, required: string) => {
    if (columnId === "name") return <Text>{input.label}</Text>
    return input.isRequired ? <Text tone="muted">{required}</Text> : null
}

/** The input the workflow needs as a table, and under it who may call the workflow. */
const Inputs = (props: InputsProps) => {
    const { copy } = props
    const columns: ReadonlyArray<DataTableColumn<InputRow>> = [
        { id: "name", label: copy.inputName, isRowHeader: true },
        { id: "required", label: copy.inputRequired, width: "fit" },
    ]
    const rows: ReadonlyArray<InputRow> = props.rows.map((input) => ({ id: input.name, input }))
    return (
        <Section
            title={copy.inputsTitle}
            headingLevel={2}
            count={props.rows.length}
            caption={copy.entryLine(props.entry)}
            isLoading={props.isLoading}
        >
            <DataTable
                label={copy.inputsTitle}
                columns={columns}
                rows={rows}
                renderCell={(row, columnId) => inputCellOf(row.input, columnId, copy.yes)}
                isLoading={props.isLoading}
                emptyContent={emptyOf(copy.inputsEmpty)}
            />
        </Section>
    )
}

/** What the workflow ends with, each outcome with its outputs and the workflow it calls next. */
const Outcomes = (props: PartProps<WorkflowOverviewView["outcomes"]>) => (
    <Section
        kind="list"
        title={props.copy.endTitle}
        headingLevel={2}
        count={props.rows.length}
        isLoading={props.isLoading}
        empty={emptyOf(props.copy.endEmpty)}
        items={props.rows.map((row) => listRowOf(row))}
    />
)

/**
 * The overview of a workflow ("In and Out"), one section per question, each with its head and count: what starts it, the input it
 * needs and who may call it, what it ends with, and which workflow each hand-off calls with the params it hands over (and where each
 * comes from). A lone table or list is its own surface, so no card wraps it.
 */
export const AgentWorkflowOverview = (props: AgentWorkflowOverviewProps) => {
    const { copy, view, isLoading } = props.props
    return (
        <Stack gap="section">
            <Triggers copy={copy} rows={view.triggers} isLoading={isLoading} />
            <Inputs copy={copy} rows={view.inputs} entry={view.entry} isLoading={isLoading} />
            <Outcomes copy={copy} rows={view.outcomes} isLoading={isLoading} />
            {view.calls.map((call) => (
                <CallCard key={call.id} copy={copy} call={call} isLoading={isLoading} />
            ))}
        </Stack>
    )
}
