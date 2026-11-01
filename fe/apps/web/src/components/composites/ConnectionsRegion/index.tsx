import { Badge, ListRow, SurfaceListCard, TextAction } from "@starci/grammar/common"
import type { BadgeTone } from "@starci/grammar/common"

/** What the connections region shows once read. */
interface ConnectionsView {
    readonly manageLabel: string
    readonly manageHref: string
    readonly rows: ReadonlyArray<{
        readonly id: string
        readonly name: string
        readonly description: string
        readonly statusLabel: string
        readonly statusTone: BadgeTone
        readonly accessLabel: string
    }>
    readonly emptyMessage: string
    readonly emptyDescription: string
}

/** Copy and view of the connections region; `isSkeleton` draws the same card with blank geometry while the data is read. */
export interface ConnectionsRegionProps {
    readonly label: string
    readonly view: ConnectionsView
    readonly isSkeleton: boolean
}

/** The connections bound to an agent, their status and what the agent may do through each. */
export const ConnectionsRegion = (props: ConnectionsRegionProps) =>
    props.view.rows.length === 0 && !props.isSkeleton ? null : (
        <SurfaceListCard
            label={props.label}
            labelEnd={
                <TextAction size="sm" href={props.view.manageHref} isSkeleton={props.isSkeleton}>
                    {props.view.manageLabel}
                </TextAction>
            }
        >
            {props.view.rows.map((row) => (
                <ListRow
                    key={row.id}
                    isSkeleton={props.isSkeleton}
                    title={row.name}
                    description={row.description}
                    badges={
                        <>
                            <Badge tone={row.statusTone} isDot>
                                {row.statusLabel}
                            </Badge>
                            <Badge tone="neutral">{row.accessLabel}</Badge>
                        </>
                    }
                />
            ))}
        </SurfaceListCard>
    )
