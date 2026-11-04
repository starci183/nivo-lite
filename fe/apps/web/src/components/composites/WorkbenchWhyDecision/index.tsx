import { Button } from "@starci/grammar/common"
import type { WorkbenchRowData } from "@/modules/types"

/** The row whose decision is explained, and the command that runs one of its commands by id. */
interface WorkbenchWhyDecisionProps {
    /** The explained decision's row; undefined while it is not among the rows waiting (already decided, or the read is not in). */
    readonly row: WorkbenchRowData | undefined
    readonly onCommand: (rowId: string, commandId: string) => void
}

/**
 * The decision in the footer of the explanation, with the same words as the row: the named command as the one commit, then the
 * edit and the rest as neutral buttons. A row that is not waiting (or one the viewer may not decide) draws none.
 */
export const WorkbenchWhyDecision = (props: WorkbenchWhyDecisionProps) => {
    const row = props.row
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
