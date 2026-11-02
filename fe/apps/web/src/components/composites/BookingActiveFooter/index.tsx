import { Button, Checkbox, Cluster } from "@starci/grammar/common"
/** What the footer of a service or resource form draws and reports. */
type BookingActiveFooterProps = {
    readonly isLoading: boolean
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
        <Checkbox
            isLoading={props.isLoading}
            label={props.activeLabel}
            isSelected={props.isActive}
            onSelectedChange={props.onToggle}
        />
        <Cluster gap="inline">
            <Button isLoading={props.isLoading} type="submit" size="sm" intent="commit" isPending={props.isPending}>
                {props.saveLabel}
            </Button>
            <Button
                isLoading={props.isLoading}
                size="sm"
                intent="neutral"
                isDisabled={props.isPending}
                onPress={props.onCancel}
            >
                {props.cancelLabel}
            </Button>
        </Cluster>
    </>
)
