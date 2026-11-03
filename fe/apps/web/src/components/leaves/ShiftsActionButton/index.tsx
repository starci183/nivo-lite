import { Button } from "@starci/grammar/common"

/** The label, look and command of one button of the shifts screens; every flag may be absent while the screen waits. */
export interface ShiftsActionButtonProps {
    readonly label: string
    readonly intent: "commit" | "neutral" | "alternative"
    readonly size?: "sm" | undefined
    readonly isPending?: boolean | undefined
    readonly isDisabled?: boolean | undefined
    /** Absent while the commands are not there yet. */
    readonly onPress?: (() => void) | undefined
    readonly isLoading?: boolean | undefined
}

/** Draws one button of the shifts screens, handing the flags it was given to the grammar button. */
export const ShiftsActionButton = (props: ShiftsActionButtonProps) => (
    <Button
        intent={props.intent}
        {...(props.size === undefined ? {} : { size: props.size })}
        {...(props.isPending === undefined ? {} : { isPending: props.isPending })}
        {...(props.isDisabled === undefined ? {} : { isDisabled: props.isDisabled })}
        {...(props.onPress === undefined ? {} : { onPress: props.onPress })}
        {...(props.isLoading === undefined ? {} : { isLoading: props.isLoading })}
    >
        {props.label}
    </Button>
)
