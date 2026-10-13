"use client"

import { useTranslations } from "next-intl"
import { editorHref } from "@/hooks/video"
import type { EditorStep } from "@/hooks/video"
import { navigation } from "@/modules/i18n"
import { VideoEditorStepperBase } from "./component"

/** The steps of the wizard, in order. */
const STEPS: ReadonlyArray<EditorStep> = ["goal", "inputs", "script", "preview", "result"]

interface VideoEditorStepperProps {
    /** The video being edited, or null while it does not exist yet (only the first step opens). */
    readonly projectId: string | null
    readonly step: EditorStep
    readonly canEdit: boolean
}

/** The wizard header: the way back to the library and the five steps, each a place in the address. */
export const VideoEditorStepper = (props: VideoEditorStepperProps) => {
    const t = useTranslations("video")
    const router = navigation.useRouter()
    const pathname = navigation.usePathname()
    const { projectId } = props
    return (
        <VideoEditorStepperBase
            props={{
                toLibrary: t("toLibrary"),
                libraryHref: "?tab=library",
                stepperLabel: t("stepperLabel"),
                steps: STEPS.map((id) => ({
                    id,
                    label: t(`step_${id}`),
                    isDisabled: id !== "goal" && projectId === null,
                })),
                current: props.step,
                viewOnly: props.canEdit ? null : t("viewOnly"),
            }}
            on={{
                select: (id) => {
                    const target = STEPS.find((entry) => entry === id)
                    if (target !== undefined && projectId !== null)
                        router.push(`${pathname}${editorHref(projectId, target)}`)
                },
            }}
        />
    )
}
