import { Alert } from "@starci/grammar/common"
interface VideoErrorAlertProps {
    readonly message: string | null
    readonly dismissLabel: string
    readonly onDismiss: () => void
}
/** The same resolved command error is dismissible in its original native alert. */
export const VideoErrorAlert = (props: VideoErrorAlertProps) =>
    props.message === null ? null : (
        <Alert tone="negative" title={props.message} dismissLabel={props.dismissLabel} onDismiss={props.onDismiss} />
    )
