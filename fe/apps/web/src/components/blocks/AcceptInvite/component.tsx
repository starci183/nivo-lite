import { Alert, Button } from "@starci/grammar/common"
import { ACCEPT_ACTIONS_CLASS_NAME } from "./classNames"

/** The words and state of the accept button, resolved by the connected block. */
export interface AcceptInviteBaseProps {
    readonly props: {
        readonly acceptLabel: string
        readonly failedTitle: string
        readonly error?: string
        readonly isPending: boolean
    }
    readonly on: { readonly accept: () => void }
}

/** Draws the "join workspace" button and the reason a join failed. */
export const AcceptInviteBase = (props: AcceptInviteBaseProps) => (
    <div className={ACCEPT_ACTIONS_CLASS_NAME}>
        {props.props.error === undefined ? null : (
            <Alert title={props.props.failedTitle} description={props.props.error} tone="negative" />
        )}
        <Button variant="primary" isPending={props.props.isPending} onPress={props.on.accept}>
            {props.props.acceptLabel}
        </Button>
    </div>
)
