import { useVideoEditorData } from "./useVideoEditorData"
import type { VideoEditorAddress } from "./useVideoEditorStep"

/** The wizard with its video, for a block below a step gate that lets it through only once the video is there. */
export const useVideoProjectData = (address: VideoEditorAddress) => {
    const editor = useVideoEditorData(address)
    if (editor.project === null) throw new Error("The video was read before the gate let it through")
    return { ...editor, project: editor.project }
}
