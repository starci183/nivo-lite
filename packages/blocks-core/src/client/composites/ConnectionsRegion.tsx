import type { ReactNode } from "react"
import { EmptyNotice, Link, Section, SurfaceCard } from "@starci/grammar/common"
import type { ListRowData } from "@starci/grammar/common"
import { logoOf } from "../../rows/provider-logos"
import type { ConnectionRow, ConnectionsRegionView } from "../../views/views.types"

/** Copy and view of the connections region; first-load geometry is the same card as its settled view. */
interface ConnectionsRegionProps {
    readonly label: string
    readonly emptyMessage: string
    readonly view: ConnectionsRegionView
    readonly isLoading: boolean
    /** Whether the region stands in a surface that already holds it: a section, not a card. */
    readonly isSection?: boolean
}

/** The leading mark of a row: the logo of its provider, else the initials of its name. */
const leadingOf = (row: ConnectionRow): NonNullable<ListRowData["leading"]> => {
    const src = logoOf(row.provider)
    return { avatar: { name: row.name, ...(src === undefined ? {} : { src }) } }
}

/** The row of one connection: a granted one with its state and level, an account not granted yet with the command that grants it. */
const rowOf = (row: ConnectionRow, grantHref: string): ListRowData => ({
    id: row.id,
    title: row.name,
    description: row.description,
    leading: leadingOf(row),
    ...(row.isGranted === false
        ? { action: { label: row.actionLabel ?? "", href: grantHref } }
        : {
              badges: [
                  { label: row.statusLabel, tone: row.statusTone, isDot: true },
                  { label: row.accessLabel, tone: "neutral" },
              ],
          }),
})

/** The connections bound to an agent, their status and what the agent may do through each, then the accounts it could be given. */
export const ConnectionsRegion = (props: ConnectionsRegionProps): ReactNode => {
    const items = props.view.rows.map((row) => rowOf(row, props.view.manageHref))
    const empty = <EmptyNotice message={props.emptyMessage} />
    const link = (
        <Link variant="head" href={props.view.manageHref} isDisabled={props.isLoading}>
            {props.view.manageLabel}
        </Link>
    )
    if (props.isSection === true)
        return (
            <Section
                kind="list"
                title={props.label}
                headingLevel={3}
                action={link}
                isLoading={props.isLoading}
                items={items}
                empty={empty}
            />
        )
    return (
        <SurfaceCard
            kind="list"
            label={props.label}
            isLoading={props.isLoading}
            empty={empty}
            items={items}
            labelEnd={link}
        />
    )
}
