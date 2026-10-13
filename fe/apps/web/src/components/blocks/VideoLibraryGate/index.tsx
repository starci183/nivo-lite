"use client"

import type { ReactNode } from "react"
import { useVideoLibraryGate } from "@/hooks/video"
import { VideoLibraryGateBase } from "./component"

/** What the page tells the library gate. */
interface VideoLibraryGateProps {
    /** The blocks that need the library. */
    readonly children: ReactNode
    /** The name of the panel, drawn as a skeleton while the library is read. */
    readonly placeholder: string
}

/** Lets the blocks below it render once the library and the brand kit are read; a skeleton meanwhile. */
export const VideoLibraryGate = (props: VideoLibraryGateProps) => {
    const state = useVideoLibraryGate()
    return (
        <VideoLibraryGateBase state={{ content: props.children }} props={{ state, placeholder: props.placeholder }} />
    )
}
