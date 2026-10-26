import { Button, DateField, Checkbox, Text } from "@starci/grammar/common"
import { parseDate } from "@internationalized/date"
import { TOOLBAR_CLASS } from "./classNames"

/** The range navigation and cancellation filter supplied by the booking desk. */
interface BookingDeskNavigationProps {
    readonly props: {
        readonly prevLabel: string
        readonly nextLabel: string
        readonly thisWeekLabel: string
        readonly dateLabel: string
        readonly date: string
        readonly showCancelledLabel: string
        readonly showCancelled: boolean
        readonly rangeText: string
    }
    readonly isPending: boolean
    readonly on: {
        readonly prev: () => void
        readonly next: () => void
        readonly thisWeek: () => void
        readonly pickDate: (date: string) => void
        readonly toggleCancelled: (value: boolean) => void
    }
}

/** Draws the week controls and cancellation filter. */
export const BookingDeskNavigation = (props: BookingDeskNavigationProps) => (
    <div className={TOOLBAR_CLASS}>
        <Button size="sm" intent="neutral" isDisabled={props.isPending} onPress={props.on.prev}>
            {props.props.prevLabel}
        </Button>
        <Button size="sm" intent="neutral" isDisabled={props.isPending} onPress={props.on.thisWeek}>
            {props.props.thisWeekLabel}
        </Button>
        <Button size="sm" intent="neutral" isDisabled={props.isPending} onPress={props.on.next}>
            {props.props.nextLabel}
        </Button>
        <DateField
            label={props.props.dateLabel}
            isLabelHidden
            value={parseDate(props.props.date)}
            onValueChange={(value) => {
                if (value !== null) props.on.pickDate(value.toString())
            }}
        />
        <Checkbox
            label={props.props.showCancelledLabel}
            isSelected={props.props.showCancelled}
            onSelectedChange={props.on.toggleCancelled}
        />
        <Text as="span" size="sm" tone="muted">
            {props.props.rangeText}
        </Text>
    </div>
)
