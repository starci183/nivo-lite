"use client"

import type { VideoWorkbenchViews } from "@/modules/types"
type VideoWorkbenchInput = VideoWorkbenchViews["input"]

import { useVideoWorkbenchView } from "@/hooks/videoWorkbench"
import { VideoWorkbenchBase } from "./component"
type VideoWorkbenchProps = VideoWorkbenchInput
/** Owns the normal dashboard and real selected-project editor through one atom Base. */
export const VideoWorkbench = (props: VideoWorkbenchProps) => {
    const view = useVideoWorkbenchView(props)
    return <VideoWorkbenchBase {...view} />
}
