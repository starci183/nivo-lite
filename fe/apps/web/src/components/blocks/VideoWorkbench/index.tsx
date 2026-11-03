"use client"

import type { VideoWorkbenchViews } from "@/modules/types"

import { useVideoWorkbenchView } from "@/hooks/videoWorkbench"
import { VideoWorkbenchBase } from "./component"
type VideoWorkbenchProps = VideoWorkbenchViews["input"]
/** Owns the normal dashboard and real selected-project editor through one atom Base. */
export const VideoWorkbench = (props: VideoWorkbenchProps) => {
    const view = useVideoWorkbenchView(props)
    return <VideoWorkbenchBase {...view} />
}
