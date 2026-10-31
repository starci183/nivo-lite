import { EmptyNotice, List, ListRow } from "@starci/grammar/common"
import type { ReactNode } from "react"

/** One row of a list of the Work tab: a title, one supporting line, a badge and the commands at its end. */
interface AgentWorkRow {
    readonly id: string
    readonly title: string
    /** The facts of the supporting line; an empty one is left out. */
    readonly facts: ReadonlyArray<string>
    readonly badges?: ReactNode
    readonly actions?: ReactNode
}

/** The rows of one list of the Work tab and the notice for when it is empty. */
interface AgentWorkRowsProps {
    readonly words: { readonly label: string; readonly emptyMessage: string }
    readonly rows: ReadonlyArray<AgentWorkRow>
    readonly isSkeleton: boolean
}

/** Draws one list of the Work tab (goals, tasks, triggers, turns): its rows, or the notice that it is empty. */
export const AgentWorkRows = (props: AgentWorkRowsProps) => {
    if (props.rows.length === 0) return <EmptyNotice message={props.words.emptyMessage} />
    return (
        <List label={props.words.label}>
            {props.rows.map((row) => (
                <ListRow
                    key={row.id}
                    isSkeleton={props.isSkeleton}
                    title={row.title}
                    description={row.facts.filter((fact) => fact !== "").join(" · ")}
                    badges={row.badges}
                    actions={row.actions}
                />
            ))}
        </List>
    )
}
