"use client"

import { useLocale, useTranslations } from "next-intl"
import { useState } from "react"
import { aspectKey, ASPECTS, DURATIONS, editorHref, GOAL_TEMPLATES, useVideoFailure } from "@/hooks/video"
import type { Aspect, Goal } from "@/hooks/video"
import { navigation } from "@/modules/i18n"
import { createVideoProject, updateVideoProject } from "@/modules/db/video/write-project"
import { VideoGoalStepBase } from "./component"

/** What the person chose so far on this step. */
interface GoalDraft {
    readonly goal: Goal
    readonly aspect: Aspect
    readonly seconds: number
    readonly title: string
}

interface VideoGoalStepProps {
    /** The project being edited, or null while the video does not exist yet. */
    readonly projectId: string | null
    readonly goal: Goal
    readonly aspect: Aspect
    readonly seconds: number
    readonly title: string
    readonly canEdit: boolean
    /** True while the project is being scripted or rendered. */
    readonly locked: boolean
}

/** Step one of the wizard: the goal, the frame, the length and the working title. Saving creates the video and moves on to the material. */
export const VideoGoalStep = (props: VideoGoalStepProps) => {
    const t = useTranslations("video")
    const lang = useLocale() === "en" ? "en" : "vi"
    const failure = useVideoFailure()
    const router = navigation.useRouter()
    const pathname = navigation.usePathname()
    const [draft, setDraft] = useState<GoalDraft>({
        goal: props.goal,
        aspect: props.aspect,
        seconds: props.seconds,
        title: props.title,
    })
    const [pending, setPending] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const lengths = [...new Set([...DURATIONS, draft.seconds])].sort((a, b) => a - b)

    const next = async () => {
        setPending(true)
        setError(null)
        const body = { ...draft, targetSeconds: draft.seconds }
        const saved =
            props.projectId === null ? await createVideoProject(body) : await updateVideoProject(props.projectId, body)
        if (saved.kind !== "ok") {
            setError(t("actionFailed", { error: failure(saved.code) }))
            setPending(false)
            return
        }
        router.push(`${pathname}${editorHref(saved.value.id, "inputs")}`)
    }

    const chooseGoal = (value: string) => {
        const found = GOAL_TEMPLATES.find((entry) => entry.goal === value)
        if (found === undefined) return
        setDraft({ ...draft, goal: found.goal, seconds: found.default_seconds, aspect: found.default_aspect })
    }

    return (
        <VideoGoalStepBase
            props={{
                heading: t("goalHeading"),
                goals: GOAL_TEMPLATES.map((entry) => ({
                    value: entry.goal,
                    label: entry.label[lang],
                    description: entry.hint[lang],
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
                disabled: !props.canEdit || props.locked,
                pending,
                error,
                dismissLabel: t("back"),
            }}
            on={{
                goal: chooseGoal,
                aspect: (value) => {
                    const found = ASPECTS.find((entry) => entry === value)
                    if (found !== undefined) setDraft({ ...draft, aspect: found })
                },
                seconds: (value) => setDraft({ ...draft, seconds: Number(value) }),
                title: (value) => setDraft({ ...draft, title: value }),
                next: () => void next(),
                dismissError: () => setError(null),
            }}
        />
    )
}
