"use client"

import { useVideoEditorData, editorHref, type EditorStep } from "@/hooks/video"
import { useTranslations } from "next-intl"

import { navigation } from "@/modules/i18n"
import { VideoEditorStepperBase } from "./component"

/** The steps of the wizard, in order. */
const STEPS: ReadonlyArray<EditorStep> = ["goal", "inputs", "script", "preview", "result"]

/** What the page tells the step. */
interface VideoEditorStepperProps {
    /** The step named in the address. */
    readonly tab: string | null
    /** The video named in the address, or the new-video command. */
    readonly focus: string | null
}

/** The wizard header: the way back to the library and the five steps, each a place in the address. */
export const VideoEditorStepper = (props: VideoEditorStepperProps) => {
    const editor = useVideoEditorData(props)
    const t = useTranslations("video")
    const router = navigation.useRouter()
    const pathname = navigation.usePathname()
    const projectId = editor.project?.id ?? null
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
                current: editor.step,
                viewOnly: editor.canEdit ? null : t("viewOnly"),
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
