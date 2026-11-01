import { Badge, ListRow, SurfaceListCard, TextAction } from "@starci/grammar/common"
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

/** Copy and view of the done region; `isSkeleton` draws the same card with blank geometry while the data is read. */
export interface DoneRegionProps {
    readonly label: string
    readonly view: DoneView
    readonly isSkeleton: boolean
}

/** How much the agent finished within the rules the owner set, and the last few items. */
export const DoneRegion = (props: DoneRegionProps) =>
    props.view.rows.length === 0 && !props.isSkeleton ? null : (
        <SurfaceListCard
            label={props.label}
            labelEnd={
                <div className={LABEL_END_CLASS_NAME}>
                    <Badge tone="success" isDot isSkeleton={props.isSkeleton}>
                        {props.view.count}
                    </Badge>
                    <TextAction size="sm" href={props.view.logHref} isSkeleton={props.isSkeleton}>
                        {props.view.logLabel}
                    </TextAction>
                </div>
            }
        >
            {props.view.rows.map((row) => (
                <ListRow
                    key={row.id}
                    isSkeleton={props.isSkeleton}
                    title={
                        <TextAction appearance="plain" href={row.href}>
                            {row.title}
                        </TextAction>
                    }
                    description={row.description}
                />
            ))}
        </SurfaceListCard>
    )
