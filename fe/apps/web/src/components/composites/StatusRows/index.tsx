import { Badge, ListRow } from "@starci/grammar/common"
import type { BadgeTone } from "@starci/grammar/common"
import type { ReactNode } from "react"

/** One row of a status list: a title, a note under it and the state badge. */
type StatusRow = {
    readonly id: string
    readonly title: string
    readonly note: ReactNode
    readonly badgeLabel: string
    readonly badgeTone: BadgeTone
}

/** The rows of a status list. */
type StatusRowsProps = { readonly rows: ReadonlyArray<StatusRow>; readonly isSkeleton: boolean }

/** A list of rows that each say where something stands (a checklist step, a webhook delivery). */
export const StatusRows = (props: StatusRowsProps) => (
    <>
        {props.rows.map((row) => (
            <ListRow
                key={row.id}
                isSkeleton={props.isSkeleton}
                title={row.title}
                description={row.note}
                badges={<Badge tone={row.badgeTone}>{row.badgeLabel}</Badge>}
            />
        ))}
    </>
)
