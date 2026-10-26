import { Badge, Button, EmptyNotice, ListRow, SurfaceListCard, Text } from "@starci/grammar/common"
import { RegionState } from "@/components/branches/RegionState"
import type { RegionFailure } from "@/components/branches/RegionState"

/** What the waiting region shows once read. */
interface WaitingView {
    /** The count badge; null when nothing waits. */
    readonly count: string | null
    readonly rows: ReadonlyArray<{
        readonly id: string
        readonly title: string
        readonly description: string
        readonly href: string
    }>
    readonly openLabel: string
    readonly more: string | null
    readonly emptyMessage: string
    readonly emptyDescription: string
}

/** Copy and state of the waiting region. */
export interface WaitingRegionProps {
    readonly label: string
    readonly isLoading: boolean
    readonly isFailed: boolean
    readonly view: WaitingView
    readonly failure: RegionFailure
    readonly onRetry: () => void
}

/** The decisions of a module that wait for a person, each linking to the decision. */
export const WaitingRegion = (props: WaitingRegionProps) => (
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
                    view.count === null ? undefined : (
                        <Badge tone="warning" isDot>
                            {view.count}
                        </Badge>
                    )
                }
                empty={<EmptyNotice message={view.emptyMessage} description={view.emptyDescription} />}
                footer={
                    view.more === null ? undefined : (
                        <Text size="sm" tone="muted">
                            {view.more}
                        </Text>
                    )
                }
            >
                {view.rows.map((row) => (
                    <ListRow
                        key={row.id}
                        title={row.title}
                        description={row.description}
                        actions={
                            <Button size="sm" intent="neutral" href={row.href}>
                                {view.openLabel}
                            </Button>
                        }
                    />
                ))}
            </SurfaceListCard>
        )}
    </RegionState>
)
