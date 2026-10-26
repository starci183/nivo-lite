import { Button, EmptyNotice, ListRow, SurfaceListCard } from "@starci/grammar/common"

/** Props for {@link BookingWaitlistBase}. */
export interface BookingWaitlistBaseProps {
    readonly props: {
        readonly label: string
        readonly emptyTitle: string
        readonly emptyBody: string
        readonly removeLabel: string
        readonly rows: ReadonlyArray<{ readonly id: string; readonly title: string; readonly detail: string }>
        readonly isPending: boolean
    }
    readonly on: {
        readonly remove: (id: string) => void
    }
}

/** Draws the waiting list: who waits for a free time, and the button that takes them off. */
export const BookingWaitlistBase = (props: BookingWaitlistBaseProps) => (
    <SurfaceListCard
        ariaLabel={props.props.label}
        empty={<EmptyNotice message={props.props.emptyTitle} description={props.props.emptyBody} />}
    >
        {props.props.rows.map((row) => (
            <ListRow
                key={row.id}
                title={row.title}
                description={row.detail}
                actions={
                    <Button
                        size="sm"
                        intent="destructive"
                        step="entry"
                        isDisabled={props.props.isPending}
                        onPress={() => props.on.remove(row.id)}
                    >
                        {props.props.removeLabel}
                    </Button>
                }
            />
        ))}
    </SurfaceListCard>
)
