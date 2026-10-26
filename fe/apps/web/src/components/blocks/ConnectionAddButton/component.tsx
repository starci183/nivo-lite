import { Button } from "@starci/grammar/common"

/** A command that adds a connection of one provider. */
export interface ConnectionAddButtonBaseProps {
    readonly props: {
        readonly label: string
        readonly intent: "neutral" | "alternative"
    }
    readonly on: {
        readonly press: () => void
    }
}

/** The add or connect button. */
export const ConnectionAddButtonBase = (props: ConnectionAddButtonBaseProps) => (
    <Button intent={props.props.intent} onPress={props.on.press}>
        {props.props.label}
    </Button>
)
