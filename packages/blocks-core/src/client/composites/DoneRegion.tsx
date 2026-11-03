import type { ReactNode } from "react"
import { Badge, Cluster, EmptyNotice, Link, SurfaceCard } from "@starci/grammar/common"
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
        labelEnd={
            <Cluster gap="row">
                {props.view.count === null ? null : (
                    <Badge tone="success" isDot isLoading={props.isLoading}>
                        {props.view.count}
                    </Badge>
                )}
                <Link href={props.view.linkHref}>{props.view.linkLabel}</Link>
            </Cluster>
        }
        items={props.view.rows.map((row) => ({
            id: row.id,
            title: row.title,
            description: row.description,
            action: { label: row.title, href: row.href },
        }))}
        empty={<EmptyNotice message={props.emptyMessage} />}
    />
)
