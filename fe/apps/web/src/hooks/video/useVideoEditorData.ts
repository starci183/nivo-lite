import { useVideoEditor } from "./useVideoEditor"
import type { VideoEditorAddress } from "./useVideoEditorStep"

/** The wizard for a block below the step gate, which renders it only once the wizard is read. */
export const useVideoEditorData = (address: VideoEditorAddress) => {
    const editor = useVideoEditor(address)
    if (!editor.isReady) throw new Error("The video wizard was read before the gate let it through")
    return editor
}
