import { Button, Text } from "@starci/grammar/common"
import { FOOTER_CLASS_NAME } from "./classNames"

/** What the footer of a drawer says and calls. */
type DrawerFooterProps = {
    readonly cancelLabel: string
    readonly submitLabel: string
    /** The command is running: the cancel waits and the action shows it is working. */
    readonly isPending: boolean
    /** Why the main action is off, in words beside it; empty when it is on. */
    readonly submitBlocked?: string | undefined
    readonly onCancel: () => void
    readonly onSubmit: () => void
}

/** The cancel and the main action at the foot of a drawer. */
export const DrawerFooter = (props: DrawerFooterProps) => (
    <div className={FOOTER_CLASS_NAME}>
        {props.submitBlocked === undefined || props.submitBlocked === "" ? null : (
            <Text size="xs" tone="muted">
                {props.submitBlocked}
            </Text>
        )}
        <Button intent="neutral" isDisabled={props.isPending} onPress={props.onCancel}>
            {props.cancelLabel}
        </Button>
        <Button
            intent="commit"
            isPending={props.isPending}
            isDisabled={props.submitBlocked !== undefined && props.submitBlocked !== ""}
            {...(props.submitBlocked === undefined || props.submitBlocked === ""
                ? {}
                : { disabledReason: props.submitBlocked })}
            onPress={props.onSubmit}
        >
            {props.submitLabel}
        </Button>
    </div>
)
