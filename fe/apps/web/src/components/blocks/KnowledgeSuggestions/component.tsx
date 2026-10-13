import { KnowledgeRows } from "@/components/composites/KnowledgeRows"
import type { KnowledgeRowsProps } from "@/components/composites/KnowledgeRows"

/** The lists the connected suggestions supply. */
export interface KnowledgeSuggestionsBaseProps {
    readonly props: {
        readonly list: KnowledgeRowsProps
        /** The ideas that were set aside; nothing is drawn for them while undefined. */
        readonly skipped?: KnowledgeRowsProps
    }
}

/** Draws the ideas for what to add, none of them required, and the ones that were set aside. */
export const KnowledgeSuggestionsBase = (props: KnowledgeSuggestionsBaseProps) => (
    <KnowledgeRows
        {...props.props.list}
        after={props.props.skipped === undefined ? null : <KnowledgeRows {...props.props.skipped} />}
    />
)
