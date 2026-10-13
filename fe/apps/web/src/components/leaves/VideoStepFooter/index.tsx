import { VideoStepFooterBase } from "./component"

interface VideoStepFooterProps {
    readonly backLabel: string
    readonly nextLabel: string
    /** A short note beside the next action, for example the estimated length. */
    readonly note?: string | null
    readonly pending: boolean
    readonly nextDisabled: boolean
    readonly onBack: () => void
    readonly onNext: () => void
}

/** The footer of a wizard step: back, an optional note and the next action. */
export const VideoStepFooter = (props: VideoStepFooterProps) => (
    <VideoStepFooterBase
        props={{
            backLabel: props.backLabel,
            nextLabel: props.nextLabel,
            note: props.note ?? null,
            pending: props.pending,
            nextDisabled: props.nextDisabled,
        }}
        on={{ back: props.onBack, next: props.onNext }}
    />
)
