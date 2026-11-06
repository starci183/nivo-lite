import type { ReactNode } from "react"
import { EmptyNotice, SurfaceCard } from "@starci/grammar/common"
import type { ItemsRegionView } from "../../views/views.types"

/** Copy and view of the waiting region; `isLoading` draws the same card with blank geometry while the data is read. */
interface WaitingRegionProps {
    readonly label: string
    readonly emptyMessage: string
    readonly view: ItemsRegionView
    readonly isLoading: boolean
}

/** The items of a module that wait for a person, each linking to its subject. */
export const WaitingRegion = (props: WaitingRegionProps): ReactNode => (
    <SurfaceCard
        kind="list"
        isLoading={props.isLoading}
        label={props.view.count === null ? props.label : `${props.label} · ${props.view.count}`}
        note={props.view.more ?? undefined}
        items={props.view.rows.map((row) => ({
            id: row.id,
            title: row.title,
            description: row.description,
            action: { label: props.view.linkLabel, href: row.href },
        }))}
        empty={<EmptyNotice message={props.emptyMessage} />}
    />
)
