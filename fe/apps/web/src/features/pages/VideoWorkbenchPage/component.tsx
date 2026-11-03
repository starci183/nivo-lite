import type { VideoWorkbenchViews } from "@/modules/types"
type VideoWorkbenchInput = VideoWorkbenchViews["input"]
import { VideoWorkbench } from "@/components/blocks/VideoWorkbench"

/** The input the server shell hands to the video workbench block. */
export interface VideoWorkbenchPageBaseProps {
    readonly props: VideoWorkbenchInput
}
/** The server shell hands atoms to the single Video world. */
export const VideoWorkbenchPageBase = (props: VideoWorkbenchPageBaseProps) => <VideoWorkbench {...props.props} />
