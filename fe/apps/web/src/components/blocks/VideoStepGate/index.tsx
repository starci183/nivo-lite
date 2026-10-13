"use client"

import type { ReactNode } from "react"
import { useVideoStepGate, type VideoStepScope } from "@/hooks/video"

/** What the page tells the step gate. */
interface VideoStepGateProps {
    /** The blocks that need the wizard. */
    readonly children: ReactNode
    /** The part of the wizard the blocks below belong to. */
    readonly scope: VideoStepScope
    /** The step named in the address. */
    readonly tab: string | null
    /** The video named in the address, or the new-video command. */
    readonly focus: string | null
}

/** Lets the blocks below it render once the wizard is read and the video is on the step they belong to. */
export const VideoStepGate = (props: VideoStepGateProps) => {
    const ready = useVideoStepGate(props, props.scope)
    return ready ? props.children : null
}
