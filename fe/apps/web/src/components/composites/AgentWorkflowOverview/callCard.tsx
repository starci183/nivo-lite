import { DataTable, EmptyNotice, Section, Text, type DataTableColumn, type DataTableRow } from "@starci/grammar/common"
import { nivoIconSource } from "@/components/leaves/Icon"
import { WorkflowChips } from "@/components/leaves/WorkflowChips"
import type { WorkflowCallParamView, WorkflowCallView } from "@/modules/types"

/** The words of a hand-off section. */
interface CallCardCopy {
    readonly callTitle: (target: string) => string
    readonly callParam: string
    readonly callValue: string
    readonly callFrom: string
    readonly endEmpty: string
}

/** What one hand-off section draws: the call, its words and whether the read is under way. */
interface CallCardProps {
    readonly copy: CallCardCopy
    readonly call: WorkflowCallView
    readonly isLoading: boolean
}

/** One row of the table: a param the call hands over. */
interface ParamRow extends DataTableRow {
    readonly param: WorkflowCallParamView
}

/** What one cell of a param row draws: its name, its value as a chip (pink when bound) or where it is taken from. */
const cellOf = (param: WorkflowCallParamView, columnId: string) => {
    if (columnId === "name") return <Text>{param.name}</Text>
    if (columnId === "value") return <WorkflowChips chips={[param.chip]} />
    return <Text tone="muted">{param.source}</Text>
}

/** One hand-off: the workflow it calls and its version in the head, then the params it hands over and where each comes from. */
export const CallCard = (props: CallCardProps) => {
    const { copy, call } = props
    const columns: ReadonlyArray<DataTableColumn<ParamRow>> = [
        { id: "name", label: copy.callParam, isRowHeader: true },
        { id: "value", label: copy.callValue },
        { id: "from", label: copy.callFrom },
    ]
    const rows: ReadonlyArray<ParamRow> = call.params.map((param) => ({ id: param.name, param }))
    return (
        <Section title={copy.callTitle(call.target)} fact={call.version} headingLevel={2} isLoading={props.isLoading}>
            <DataTable
                label={copy.callTitle(call.target)}
                columns={columns}
                rows={rows}
                renderCell={(row, columnId) => cellOf(row.param, columnId)}
                isLoading={props.isLoading}
                emptyContent={
                    <EmptyNotice message={copy.endEmpty} iconSource={nivoIconSource("overview", "leading")} />
                }
            />
        </Section>
    )
}
