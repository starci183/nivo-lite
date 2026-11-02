import { useVideoGoalStepView } from "./useVideoGoalStepView"
import { useVideoInputsStepView } from "./useVideoInputsStepView"
import { useVideoBrandCardView } from "./useVideoBrandCardView"
import { useVideoEditorStepperView } from "./useVideoEditorStepperView"
import type { VideoViewInput } from "./videoWorkbench.shared"
import type { EditorStep } from "@/modules/video"
/** The actual goal/material/brand lifetimes formerly controlled by conditional block mounts. */
export const useVideoSourceViews = (input: VideoViewInput, isEditor: boolean, step: EditorStep, tab: string) => {
    const ready = input.editor !== null,
        goal = useVideoGoalStepView({ ...input, isActive: input.isActive && isEditor && step === "goal" && ready }),
        inputs = useVideoInputsStepView({
            ...input,
            isActive: input.isActive && isEditor && step === "inputs" && ready,
        }),
        brand = useVideoBrandCardView({
            ...input,
            isActive:
                input.isActive && (isEditor ? step === "inputs" && ready : tab === "brand" && input.library !== null),
        }),
        stepper = useVideoEditorStepperView({ ...input, isActive: input.isActive && isEditor && ready })
    return {
        ui: { stepper: stepper.ui, goal: goal.ui, inputs: inputs.ui, brand: brand.ui, mediaPaths: inputs.mediaPaths },
        read: {
            stepper: stepper.read === null ? null : { ...stepper.read, current: step },
            goal: goal.read,
            inputs: inputs.read,
            brand: brand.read,
        },
        on: { stepper: stepper.on, goal: goal.on, inputs: inputs.on, brand: brand.on },
    }
}
