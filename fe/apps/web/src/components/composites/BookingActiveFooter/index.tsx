import { Button, Checkbox } from "@starci/grammar/common"
import { ACTIONS_CLASS } from "./classNames"

/** What the footer of a service or resource form draws and reports. */
type BookingActiveFooterProps = {
    readonly activeLabel: string
    readonly isActive: boolean
    readonly saveLabel: string
    readonly cancelLabel: string
    readonly isPending: boolean
    readonly onToggle: (value: boolean) => void
    readonly onCancel: () => void
}

/** The foot of a service or resource form: the switch that lets it take bookings, then save and cancel. */
export const BookingActiveFooter = (props: BookingActiveFooterProps) => (
    <>
        <Checkbox label={props.activeLabel} isSelected={props.isActive} onSelectedChange={props.onToggle} />
        <div className={ACTIONS_CLASS}>
            <Button type="submit" size="sm" intent="commit" isPending={props.isPending}>
                {props.saveLabel}
            </Button>
            <Button size="sm" intent="neutral" isDisabled={props.isPending} onPress={props.onCancel}>
                {props.cancelLabel}
            </Button>
        </div>
    </>
)
