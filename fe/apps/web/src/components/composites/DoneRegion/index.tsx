import { Badge, EmptyNotice, ListRow, SurfaceListCard, TextAction } from "@starci/grammar/common"
import { RegionState } from "@/components/branches/RegionState"
import type { RegionFailure } from "@/components/branches/RegionState"
import { LABEL_END_CLASS_NAME } from "./classNames"

/** What the done region shows once read. */
interface DoneView {
    readonly count: string
    readonly logLabel: string
    readonly logHref: string
    readonly rows: ReadonlyArray<{
        readonly id: string
        readonly title: string
        readonly description: string
        readonly href: string
    }>
    readonly emptyMessage: string
    readonly emptyDescription: string
}

/** Copy and state of the done region. */
export interface DoneRegionProps {
    readonly label: string
    readonly isLoading: boolean
    readonly isFailed: boolean
    readonly view: DoneView
    readonly failure: RegionFailure
    readonly onRetry: () => void
}

/** How much the agent finished within the owner's rules, and the last few items. */
export const DoneRegion = (props: DoneRegionProps) => (
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
                    <div className={LABEL_END_CLASS_NAME}>
                        <Badge tone="success" isDot>
                            {view.count}
                        </Badge>
                        <TextAction size="sm" href={view.logHref}>
                            {view.logLabel}
                        </TextAction>
                    </div>
                }
                empty={<EmptyNotice message={view.emptyMessage} description={view.emptyDescription} />}
            >
                {view.rows.map((row) => (
                    <ListRow
                        key={row.id}
                        title={
                            <TextAction appearance="plain" href={row.href}>
                                {row.title}
                            </TextAction>
                        }
                        description={row.description}
                    />
                ))}
            </SurfaceListCard>
        )}
    </RegionState>
)
