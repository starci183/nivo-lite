import type { ReactNode } from "react"
import { EmptyNotice, Link, SurfaceCard, type ListRowData } from "@starci/grammar/common"
import type { ConnectionsRegionView } from "../../views/views.types"

/** Copy and view of the connections region; first-load geometry is the same card as its settled view. */
interface ConnectionsRegionProps {
    readonly label: string
    readonly emptyMessage: string
    readonly view: ConnectionsRegionView
    readonly isLoading: boolean
}

/** The connections bound to an agent, their status and what the agent may do through each. */
export const ConnectionsRegion = (props: ConnectionsRegionProps): ReactNode => (
    <SurfaceCard
        kind="list"
        label={props.label}
        isLoading={props.isLoading}
        empty={<EmptyNotice message={props.emptyMessage} />}
        items={props.view.rows.map((row): ListRowData => ({
            id: row.id,
            title: row.name,
            description: row.description,
            badges: [
                { label: row.statusLabel, tone: row.statusTone, isDot: true },
                { label: row.accessLabel, tone: "neutral" },
            ],
        }))}
        labelEnd={
            <Link href={props.view.manageHref} isDisabled={props.isLoading}>
                {props.view.manageLabel}
            </Link>
        }
    />
)
