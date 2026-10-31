import { Button, DropdownMenu } from "@starci/grammar/common"
import type { DropdownMenuEntry } from "@starci/grammar/common"

/** The menu at the end of a row: a link to the record, and one command on the row. */
interface AgentWorkRowMenuProps {
    readonly label: string
    /** The record the row opened; none when it opened none. */
    readonly linkLabel: string
    readonly linkHref: string | null
    /** The command on the row; none for a person who may not run it. */
    readonly commandLabel: string
    readonly isDanger: boolean
    readonly onCommand: (() => void) | null
}

/** The commands of a row beyond its one visible button, in a menu; nothing when the row has none. */
export const AgentWorkRowMenu = (props: AgentWorkRowMenuProps) => {
    const link: ReadonlyArray<DropdownMenuEntry> =
        props.linkHref === null ? [] : [{ id: "open", label: props.linkLabel, href: props.linkHref }]
    const command: ReadonlyArray<DropdownMenuEntry> =
        props.onCommand === null
            ? []
            : [
                  {
                      id: "command",
                      label: props.commandLabel,
                      onAction: props.onCommand,
                      ...(props.isDanger ? { tone: "danger" } : {}),
                  },
              ]
    const entries = [...link, ...command]
    if (entries.length === 0) return null
    return (
        <DropdownMenu
            placement="bottom end"
            trigger={
                <Button intent="neutral" size="sm">
                    {props.label}
                </Button>
            }
            entries={entries}
        />
    )
}
