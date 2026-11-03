"use client"

import { VIDEO_EDITOR_STEPS, type VideoEditorActions } from "@/modules/types"
export type VideoEditStepsActions = VideoEditorActions["stepper"]
import { useTranslations } from "next-intl"
import { useFeatureLifetime } from "@/hooks/reuseables"
import { editorHref } from "@/modules/video"

import { navigation } from "@/modules/i18n"
import { videoOwnerOf } from "./videoWorkbench.shared"
import type { VideoViewInput } from "./videoWorkbench.shared"
type UseVideoEditorStepperViewResult = {
    ui: {
        toLibrary: string
        libraryHref: string
        stepperLabel: string
        steps: {
            id: "goal" | "inputs" | "script" | "preview" | "result"
            label: string
        }[]
    }
    read: {
        current: "goal" | "inputs" | "script" | "preview" | "result"
        hasProject: boolean
        isViewOnly: boolean
    } | null
    on: VideoEditStepsActions
}

/** Step URLs still require the actual project; a new project begins at goal. */
export const useVideoEditorStepperView = (input: VideoViewInput): UseVideoEditorStepperViewResult => {
    const t = useTranslations("video"),
        owner = videoOwnerOf(input, "stepper"),
        lifetime = useFeatureLifetime(owner.isActive, owner.scope),
        router = navigation.useRouter(),
        pathname = navigation.usePathname(),
        id = input.editor?.project?.id ?? null
    const ui = {
        toLibrary: input.copy.toLibrary,
        libraryHref: "?tab=library",
        stepperLabel: input.copy.stepperLabel,
        steps: VIDEO_EDITOR_STEPS.map((step) => ({ id: step, label: t(`step_${step}`) })),
    }
    const on: VideoEditStepsActions = {
        select: (value) => {
            if (!lifetime.capture()()) return
            const target = VIDEO_EDITOR_STEPS.find((step) => step === value)
            if (target !== undefined && id !== null) router.push(pathname + editorHref(id, target))
        },
    }
    return {
        ui,
        read:
            input.editor === null
                ? null
                : { current: input.editor?.step ?? "goal", hasProject: id !== null, isViewOnly: !input.editor.canEdit },
        on,
    }
}
