import { Button } from "@starci/grammar/common"
import { FOOTER_CLASS_NAME } from "./classNames"

/** What the footer of a drawer says and calls. */
type DrawerFooterProps = {
    readonly cancelLabel: string
    readonly submitLabel: string
    /** The command is running: the cancel waits and the action shows it is working. */
    readonly isPending: boolean
    readonly onCancel: () => void
    readonly onSubmit: () => void
}

/** The cancel and the main action at the foot of a drawer. */
export const DrawerFooter = (props: DrawerFooterProps) => (
    <div className={FOOTER_CLASS_NAME}>
        <Button intent="neutral" isDisabled={props.isPending} onPress={props.onCancel}>
            {props.cancelLabel}
        </Button>
        <Button intent="commit" isPending={props.isPending} onPress={props.onSubmit}>
            {props.submitLabel}
        </Button>
    </div>
)
