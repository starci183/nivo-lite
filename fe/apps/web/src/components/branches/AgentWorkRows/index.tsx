import { EmptyNotice, SurfaceCard, type ListRowData } from "@starci/grammar/common"
import type { ReactNode } from "react"
import { nivoIconSource, type IconName } from "@/components/leaves/Icon"

/** One row of a list of the Work tab: a title, the facts of its supporting line, and the parts Grammar's row draws at its end. */
interface AgentWorkRow {
    readonly id: string
    readonly title: string
    /** The facts of the supporting line; an empty one is left out. */
    readonly facts: ReadonlyArray<string>
    readonly badges?: ListRowData["badges"]
    readonly action?: ListRowData["action"]
    readonly menu?: ListRowData["menu"]
    readonly control?: ReactNode
}

/** The command that opens an add form in place. */
interface AgentWorkAdd {
    readonly label: string
    readonly onPress: () => void
}

/** The rows of one list of the Work tab and the one muted line for when it is empty. */
interface AgentWorkRowsProps {
    readonly words: { readonly label: string; readonly emptyMessage: string }
    /** The mark of the empty notice. */
    readonly emptyIcon: IconName
    readonly rows: ReadonlyArray<AgentWorkRow>
    readonly isLoading: boolean
    /** The command in the foot of the card that opens the add form; none for a list nobody adds to. */
    readonly add?: AgentWorkAdd
    /** What stands under the rows inside the card (the add form, or the line saying who may add); none when nothing is open. */
    readonly footer?: ReactNode
}

/** The foot of the card: the open form or note, else the add command. */
const footersOf = (props: AgentWorkRowsProps): NonNullable<React.ComponentProps<typeof SurfaceCard>["footers"]> => {
    if (props.footer !== undefined && props.footer !== null) return [{ kind: "custom", children: props.footer }]
    return props.add === undefined ? [] : [{ kind: "more", label: props.add.label, press: props.add.onPress }]
}

/** One row as the row data Grammar draws. */
const rowOf = (row: AgentWorkRow): ListRowData => ({
    id: row.id,
    title: row.title,
    description: row.facts.filter((fact) => fact !== "").join(" · "),
    ...(row.badges === undefined ? {} : { badges: row.badges }),
    ...(row.action === undefined ? {} : { action: row.action }),
    ...(row.menu === undefined ? {} : { menu: row.menu }),
    ...(row.control === undefined ? {} : { control: row.control }),
})

/** Draws one list of the Work tab (tasks, triggers) as a white card: its rows, or one notice saying it is empty. */
export const AgentWorkRows = (props: AgentWorkRowsProps) => (
    <SurfaceCard
        kind="list"
        label={props.words.label}
        isLoading={props.isLoading}
        footers={footersOf(props)}
        empty={<EmptyNotice message={props.words.emptyMessage} iconSource={nivoIconSource(props.emptyIcon, "leading")} />}
        items={props.rows.map((entry) => rowOf(entry))}
    />
)
