import { VideoErrorAlertBase } from "./component"

interface VideoErrorAlertProps {
    /** The error text, already in the reader language. */
    readonly message: string | null
    readonly dismissLabel: string
    readonly onDismiss: () => void
}

/** A dismissible error line shown above a step. */
export const VideoErrorAlert = (props: VideoErrorAlertProps) => (
    <VideoErrorAlertBase
        props={{ message: props.message, dismissLabel: props.dismissLabel }}
        on={{ dismiss: props.onDismiss }}
    />
)
