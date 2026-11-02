import { NumberField, Select, Grid } from "@starci/grammar/common"
import type { AgentGraphDecideEditorView, AgentGraphFormChange, AgentGraphRowView } from "@/modules/types"
/** The resolved native approval-routing fields of one branch. */
interface AgentGraphAskFieldsProps {
    readonly row: Pick<
        AgentGraphRowView,
        | "index"
        | "approverOptions"
        | "approverId"
        | "approverError"
        | "timeoutHours"
        | "onTimeout"
        | "backupId"
        | "backupError"
    >
    readonly labels: Pick<AgentGraphDecideEditorView["labels"], "approver" | "hours" | "onTimeout" | "backup">
    readonly timeoutOptions: AgentGraphDecideEditorView["timeoutOptions"]
    readonly memberOptions: AgentGraphDecideEditorView["memberOptions"]
    readonly isLoading: boolean
    readonly onChange: (change: AgentGraphFormChange) => void
}

/** Who is asked, how long they have and what happens when nobody answers. */
export const AgentGraphAskFields = (props: AgentGraphAskFieldsProps) => {
    const { row, labels } = props
    const set = (field: "approverId" | "timeoutHours" | "onTimeout" | "backupId", value: string | number) =>
        props.onChange({ kind: "setRow", row: row.index, field, value })
    return (
        <Grid kind="form" columns={1}>
            <Select
                label={labels.approver}
                options={row.approverOptions.map((option) => ({ id: option.value, label: option.label }))}
                value={row.approverId === "" ? null : row.approverId}
                errorMessage={row.approverError === "" ? undefined : row.approverError}
                isLoading={props.isLoading}
                onValueChange={(value) => set("approverId", value ?? "")}
            />
            <NumberField
                label={labels.hours}
                value={row.timeoutHours}
                minValue={1}
                isLoading={props.isLoading}
                onValueChange={(value) => {
                    if (!Number.isNaN(value)) set("timeoutHours", value)
                }}
            />
            <Select
                label={labels.onTimeout}
                options={props.timeoutOptions.map((option) => ({ id: option.value, label: option.label }))}
                value={row.onTimeout}
                isLoading={props.isLoading}
                onValueChange={(value) => set("onTimeout", value ?? "unset")}
            />
            {row.onTimeout === "backup" ? (
                <Select
                    label={labels.backup}
                    options={props.memberOptions.map((option) => ({ id: option.value, label: option.label }))}
                    value={row.backupId === "" ? null : row.backupId}
                    errorMessage={row.backupError === "" ? undefined : row.backupError}
                    isLoading={props.isLoading}
                    onValueChange={(value) => set("backupId", value ?? "")}
                />
            ) : null}
        </Grid>
    )
}
