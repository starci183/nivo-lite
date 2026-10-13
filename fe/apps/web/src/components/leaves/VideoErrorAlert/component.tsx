import { Alert } from "@starci/grammar/common"

/** Copy and handler of a dismissible error line. */
export interface VideoErrorAlertBaseProps {
    readonly props: { readonly message: string | null; readonly dismissLabel: string }
    readonly on: { readonly dismiss: () => void }
}

/** Draws one negative alert the person can dismiss. */
export const VideoErrorAlertBase = (props: VideoErrorAlertBaseProps) =>
    props.props.message === null ? null : (
        <Alert
            tone="negative"
            title={props.props.message}
            dismissLabel={props.props.dismissLabel}
            onDismiss={props.on.dismiss}
        />
    )
