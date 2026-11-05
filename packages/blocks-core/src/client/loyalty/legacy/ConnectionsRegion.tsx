// legacy: delete when Loyalty becomes a JSON module
import type { ReactNode } from "react"
import type { WorkbenchConnectionsRegionView as ConnectionsView } from "@nivo-lite/agent-sdk/workbench/view"
import { EmptyNotice, Link, SurfaceCard } from "@starci/grammar/common"
import type { ListRowData } from "@starci/grammar/common"
/** Copy and view of the connections region; first-load geometry is the same card as its settled view. */
interface ConnectionsRegionProps {
    readonly label: string
    readonly view: ConnectionsView
    readonly isLoading: boolean
}
/** The connections bound to an agent, their status and what the agent may do through each. */
export const ConnectionsRegion = (props: ConnectionsRegionProps): ReactNode =>
    props.view.rows.length === 0 && !props.isLoading ? null : (
        <SurfaceCard
            kind="list"
            label={props.label}
            isLoading={props.isLoading}
            empty={<EmptyNotice message={props.view.emptyMessage} description={props.view.emptyDescription} />}
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
