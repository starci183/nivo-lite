"use client"

import {
    useVideoProjectData,
    editorHref,
    estimateScriptSeconds,
    newScene,
    SCRIPT_MAX_SCENES,
    useVideoFailure,
    useVideoActions,
    useVideoScript,
    VIDEO_MAX_SECONDS,
    type EditorStep,
    type SceneRole,
    type ScriptScene,
} from "@/hooks/video"
import { useFormatter, useTranslations } from "next-intl"
import { useEffect, useState } from "react"
import { useVideoScriptForm } from "@/hooks/rhf"
import { navigation } from "@/modules/i18n"
import { VideoScriptStepBase } from "./component"

/** The option that means a colour card without a file. */
const NO_MEDIA = "none"

const ROLE_TONE: Record<SceneRole, "accent" | "neutral" | "success"> = {
    hook: "accent",
    body: "neutral",
    cta: "success",
}

/** What the page tells the step. */
interface VideoScriptStepProps {
    /** The step named in the address. */
    readonly tab: string | null
    /** The video named in the address, or the new-video command. */
    readonly focus: string | null
}

const swapped = (scenes: ReadonlyArray<ScriptScene>, index: number, target: number): ReadonlyArray<ScriptScene> => {
    const from = scenes[index]
    const to = scenes[target]
    if (from === undefined || to === undefined) return scenes
    return scenes.map((scene, at) => {
        if (at === index) return to
        return at === target ? from : scene
    })
}

const estimateOf = (total: number, count: number): "none" | "long" | "ok" => {
    if (count === 0) return "none"
    return total > VIDEO_MAX_SECONDS ? "long" : "ok"
}

/** Step three of the wizard: NIVO writes the script, the owner edits it scene by scene. Moving on saves the scenes. */
export const VideoScriptStep = (props: VideoScriptStepProps) => {
    const editor = useVideoProjectData(props)
    const t = useTranslations("video")
    const format = useFormatter()
    const failure = useVideoFailure()
    const { update } = useVideoActions()
    const scriptJob = useVideoScript()
    const router = navigation.useRouter()
    const pathname = navigation.usePathname()
    const { project } = editor
    const form = useVideoScriptForm(project.script)
    const scenes = form.watch("scenes")
    const dirty = form.formState.isDirty
    const [error, setError] = useState<string | null>(project.lastError ? failure(project.lastError) : null)
    const scripting =
        project.status === "scripting" ||
        scriptJob.isMutating ||
        (scriptJob.status !== undefined && !["succeeded", "failed"].includes(scriptJob.status.status))
    const { reset } = form
    useEffect(() => {
        if (!dirty || project.status === "scripting") reset({ scenes: project.script.map((scene) => ({ ...scene })) })
    }, [project.script, project.status, reset, dirty])
    const total = estimateScriptSeconds(scenes)
    const estimate = estimateOf(total, scenes.length)

    const change = (next: ReadonlyArray<ScriptScene>) => {
        form.setValue(
            "scenes",
            next.map((scene) => ({ ...scene })),
            { shouldDirty: true, shouldValidate: true },
        )
    }
    const edit = (index: number, patch: Partial<ScriptScene>) =>
        change(scenes.map((scene, at) => (at === index ? { ...scene, ...patch } : scene)))

    const write = async () => {
        setError(null)
        await scriptJob.request(project.id)
    }

    const go = (step: EditorStep) =>
        form.handleSubmit(async (values) => {
            setError(null)
            const saved = dirty ? await update(project.id, { script: values.scenes }) : null
            if (saved === undefined) return
            router.push(`${pathname}${editorHref(project.id, step)}`)
        })()

    return (
        <VideoScriptStepBase
            props={{
                heading: t("scriptHeading"),
                tookLabel:
                    project.scriptMs === null
                        ? undefined
                        : t("scriptTook", { s: format.number(project.scriptMs / 1000, { maximumFractionDigits: 0 }) }),
                writing: scripting,
                writingLabel: t("scripting"),
                emptyLabel: t("scriptEmpty"),
                hasScenes: scenes.length > 0,
                writeLabel: scenes.length > 0 ? t("rewriteScript") : t("writeScript"),
                rewriteWarn: scenes.length > 0 && dirty ? t("rewriteWarn") : null,
                scenes: scenes.map((scene, index) => ({
                    id: scene.id,
                    title: t("sceneN", { n: index + 1 }),
                    roleLabel: t(`role_${scene.role}`),
                    roleTone: ROLE_TONE[scene.role],
                    caption: scene.caption,
                    voiceover: scene.voiceover,
                    visualHint: scene.visual === "" ? null : t("visualHint", { text: scene.visual }),
                    media: scene.media ?? NO_MEDIA,
                    canMoveUp: index > 0,
                    canMoveDown: index < scenes.length - 1,
                    canRemove: scenes.length > 1,
                })),
                mediaOptions: [
                    { id: NO_MEDIA, label: t("mediaNone") },
                    ...editor.media.map((item) => ({ id: item.path, label: item.name })),
                ],
                captionLabel: t("captionLabel"),
                voiceLabel: t("voiceLabel"),
                mediaLabel: t("mediaPick"),
                moveUpLabel: t("moveUp"),
                moveDownLabel: t("moveDown"),
                removeLabel: t("removeScene"),
                addLabel: t("addScene"),
                canAdd: scenes.length < SCRIPT_MAX_SCENES,
                backLabel: t("back"),
                nextLabel: t("next"),
                estimateLabel:
                    estimate === "none" ? null : t(estimate === "long" ? "tooLong" : "estimated", { n: total }),
                canEdit: editor.canEdit,
                locked: !editor.canEdit || scripting,
                saving: form.formState.isSubmitting,
                canContinue: estimate === "ok",
                error:
                    error ??
                    (Object.keys(form.formState.errors).length > 0 ? t("err_default") : null) ??
                    (scriptJob.error instanceof Error ? scriptJob.error.message : null) ??
                    (project.lastError ? failure(project.lastError) : null),
                dismissLabel: t("back"),
            }}
            on={{
                write: () => void write(),
                caption: (index, value) => edit(index, { caption: value }),
                voiceover: (index, value) => edit(index, { voiceover: value }),
                media: (index, value) => edit(index, { media: value === null || value === NO_MEDIA ? null : value }),
                move: (index, direction) => change(swapped(scenes, index, index + direction)),
                remove: (index) => change(scenes.filter((_, at) => at !== index)),
                add: () => change([...scenes, newScene(scenes.length > 0 ? "body" : "hook")]),
                back: () => void go("inputs"),
                next: () => void go("preview"),
                dismissError: () => {
                    setError(null)
                    form.clearErrors()
                },
            }}
        />
    )
}
