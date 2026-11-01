import type {
    AgentGraphDecideEditorView,
    AgentGraphFormChange,
    AgentGraphRowView,
    AgentGraphTermView,
} from "@/modules/types"

/** What the editor of one row needs: the view of the whole editor, the row, and the command that changes it. */
export interface RowProps {
    readonly view: AgentGraphDecideEditorView
    readonly row: AgentGraphRowView
    readonly isSkeleton: boolean
    readonly onChange: (change: AgentGraphFormChange) => void
}

/** One comparison of a row, and where it stands among the row's comparisons. */
export interface TermProps extends RowProps {
    readonly term: AgentGraphTermView
    readonly at: number
}

/** An empty selection is no selection. */
export const selected = (value: string): string | null => (value === "" ? null : value)

/** The props of the fields that say who is asked. */
export interface AskFieldsProps {
    readonly view: RowProps["view"]
    readonly row: RowProps["row"]
    readonly isSkeleton: boolean
    readonly onChange: RowProps["onChange"]
}

/** The props of the card of one branch. */
export interface RowCardProps {
    readonly view: RowProps["view"]
    readonly row: RowProps["row"]
    readonly isSkeleton: boolean
    readonly onChange: RowProps["onChange"]
}

/** The props of one comparison of a row. */
export interface TermRowProps {
    readonly view: RowProps["view"]
    readonly row: RowProps["row"]
    readonly isSkeleton: boolean
    readonly onChange: RowProps["onChange"]
    readonly term: TermProps["term"]
    readonly at: number
}
