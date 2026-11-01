import { FormGrid, NumberField, Select } from "@starci/grammar/common"
import { selected } from "./rowProps"
import type { AskFieldsProps } from "./rowProps"

/** Who is asked, how long they have and what happens when nobody answers. */
export const AskFields = (props: AskFieldsProps) => {
    const { row, view } = props
    const set = (field: "approverId" | "timeoutHours" | "onTimeout" | "backupId", value: string | number) =>
        props.onChange({ kind: "setRow", row: row.index, field, value })
    return (
        <FormGrid columns={1}>
            <Select
                label={view.labels.approver}
                options={row.approverOptions.map((option) => ({ id: option.value, label: option.label }))}
                value={selected(row.approverId)}
                errorMessage={row.approverError === "" ? undefined : row.approverError}
                isSkeleton={props.isSkeleton}
                onValueChange={(value) => set("approverId", value ?? "")}
            />
            <NumberField
                label={view.labels.hours}
                value={row.timeoutHours}
                minValue={1}
                isSkeleton={props.isSkeleton}
                onValueChange={(value) => {
                    if (!Number.isNaN(value)) set("timeoutHours", value)
                }}
            />
            <Select
                label={view.labels.onTimeout}
                options={view.timeoutOptions.map((option) => ({ id: option.value, label: option.label }))}
                value={row.onTimeout}
                isSkeleton={props.isSkeleton}
                onValueChange={(value) => set("onTimeout", value ?? "unset")}
            />
            {row.onTimeout === "backup" ? (
                <Select
                    label={view.labels.backup}
                    options={view.memberOptions.map((option) => ({ id: option.value, label: option.label }))}
                    value={selected(row.backupId)}
                    errorMessage={row.backupError === "" ? undefined : row.backupError}
                    isSkeleton={props.isSkeleton}
                    onValueChange={(value) => set("backupId", value ?? "")}
                />
            ) : null}
        </FormGrid>
    )
}
