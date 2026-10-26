import { Button } from "@starci/grammar/common"

/** What the add button of a setup list draws and reports. */
type BookingAddButtonProps = {
    readonly label: string
    readonly onPress: () => void
}

/** The button under a setup list that opens the form of a new row. */
export const BookingAddButton = (props: BookingAddButtonProps) => (
    <div>
        <Button size="sm" intent="neutral" onPress={props.onPress}>
            {props.label}
        </Button>
    </div>
)
