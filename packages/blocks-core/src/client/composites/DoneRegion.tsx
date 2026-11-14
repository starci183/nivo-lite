import type { ReactNode } from "react"
import { EmptyNotice, Link, SurfaceCard } from "@starci/grammar/common"
import { countChipOf } from "../../rows/count-chip"
import type { ItemsRegionView } from "../../views/views.types"

/** Copy and view of the done region while the data is read. */
interface DoneRegionProps {
    readonly label: string
    readonly emptyMessage: string
    readonly view: ItemsRegionView
    readonly isLoading: boolean
}

/** How much the agent finished within the rules the owner set, and the last few items. */
export const DoneRegion = (props: DoneRegionProps): ReactNode => (
    <SurfaceCard
        kind="list"
        label={props.label}
        isLoading={props.isLoading}
        {...countChipOf(props.view.count)}
        labelEnd={
            <Link variant="head" href={props.view.linkHref}>
                {props.view.linkLabel}
            </Link>
        }
        items={props.view.rows.map((row) => ({
            id: row.id,
            title: row.title,
            description: row.description,
            href: row.href,
        }))}
        empty={<EmptyNotice message={props.emptyMessage} />}
    />
)
