import { Button } from "@starci/grammar/common"

/** The label and state of the "use a different account" button, resolved by the connected block. */
export interface SwitchAccountBaseProps {
    readonly props: { readonly label: string; readonly isPending: boolean }
    readonly on: { readonly switchAccount: () => void }
}

/** Draws the button that signs out and returns to the sign-in page. */
export const SwitchAccountBase = (props: SwitchAccountBaseProps) => (
    <Button variant="secondary" width="fill" isPending={props.props.isPending} onPress={props.on.switchAccount}>
        {props.props.label}
    </Button>
)
