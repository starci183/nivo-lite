import { Badge, EmptyNotice, ListRow, SurfaceListCard, TextAction } from "@starci/grammar/common"
import type { BadgeTone } from "@starci/grammar/common"
import { RegionState } from "@/components/branches/RegionState"
import type { RegionFailure } from "@/components/branches/RegionState"

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

/** Copy and state of the connections region. */
export interface ConnectionsRegionProps {
    readonly label: string
    readonly isLoading: boolean
    readonly isFailed: boolean
    readonly view: ConnectionsView
    readonly failure: RegionFailure
    readonly onRetry: () => void
}

/** The connections bound to an agent, their status and what the agent may do through each. */
export const ConnectionsRegion = (props: ConnectionsRegionProps) => (
    <RegionState
        label={props.label}
        isLoading={props.isLoading}
        isFailed={props.isFailed}
        view={props.view}
        failure={props.failure}
        onRetry={props.onRetry}
    >
        {(view) => (
            <SurfaceListCard
                label={props.label}
                labelEnd={
                    <TextAction size="sm" href={view.manageHref}>
                        {view.manageLabel}
                    </TextAction>
                }
                empty={<EmptyNotice message={view.emptyMessage} description={view.emptyDescription} />}
            >
                {view.rows.map((row) => (
                    <ListRow
                        key={row.id}
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
        )}
    </RegionState>
)
