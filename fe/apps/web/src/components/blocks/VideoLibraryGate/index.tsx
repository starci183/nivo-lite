"use client"

import type { ReactNode } from "react"
import { useVideoLibraryGate } from "@/hooks/video"

/** What the page tells the library gate. */
interface VideoLibraryGateProps {
    /** The blocks that need the library. */
    readonly children: ReactNode
}

/** Lets the blocks below it render once the library and the brand kit are read. */
export const VideoLibraryGate = (props: VideoLibraryGateProps) => {
    const ready = useVideoLibraryGate()
    return ready ? props.children : null
}
