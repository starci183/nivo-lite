import { Alert, Button, Stack } from "@starci/grammar/common"

/** The "I want it" command of a planned connector and what it answered. */
export interface ConnectionInterestButtonBaseProps {
    readonly props: {
        readonly label: string
        readonly isDisabled: boolean
        readonly isPending: boolean
        /** The sentence the last press produced (thanks, or why it failed); absent before the first press. */
        readonly note?: string
    }
    readonly on: {
        readonly press: () => void
    }
}

/** A primary button, and under it the answer once there is one. */
export const ConnectionInterestButtonBase = (props: ConnectionInterestButtonBaseProps) => {
    const { props: command, on } = props

    return (
        <Stack gap="section">
            <div>
                <Button
                    intent="commit"
                    isDisabled={command.isDisabled}
                    isPending={command.isPending}
                    onPress={on.press}
                >
                    {command.label}
                </Button>
            </div>
            {command.note === undefined ? null : <Alert tone="informative" title={command.note} />}
        </Stack>
    )
}
