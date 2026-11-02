import { Button, Cluster } from "@starci/grammar/common"
import type { AgentGraphDecideEditorView, AgentGraphFormChange, AgentGraphRowView } from "@/modules/types"
/** The ready ordering/removal controls of one branch. */
interface AgentGraphRowActionsProps {
    readonly row: Pick<AgentGraphRowView, "index" | "canMoveUp" | "canMoveDown" | "canRemove">
    readonly labels: Pick<AgentGraphDecideEditorView["labels"], "moveUp" | "moveDown" | "removeRow">
    readonly isLoading: boolean
    readonly onChange: (change: AgentGraphFormChange) => void
}

/** The keys that move or drop a row. */
export const AgentGraphRowActions = (props: AgentGraphRowActionsProps) => {
    const { row, labels } = props
    return (
        <Cluster gap="inline">
            {row.canMoveUp ? (
                <Button
                    intent="neutral"
                    size="sm"
                    isLoading={props.isLoading}
                    onPress={() => props.onChange({ kind: "moveRow", row: row.index, delta: -1 })}
                >
                    {labels.moveUp}
                </Button>
            ) : null}
            {row.canMoveDown ? (
                <Button
                    intent="neutral"
                    size="sm"
                    isLoading={props.isLoading}
                    onPress={() => props.onChange({ kind: "moveRow", row: row.index, delta: 1 })}
                >
                    {labels.moveDown}
                </Button>
            ) : null}
            {row.canRemove ? (
                <Button
                    intent="destructive"
                    step="entry"
                    size="sm"
                    isLoading={props.isLoading}
                    onPress={() => props.onChange({ kind: "removeRow", row: row.index })}
                >
                    {labels.removeRow}
                </Button>
            ) : null}
        </Cluster>
    )
}
