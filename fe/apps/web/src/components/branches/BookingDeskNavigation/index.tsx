import { Button, DateField, Checkbox, Text, Cluster } from "@starci/grammar/common"
import { parseDate } from "@internationalized/date"

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
    readonly isLoading?: boolean
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
    <Cluster gap="inline">
        <Button
            {...(props.isLoading === undefined ? {} : { isLoading: props.isLoading })}
            size="sm"
            intent="neutral"
            isDisabled={props.isPending}
            onPress={props.on.prev}
        >
            {props.props.prevLabel}
        </Button>
        <Button
            {...(props.isLoading === undefined ? {} : { isLoading: props.isLoading })}
            size="sm"
            intent="neutral"
            isDisabled={props.isPending}
            onPress={props.on.thisWeek}
        >
            {props.props.thisWeekLabel}
        </Button>
        <Button
            {...(props.isLoading === undefined ? {} : { isLoading: props.isLoading })}
            size="sm"
            intent="neutral"
            isDisabled={props.isPending}
            onPress={props.on.next}
        >
            {props.props.nextLabel}
        </Button>
        <DateField
            isDisabled={props.isLoading === true || props.isPending}
            label={props.props.dateLabel}
            isLabelHidden
            value={parseDate(props.props.date)}
            onValueChange={(value) => {
                if (value !== null) props.on.pickDate(value.toString())
            }}
        />
        <Checkbox
            {...(props.isLoading === undefined ? {} : { isLoading: props.isLoading })}
            label={props.props.showCancelledLabel}
            isSelected={props.props.showCancelled}
            onSelectedChange={props.on.toggleCancelled}
        />
        <Text
            {...(props.isLoading === undefined ? {} : { isLoading: props.isLoading })}
            as="span"
            size="sm"
            tone="muted"
        >
            {props.props.rangeText}
        </Text>
    </Cluster>
)
