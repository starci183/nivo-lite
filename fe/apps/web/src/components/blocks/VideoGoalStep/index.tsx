"use client"

import {
    useVideoEditorData,
    aspectKey,
    ASPECTS,
    DURATIONS,
    editorHref,
    GOAL_TEMPLATES,
    goalHintKey,
    goalLabelKey,
    useVideoActions,
} from "@/hooks/video"
import { useTranslations } from "next-intl"
import { useState } from "react"
import { useVideoGoalForm } from "@/hooks/rhf"
import { navigation } from "@/modules/i18n"
import { VideoGoalStepBase } from "./component"

/** What the page tells the step. */
interface VideoGoalStepProps {
    /** The step named in the address. */
    readonly tab: string | null
    /** The video named in the address, or the new-video command. */
    readonly focus: string | null
}

/** Step one of the wizard: the goal, the frame, the length and the working title. Saving creates the video and moves on to the material. */
export const VideoGoalStep = (props: VideoGoalStepProps) => {
    const editor = useVideoEditorData(props)
    const t = useTranslations("video")
    const { create, update } = useVideoActions()
    const router = navigation.useRouter()
    const pathname = navigation.usePathname()
    const form = useVideoGoalForm({
        goal: editor.goal.goal,
        aspect: editor.goal.aspect,
        seconds: editor.goal.seconds,
        title: editor.goal.title,
    })
    const draft = form.watch()
    const [error, setError] = useState<string | null>(null)
    const lengths = [...new Set([...DURATIONS, draft.seconds])].sort((a, b) => a - b)

    const next = form.handleSubmit(async (values) => {
        setError(null)
        const body = { goal: values.goal, aspect: values.aspect, title: values.title, targetSeconds: values.seconds }
        const saved = editor.goal.projectId === null ? await create(body) : await update(editor.goal.projectId, body)
        if (saved === undefined) return
        router.push(`${pathname}${editorHref(saved.id, "inputs")}`)
    })

    const chooseGoal = (value: string) => {
        const found = GOAL_TEMPLATES.find((entry) => entry.goal === value)
        if (found === undefined) return
        form.setValue("goal", found.goal, { shouldDirty: true })
        form.setValue("seconds", found.default_seconds, { shouldDirty: true })
        form.setValue("aspect", found.default_aspect, { shouldDirty: true })
    }

    return (
        <VideoGoalStepBase
            props={{
                heading: t("goalHeading"),
                goals: GOAL_TEMPLATES.map((entry) => ({
                    value: entry.goal,
                    label: t(goalLabelKey(entry.goal)),
                    description: t(goalHintKey(entry.goal)),
                })),
                goal: draft.goal,
                aspectLabel: t("aspectLabel"),
                aspects: ASPECTS.map((entry) => ({ value: entry, label: t(aspectKey(entry)) })),
                aspect: draft.aspect,
                durationLabel: t("durationLabel"),
                durations: lengths.map((entry) => ({ value: String(entry), label: t("seconds", { n: entry }) })),
                seconds: String(draft.seconds),
                titleLabel: t("titleLabel"),
                titleHint: t("titleHint"),
                title: draft.title,
                nextLabel: t("next"),
                disabled: !editor.canEdit || editor.goal.locked,
                pending: form.formState.isSubmitting,
                error: error ?? Object.values(form.formState.errors)[0]?.message ?? null,
                dismissLabel: t("back"),
            }}
            on={{
                goal: chooseGoal,
                aspect: (value) => {
                    const found = ASPECTS.find((entry) => entry === value)
                    if (found !== undefined) form.setValue("aspect", found, { shouldDirty: true })
                },
                seconds: (value) => form.setValue("seconds", Number(value), { shouldDirty: true }),
                title: (value) => form.setValue("title", value, { shouldDirty: true }),
                next: () => void next(),
                dismissError: () => {
                    setError(null)
                    form.clearErrors()
                },
            }}
        />
    )
}
