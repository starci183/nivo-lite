import type { ReactNode } from "react"

/** Props for {@link VideoStepGateBase}. */
export interface VideoStepGateBaseProps {
    /** The blocks behind the gate. */
    readonly shape: { readonly content: ReactNode }
    readonly props: {
        /** The wizard is read and the video is on the step the blocks below belong to. */
        readonly isOpen: boolean
    }
}

/** Draws the blocks of one wizard step while the video is on that step, else nothing. */
export const VideoStepGateBase = (props: VideoStepGateBaseProps) => (
    <>{props.props.isOpen ? props.shape.content : null}</>
)
