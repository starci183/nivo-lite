import { useVideoScriptStepView } from "./useVideoScriptStepView"
import { useVideoPreviewStepView } from "./useVideoPreviewStepView"
import { useVideoResultStepView } from "./useVideoResultStepView"
import type { VideoViewInput } from "./videoWorkbench.shared"
import type { EditorStep } from "@/modules/video"
/** Only the actual selected production step follows its durable status; other steps remain idle. */
export const useVideoProductionViews = (input: VideoViewInput, isEditor: boolean, step: EditorStep) => {
    const ready = input.editor?.project !== null && input.editor !== null,
        script = useVideoScriptStepView({
            ...input,
            isActive: input.isActive && isEditor && step === "script" && ready,
        }),
        preview = useVideoPreviewStepView({
            ...input,
            isActive: input.isActive && isEditor && step === "preview" && ready,
        }),
        result = useVideoResultStepView({
            ...input,
            isActive: input.isActive && isEditor && step === "result" && ready,
        })
    const reads = [
        ...(script.isStatusEnabled ? [script.statusRead] : []),
        ...(preview.isStatusEnabled ? [preview.statusRead] : []),
    ]
    return {
        ui: {
            script: script.ui,
            preview: preview.ui,
            result: result.ui,
            scriptRequestPending: script.isRequestPending,
        },
        read: { script: script.read, preview: preview.read, result: result.read },
        on: { script: script.on, preview: preview.on, result: result.on },
        reads,
    }
}
