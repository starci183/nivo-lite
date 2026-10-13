import { useVideoEditor } from "./useVideoEditor"
import type { VideoEditorAddress } from "./useVideoEditorStep"
import type { EditorStep } from "./video.shared"

/** Which part of the wizard a gate lets through: the stepper above the steps, or one step. */
export type VideoStepScope = "stepper" | EditorStep

/** Whether the wizard is read and the part it was asked for applies: the stepper always, a step when the video is on it. */
export const useVideoStepGate = (address: VideoEditorAddress, scope: VideoStepScope): boolean => {
    const editor = useVideoEditor(address)
    if (!editor.isReady) return false
    if (scope === "stepper") return true
    if (scope === "goal") return editor.step === "goal"
    return editor.project !== null && editor.step === scope
}
