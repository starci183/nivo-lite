import { Badge, Button, EmptyNotice, ListRow, SurfaceListCard, Text } from "@starci/grammar/common"

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

/** Copy and view of the waiting region; `isSkeleton` draws the same card with blank geometry while the data is read. */
export interface WaitingRegionProps {
    readonly label: string
    readonly view: WaitingView
    readonly isSkeleton: boolean
}

/** The decisions of a module that wait for a person, each linking to the decision. */
export const WaitingRegion = (props: WaitingRegionProps) => (
    <SurfaceListCard
        label={props.label}
        labelEnd={
            props.view.count === null ? undefined : (
                <Badge tone="warning" isDot isSkeleton={props.isSkeleton}>
                    {props.view.count}
                </Badge>
            )
        }
        empty={<EmptyNotice message={props.view.emptyMessage} description={props.view.emptyDescription} />}
        footer={
            props.view.more === null ? undefined : (
                <Text size="sm" tone="muted" isSkeleton={props.isSkeleton}>
                    {props.view.more}
                </Text>
            )
        }
    >
        {props.view.rows.map((row) => (
            <ListRow
                key={row.id}
                isSkeleton={props.isSkeleton}
                title={row.title}
                description={row.description}
                actions={
                    <Button size="sm" intent="neutral" href={row.href} isSkeleton={props.isSkeleton}>
                        {props.view.openLabel}
                    </Button>
                }
            />
        ))}
    </SurfaceListCard>
)
