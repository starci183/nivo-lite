import type { ReactNode } from "react"
import { EmptyNotice, Section } from "@starci/grammar/common"
import type { BadgeData, ListRowData } from "@starci/grammar/common"
import type { RowActionLook } from "../../rows/row-actions"
import type { RecordRow } from "../../rows/rows"

/** The pill a row draws under its text: its words and look, and what pressing it does. */
export interface RowCommand {
    readonly label: string
    readonly look: RowActionLook
    readonly press: () => void
}

/** What the card list takes. */
interface RecordCardListProps {
    /** The heading of the list, which also names it. */
    readonly title: string
    readonly rows: ReadonlyArray<RecordRow>
    /** What the list says when it has no row. */
    readonly empty: string
    readonly isLoading: boolean
    /** Each row starts with the initials of its title. */
    readonly hasAvatar: boolean
    /** The command a row offers under its text; null when the row has none the viewer may run. */
    readonly commandOf: (row: RecordRow) => RowCommand | null
}

/** The marks of a row: its badge with a status dot and the tone of its value, then its first further chip. */
const badgesOf = (row: RecordRow): { readonly badges?: readonly [BadgeData] | readonly [BadgeData, BadgeData] } => {
    const chip = row.chips[0]
    if (row.badge === "") return chip === undefined ? {} : { badges: [{ label: chip, tone: "neutral" }] }
    const status: BadgeData = { label: row.badge, tone: row.tone, isDot: true }
    return chip === undefined ? { badges: [status] } : { badges: [status, { label: chip, tone: "neutral" }] }
}

/** The row the Grammar list draws for one record. */
const rowOf = (row: RecordRow, props: RecordCardListProps): ListRowData => {
    const command = props.commandOf(row)
    return {
        id: row.id,
        title: row.title,
        ...(row.description === "" ? {} : { description: row.description }),
        ...(props.hasAvatar ? { leading: { avatar: { name: row.title } } } : {}),
        ...(row.meta === "" ? {} : { meta: { text: row.meta } }),
        ...badgesOf(row),
        ...(command === null ? {} : { action: { label: command.label, intent: command.look, press: command.press } }),
    }
}

/** Bound records as rows under one heading, with no surface of their own, and an action under the text of each. */
export const RecordCardList = (props: RecordCardListProps): ReactNode => (
    <Section
        kind="list"
        title={props.title}
        headingLevel={3}
        isLoading={props.isLoading}
        items={props.rows.map((row) => rowOf(row, props))}
        empty={<EmptyNotice message={props.empty} />}
    />
)
