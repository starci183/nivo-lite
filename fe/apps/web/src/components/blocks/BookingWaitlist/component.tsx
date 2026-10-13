import { Button, EmptyNotice, ListItem, SurfaceListCard, Text } from "@starci/grammar/common"
import { MAIN_CLASS, ROW_CLASS } from "./classNames"

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
            <ListItem key={row.id} className={ROW_CLASS}>
                <div className={MAIN_CLASS}>
                    <Text weight="semibold">{row.title}</Text>
                    <Text size="sm" tone="muted">
                        {row.detail}
                    </Text>
                </div>
                <Button
                    size="sm"
                    variant="outline"
                    isDisabled={props.props.isPending}
                    onPress={() => props.on.remove(row.id)}
                >
                    {props.props.removeLabel}
                </Button>
            </ListItem>
        ))}
    </SurfaceListCard>
)
