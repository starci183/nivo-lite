import { Cluster, EmptyNotice, Section } from "@starci/grammar/common"
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

/** The rows of one list of the Work tab and the one muted line for when it is empty. */
interface AgentWorkRowsProps {
    readonly words: { readonly label: string; readonly emptyMessage: string }
    readonly rows: ReadonlyArray<AgentWorkRow>
    readonly isLoading: boolean
}

/** Draws one list of the Work tab (goals, tasks, triggers, turns): its rows, or one line saying it is empty. */
export const AgentWorkRows = (props: AgentWorkRowsProps) => {
    return (
        <Section
            kind="list"
            title={props.words.label}
            count={props.rows.length}
            isLoading={props.isLoading}
            empty={<EmptyNotice message={props.words.emptyMessage} />}
            items={props.rows.map((row) => ({
                id: row.id,
                title: row.title,
                description: row.facts.filter((fact) => fact !== "").join(" · "),
                detail:
                    row.badges === undefined && row.actions === undefined ? null : (
                        <Cluster gap="inline" justify="between">
                            {row.badges}
                            {row.actions}
                        </Cluster>
                    ),
            }))}
        />
    )
}
