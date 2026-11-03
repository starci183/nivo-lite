import { EmptyNotice, SurfaceCard, type ListRowData } from "@starci/grammar/common"

/** What the card of inventory rows draws: its heading, the rows and the notice when there are none. */
interface InventoryRowListProps {
    readonly isLoading: boolean
    readonly label: string
    readonly emptyTitle: string
    readonly emptyBody: string
    readonly items: ReadonlyArray<ListRowData>
}

/** A surface card listing inventory rows, with the empty notice of the tab when no row is there. */
export const InventoryRowList = (props: InventoryRowListProps) => (
    <SurfaceCard
        isLoading={props.isLoading}
        kind="list"
        label={props.label}
        empty={<EmptyNotice message={props.emptyTitle} description={props.emptyBody} />}
        items={[...props.items]}
    />
)
