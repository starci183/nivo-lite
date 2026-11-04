import { Button } from "@starci/grammar/common"
import type { DataSlot, WorkbenchRowData } from "@/modules/types"

/** The waiting rows, the work item whose decision is explained, and the command that runs one of a row's commands by id. */
interface WorkbenchWhyDecisionProps {
    readonly slot: DataSlot<ReadonlyArray<WorkbenchRowData>>
    readonly workItemId: string | null
    readonly onCommand: (rowId: string, commandId: string) => void
}

/**
 * The decision in the footer of the explanation, with the same words as the row: the named command as the one commit, then the
 * edit and the rest as neutral buttons. A row that is not waiting (already decided, or the read is not in) or one the viewer may not
 * decide draws none.
 */
export const WorkbenchWhyDecision = (props: WorkbenchWhyDecisionProps) => {
    const row = "items" in props.slot ? props.slot.items.find((item) => item.id === props.workItemId) : undefined
    if (row?.primary == null) return null
    const primary = row.primary
    const others = [...(row.edit === null ? [] : [row.edit]), ...row.menu]
    return (
        <>
            <Button
                intent="commit"
                isPending={primary.isPending === true}
                isDisabled={primary.isDisabled === true}
                {...(primary.disabledReason === undefined ? {} : { disabledReason: primary.disabledReason })}
                onPress={() => props.onCommand(row.id, primary.id)}
            >
                {primary.label}
            </Button>
            {others.map((command) => (
                <Button
                    key={command.id}
                    intent="neutral"
                    isDisabled={command.isDisabled === true}
                    onPress={() => props.onCommand(row.id, command.id)}
                >
                    {command.label}
                </Button>
            ))}
        </>
    )
}
