"use client"

import type { VideoEditorActions } from "@/modules/types"
export type VideoGoalFormActions = VideoEditorActions["goal"]
import { useState } from "react"
import { useTranslations } from "next-intl"
import { useVideoActions } from "@/hooks/video"
import { useVideoGoalForm } from "@/hooks/rhf"
import { useFeatureLifetime, useFeatureReset } from "@/hooks/reuseables"
import {
    ASPECTS,
    DURATIONS,
    GOAL_TEMPLATES,
    aspectKey,
    editorHref,
    goalHintKey,
    goalLabelKey,
    goalTemplateOf,
} from "@/modules/video"

import { navigation } from "@/modules/i18n"
import { useGraphQLWithToast } from "@/modules/toast"
import { videoOwnerOf } from "./videoWorkbench.shared"
import type { VideoViewInput } from "./videoWorkbench.shared"
import type { Goal } from "@/modules/video"
interface GoalProjection {
    readonly input: VideoViewInput
    readonly t: ReturnType<typeof useTranslations<"video">>
    readonly draft: { readonly goal: string; readonly aspect: string; readonly seconds: number; readonly title: string }
    readonly initial: { readonly locked: boolean }
    readonly pending: boolean
    readonly error: string | null
}
/** Resolves the goal drawing from actual form/read atoms. */
const goalFieldsOf = (context: GoalProjection) => {
    const { input, t, draft, initial, pending, error } = context
    const copy = input.copy,
        lengths = [...new Set([...DURATIONS, draft.seconds])].sort((x, y) => x - y)
    return {
        ui: {
            heading: copy.goalHeading,
            goals: GOAL_TEMPLATES.map((e) => ({
                value: e.goal,
                label: t(goalLabelKey(e.goal)),
                description: t(goalHintKey(e.goal)),
            })),
            goal: draft.goal,
            aspectLabel: copy.aspectLabel,
            aspects: ASPECTS.map((e) => ({ value: e, label: t(aspectKey(e)) })),
            aspect: draft.aspect,
            durationLabel: copy.durationLabel,
            durations: lengths.map((e) => ({ value: String(e), label: t("seconds", { n: e }) })),
            seconds: String(draft.seconds),
            titleLabel: copy.titleLabel,
            titleHint: copy.titleHint,
            title: draft.title,
            nextLabel: copy.next,
            pending: pending,
            error: error,
            dismissLabel: copy.back,
        },
        read: input.editor === null ? null : { disabled: !input.editor?.canEdit || initial.locked },
    }
}
type UseVideoGoalStepViewResult = {
    on: VideoGoalFormActions
    ui: {
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
    read: {
        disabled: boolean
    } | null
}

/** Actual goal/create form of the selected editor lifetime. */
export const useVideoGoalStepView = (input: VideoViewInput): UseVideoGoalStepViewResult => {
    const t = useTranslations("video"),
        owner = videoOwnerOf(input, "goal"),
        lifetime = useFeatureLifetime(owner.isActive, owner.scope),
        actions = useVideoActions(owner),
        report = useGraphQLWithToast(),
        router = navigation.useRouter(),
        pathname = navigation.usePathname()
    const initial = input.editor?.goal ?? {
        projectId: null,
        goal: goalTemplateOf("service").goal,
        aspect: goalTemplateOf("service").default_aspect,
        seconds: goalTemplateOf("service").default_seconds,
        title: "",
        locked: false,
    }
    const form = useVideoGoalForm(initial),
        draft = form.watch(),
        [error, setError] = useState<string | null>(null)
    useFeatureReset({
        isActive: input.isActive,
        isReady: input.editor !== null,
        scope: owner.scope,
        onReset: () => {
            form.reset(initial)
            setError(null)
        },
    })
    const fields = goalFieldsOf({
        input,
        t,
        draft,
        initial,
        pending: form.formState.isSubmitting || actions.isPending,
        error: error ?? Object.values(form.formState.errors)[0]?.message ?? null,
    })
    const next = () => {
        const current = lifetime.capture()
        if (!current() || input.editor === null) return
        form.handleSubmit((values) => {
            if (!current()) return
            setError(null)
            const body = {
                goal: values.goal,
                aspect: values.aspect,
                title: values.title,
                targetSeconds: values.seconds,
            }
            const done = (saved: { readonly id: string } | undefined) => {
                if (saved !== undefined && current()) router.push(pathname + editorHref(saved.id, "inputs"))
            }
            const task =
                initial.projectId === null ? actions.create(body, done) : actions.update(initial.projectId, body, done)
            task.catch((error) => report(() => Promise.reject(error), { showSuccessToast: false }))
        })().catch((error) => report(() => Promise.reject(error), { showSuccessToast: false }))
    }
    const on: VideoGoalFormActions = {
        goal: (value) => {
            const found = GOAL_TEMPLATES.find((e) => e.goal === value)
            if (found === undefined) return
            form.setValue("goal", found.goal, { shouldDirty: true })
            form.setValue("seconds", found.default_seconds, { shouldDirty: true })
            form.setValue("aspect", found.default_aspect, { shouldDirty: true })
        },
        aspect: (value) => {
            const found = ASPECTS.find((e) => e === value)
            if (found !== undefined) form.setValue("aspect", found, { shouldDirty: true })
        },
        seconds: (value) => form.setValue("seconds", Number(value), { shouldDirty: true }),
        title: (value) => form.setValue("title", value, { shouldDirty: true }),
        next,
        dismissError: () => {
            setError(null)
            form.clearErrors()
        },
    }
    return { ...fields, on }
}
