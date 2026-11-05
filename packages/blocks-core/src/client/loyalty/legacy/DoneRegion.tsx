// legacy: delete when Loyalty becomes a JSON module
import type { ReactNode } from "react"
import type { WorkbenchDoneRegionView as DoneView } from "@nivo-lite/agent-sdk/workbench/view"
import { Badge, Cluster, EmptyNotice, Link, SurfaceCard } from "@starci/grammar/common"
/** Copy and view of the done region while the data is read. */
interface DoneRegionProps {
    readonly label: string
    readonly view: DoneView
    readonly isLoading: boolean
}
/** How much the agent finished within the rules the owner set, and the last few items. */
export const DoneRegion = (props: DoneRegionProps): ReactNode => (
    <SurfaceCard
        kind="list"
        label={props.label}
        isLoading={props.isLoading}
        labelEnd={
            <Cluster gap="row">
                <Badge tone="success" isDot isLoading={props.isLoading}>
                    {props.view.count}
                </Badge>
                <Link href={props.view.logHref}>{props.view.logLabel}</Link>
            </Cluster>
        }
        items={props.view.rows.map((row) => ({
            id: row.id,
            title: row.title,
            description: row.description,
            action: { label: row.title, href: row.href },
        }))}
        empty={<EmptyNotice message={props.view.emptyMessage} description={props.view.emptyDescription} />}
    />
)
