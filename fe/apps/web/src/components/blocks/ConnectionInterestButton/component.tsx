import { Alert, Button } from "@starci/grammar/common"
import { connectionInterestButtonClassNames as classNames } from "./classNames"

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
export const ConnectionInterestButtonBase = (props: ConnectionInterestButtonBaseProps) => (
    <div className={classNames.stack}>
        <div>
            <Button
                variant="primary"
                isDisabled={props.props.isDisabled}
                isPending={props.props.isPending}
                onPress={props.on.press}
            >
                {props.props.label}
            </Button>
        </div>
        {props.props.note === undefined ? null : <Alert tone="informative" title={props.props.note} />}
    </div>
)
