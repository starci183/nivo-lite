import { Text } from "@starci/grammar/common"
import type { AgentGraphDecideEditorView, AgentGraphRowView } from "@/modules/types"

/** The resolved sentence and explanatory notes of one branch. */
interface AgentGraphRowSummaryProps {
    readonly row: Pick<AgentGraphRowView, "sentence" | "isElse" | "isLocked" | "terms">
    readonly labels: Pick<AgentGraphDecideEditorView["labels"], "elseNote" | "lockedNote" | "allTerms">
    readonly isLoading: boolean
}

/** The same ready sentence and notes, without a wrapping surface or a data read. */
export const AgentGraphRowSummary = (props: AgentGraphRowSummaryProps) => {
    const { row, labels } = props
    const notes = [
        ...(row.isElse ? [labels.elseNote] : []),
        ...(row.isLocked ? [labels.lockedNote] : []),
        ...(row.terms.length > 1 ? [labels.allTerms] : []),
    ]
    return (
        <>
            <Text size="sm" tone="muted" isLoading={props.isLoading}>
                {row.sentence}
            </Text>
            {notes.map((note) => (
                <Text key={note} size="sm" tone="muted" isLoading={props.isLoading}>
                    {note}
                </Text>
            ))}
        </>
    )
}
