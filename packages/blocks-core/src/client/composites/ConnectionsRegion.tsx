import type { ReactNode } from "react"
import { EmptyNotice, Link, Section, SurfaceCard } from "@starci/grammar/common"
import type { ListRowData } from "@starci/grammar/common"
import { logoOf } from "../../rows/provider-logos"
import type { ConnectionRow, ConnectionsRegionView } from "../../views/views.types"

/** Copy and view of the providers region; first-load geometry is the same card as its settled view. */
interface ConnectionsRegionProps {
    /** The block's own heading, used while the view has none (the first load). */
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

/** The row of one attached account, read only: provider and account, and what the agent may do through it. No badge, no command. */
const rowOf = (row: ConnectionRow): ListRowData => ({
    id: row.id,
    title: row.name,
    description: row.description,
    leading: leadingOf(row),
})

/**
 * The accounts attached to an agent, read only: one row each with the abilities the agent holds on it and their mode, and one link
 * to the agent's rights, where they are changed. The words are the back end's.
 */
export const ConnectionsRegion = (props: ConnectionsRegionProps): ReactNode => {
    const items = props.view.rows.map(rowOf)
    const empty = <EmptyNotice message={props.emptyMessage} />
    const label = props.view.label === "" ? props.label : props.view.label
    const link = (
        <Link variant="head" href={props.view.rightsHref} isDisabled={props.isLoading}>
            {props.view.rightsLabel}
        </Link>
    )
    if (props.isSection === true)
        return (
            <Section
                kind="list"
                title={label}
                headingLevel={3}
                action={link}
                isLoading={props.isLoading}
                items={items}
                empty={empty}
            />
        )
    return (
        <SurfaceCard kind="list" label={label} isLoading={props.isLoading} empty={empty} items={items} labelEnd={link} />
    )
}
