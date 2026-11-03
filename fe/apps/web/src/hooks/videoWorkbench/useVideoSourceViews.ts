import { useVideoGoalStepView } from "./useVideoGoalStepView"
import { useVideoInputsStepView } from "./useVideoInputsStepView"
import { useVideoBrandCardView } from "./useVideoBrandCardView"
import { useVideoEditorStepperView } from "./useVideoEditorStepperView"
import type { VideoViewInput } from "./videoWorkbench.shared"
import type { EditorStep, MediaItem, Goal } from "@/modules/video"
import type { VideoEditStepsActions } from "./useVideoEditorStepperView"
import type { VideoGoalFormActions } from "./useVideoGoalStepView"
import type { VideoInputsFormActions } from "./useVideoInputsStepView"
import type { VideoBrandSettingsActions } from "./useVideoBrandCardView"
type UseVideoSourceViewsResult = {
    ui: {
        stepper: {
            toLibrary: string
            libraryHref: string
            stepperLabel: string
            steps: {
                id: "goal" | "inputs" | "script" | "preview" | "result"
                label: string
            }[]
        }
        goal: {
            heading: string
            goals: {
                value: Goal
                label: string
                description: string
            }[]
            goal: string
            aspectLabel: string
            aspects: {
                value: "9:16" | "1:1" | "16:9"
                label: string
            }[]
            aspect: string
            durationLabel: string
            durations: {
                value: string
                label: string
            }[]
            seconds: string
            titleLabel: string
            titleHint: string
            title: string
            nextLabel: string
            pending: boolean
            error: string | null
            dismissLabel: string
        }
        inputs: {
            heading: string
            sourcesHeading: string
            sourcesHint: string
            sourcesEmpty: string
            sourceIds: readonly string[]
            notesLabel: string
            notesHint: string
            notes: string
            mediaHeading: string
            mediaHint: string
            mediaEmpty: string
            uploadLabel: string
            backLabel: string
            nextLabel: string
            busy: boolean
            message: {
                readonly tone: "negative" | "informative"
                readonly text: string
            } | null
        }
        brand: {
            title: string
            hint: string
            shopNameLabel: string
            shopName: string
            primaryLabel: string
            primary: string
            secondaryLabel: string
            secondary: string
            colorHint: string
            logoLabel: string
            logoNone: string
            logoUpload: string
            logoRemove: string
            hasLogo: boolean
            musicLabel: string
            music: string
            musics: {
                id: string
                label: string
            }[]
            voiceLabel: string
            voice: string
            voices: {
                id: "vi-VN-HoaiMyNeural" | "vi-VN-NamMinhNeural"
                label: string
            }[]
            saveLabel: string
            pending: boolean
            message: {
                readonly tone: "affirmative" | "negative"
                readonly text: string
            } | null
        }
        mediaPaths: string[]
    }
    read: {
        stepper: {
            current: "script" | "goal" | "inputs" | "preview" | "result"
            hasProject: boolean
            isViewOnly: boolean
        } | null
        goal: {
            disabled: boolean
        } | null
        inputs: {
            sources: {
                value: string
                label: string
                excerpt: string
            }[]
            media: readonly MediaItem[]
            canEdit: boolean
        } | null
        brand: {
            logoUrl: string | null
            canEdit: boolean
        } | null
    }
    on: {
        stepper: VideoEditStepsActions
        goal: VideoGoalFormActions
        inputs: VideoInputsFormActions
        brand: VideoBrandSettingsActions
    }
}

/** The actual goal/material/brand lifetimes formerly controlled by conditional block mounts. */
export const useVideoSourceViews = (
    input: VideoViewInput,
    isEditor: boolean,
    step: EditorStep,
    tab: string,
): UseVideoSourceViewsResult => {
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
