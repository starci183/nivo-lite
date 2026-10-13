import { Badge, Button, ListItem, Text, TextAction } from "@starci/grammar/common"
import type { BadgeTone } from "@starci/grammar/common"
import { ACTIONS_CLASS, MAIN_CLASS, ROW_CLASS, TOP_CLASS } from "./classNames"

/** One badge of a row. */
type BadgeView = { readonly text: string; readonly tone: BadgeTone }

/** One quick action of a row. */
type RowActionView = {
    readonly id: string
    readonly label: string
    readonly variant: "primary" | "outline" | "danger-soft"
}

/** One booking as the agenda draws it, already in the reader's words. */
export type BookingAgendaRowView = {
    readonly id: string
    readonly time: string
    readonly status: BadgeView
    readonly flags: ReadonlyArray<BadgeView>
    readonly who: string
    readonly where: string
    readonly actions: ReadonlyArray<RowActionView>
}

/** What a booking row draws and reports. */
type BookingAgendaRowProps = {
    readonly row: BookingAgendaRowView
    readonly isPending: boolean
    readonly onOpen: (id: string) => void
    readonly onAction: (id: string, action: string) => void
}

/** A row of the agenda: the time that opens the booking, its status and flags, who it is for, and its quick actions. */
export const BookingAgendaRow = (props: BookingAgendaRowProps) => (
    <ListItem className={ROW_CLASS}>
        <div className={MAIN_CLASS}>
            <div className={TOP_CLASS}>
                <TextAction onPress={() => props.onOpen(props.row.id)}>{props.row.time}</TextAction>
                <Badge tone={props.row.status.tone} isDot>
                    {props.row.status.text}
                </Badge>
                {props.row.flags.map((flag) => (
                    <Badge key={flag.text} tone={flag.tone}>
                        {flag.text}
                    </Badge>
                ))}
            </div>
            <Text size="sm" overflow="truncate">
                {props.row.who}
            </Text>
            <Text size="xs" tone="muted" overflow="truncate">
                {props.row.where}
            </Text>
        </div>
        {props.row.actions.length === 0 ? null : (
            <div className={ACTIONS_CLASS}>
                {props.row.actions.map((action) => (
                    <Button
                        key={action.id}
                        size="sm"
                        variant={action.variant}
                        isDisabled={props.isPending}
                        onPress={() => props.onAction(props.row.id, action.id)}
                    >
                        {action.label}
                    </Button>
                ))}
            </div>
        )}
    </ListItem>
)
