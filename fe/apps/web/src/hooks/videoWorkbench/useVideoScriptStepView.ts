"use client"

import type { VideoEditorActions } from "@/modules/types"
type VideoScriptFormActions = VideoEditorActions["script"]
import { useEffect, useState } from "react"
import { useTranslations, useFormatter } from "next-intl"
import { useVideoActions, useVideoScript, useVideoFailure } from "@/hooks/video"
import { useVideoScriptForm } from "@/hooks/rhf"
import { useFeatureLifetime, useFeatureReset } from "@/hooks/reuseables"
import { editorHref, newScene } from "@/modules/video"
import type { ScriptScene, EditorStep } from "@/modules/video"
import { navigation } from "@/modules/i18n"
import { useGraphQLWithToast } from "@/modules/toast"
import { videoOwnerOf, videoScriptFieldsOf, swapped } from "./videoWorkbench.shared"
import type { VideoViewInput } from "./videoWorkbench.shared"
const sceneChangesOf = (form: ReturnType<typeof useVideoScriptForm>, scenes: ReadonlyArray<ScriptScene>) => {
    const change = (next: ReadonlyArray<ScriptScene>) => {
        form.setValue(
            "scenes",
            next.map((scene) => ({ ...scene })),
            { shouldDirty: true, shouldValidate: true },
        )
    }
    const edit = (index: number, patch: Partial<ScriptScene>) =>
        change(scenes.map((scene, at) => (at === index ? { ...scene, ...patch } : scene)))

    return { change, edit }
}
/** Real script editing and durable job request retain their selected-project lifetime. */
export const useVideoScriptStepView = (input: VideoViewInput) => {
    const t = useTranslations("video"),
        format = useFormatter(),
        failure = useVideoFailure(),
        owner = videoOwnerOf(input, "script"),
        lifetime = useFeatureLifetime(owner.isActive, owner.scope),
        actions = useVideoActions(owner),
        job = useVideoScript(owner),
        report = useGraphQLWithToast(),
        router = navigation.useRouter(),
        pathname = navigation.usePathname(),
        project = input.editor?.project ?? null
    const form = useVideoScriptForm(project?.script ?? []),
        scenes = form.watch("scenes"),
        dirty = form.formState.isDirty,
        [error, setError] = useState<string | null>(project?.lastError ? failure(project.lastError) : null),
        { reset } = form
    useFeatureReset({
        isActive: input.isActive,
        isReady: project !== null,
        scope: owner.scope,
        onReset: () => {
            reset({ scenes: (project?.script ?? []).map((scene) => ({ ...scene })) })
            setError(project?.lastError ? failure(project.lastError) : null)
        },
    })
    useEffect(() => {
        if (input.isActive && project !== null && (!dirty || project.status === "scripting"))
            reset({ scenes: project.script.map((scene) => ({ ...scene })) })
    }, [input.isActive, project, reset, dirty])
    const { change, edit } = sceneChangesOf(form, scenes)
    const go = (step: EditorStep) => {
        const current = lifetime.capture()
        if (!current() || project === null) return
        form.handleSubmit((values) => {
            if (!current()) return
            setError(null)
            const done = () => {
                if (current()) router.push(pathname + editorHref(project.id, step))
            }
            if (!dirty) {
                done()
                return
            }
            actions
                .update(project.id, { script: values.scenes }, (saved) => {
                    if (saved !== undefined) done()
                })
                .catch((error) => report(() => Promise.reject(error), { showSuccessToast: false }))
        })().catch((error) => report(() => Promise.reject(error), { showSuccessToast: false }))
    }
    const on: VideoScriptFormActions = {
        write: () => {
            const current = lifetime.capture()
            if (!current() || project === null) return
            setError(null)
            job.request(project.id).catch((error) => report(() => Promise.reject(error), { showSuccessToast: false }))
        },
        caption: (index, value) => edit(index, { caption: value }),
        voiceover: (index, value) => edit(index, { voiceover: value }),
        media: (index, value) => edit(index, { media: value === null || value === "none" ? null : value }),
        move: (index, direction) => change(swapped(scenes, index, index + direction)),
        remove: (index) => change(scenes.filter((_, at) => at !== index)),
        add: () => change([...scenes, newScene(scenes.length > 0 ? "body" : "hook")]),
        back: () => go("inputs"),
        next: () => go("preview"),
        dismissError: () => {
            setError(null)
            form.clearErrors()
        },
    }
    return {
        ...videoScriptFieldsOf({ input, form, job, error, pending: actions.isPending, t, format, failure }),
        on,
        statusRead: job.read,
        isStatusEnabled: job.isStatusEnabled,
        isRequestPending: job.isPending,
    }
}
