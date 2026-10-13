"use client"

import { useFormatter, useTranslations } from "next-intl"
import { useState } from "react"
import {
    editorHref,
    estimateScriptSeconds,
    newScene,
    SCRIPT_MAX_SCENES,
    useVideoFailure,
    useVideoRefresh,
    VIDEO_MAX_SECONDS,
} from "@/hooks/video"
import type { EditorStep, MediaItem, ProjectView, SceneRole, ScriptScene } from "@/hooks/video"
import { navigation } from "@/modules/i18n"
import { updateVideoProject } from "@/modules/db/video/write-project"
import { startVideoScript } from "@/modules/db/video/write-script"
import { VideoScriptStepBase } from "./component"

/** The option that means a colour card without a file. */
const NO_MEDIA = "none"

const ROLE_TONE: Record<SceneRole, "accent" | "neutral" | "success"> = {
    hook: "accent",
    body: "neutral",
    cta: "success",
}

interface VideoScriptStepProps {
    readonly project: ProjectView
    readonly media: ReadonlyArray<MediaItem>
    readonly canEdit: boolean
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
    const t = useTranslations("video")
    const format = useFormatter()
    const failure = useVideoFailure()
    const router = navigation.useRouter()
    const pathname = navigation.usePathname()
    const { project } = props
    const [scenes, setScenes] = useState<ReadonlyArray<ScriptScene>>(project.script)
    const [dirty, setDirty] = useState(false)
    const [pending, setPending] = useState<"write" | "save" | null>(null)
    const [error, setError] = useState<string | null>(project.lastError)
    const scripting = project.status === "scripting"
    useVideoRefresh(scripting)
    const total = estimateScriptSeconds(scenes)
    const estimate = estimateOf(total, scenes.length)

    const change = (next: ReadonlyArray<ScriptScene>) => {
        setScenes(next)
        setDirty(true)
    }
    const edit = (index: number, patch: Partial<ScriptScene>) =>
        change(scenes.map((scene, at) => (at === index ? { ...scene, ...patch } : scene)))

    const write = async () => {
        setPending("write")
        setError(null)
        const started = await startVideoScript(project.id)
        if (started.kind !== "ok") setError(t("actionFailed", { error: failure(started.code) }))
        router.refresh()
        setPending(null)
    }

    const go = async (step: EditorStep) => {
        setPending("save")
        setError(null)
        const saved = dirty ? await updateVideoProject(project.id, { script: scenes }) : null
        if (saved !== null && saved.kind !== "ok") {
            setError(t("actionFailed", { error: failure(saved.code) }))
            setPending(null)
            return
        }
        router.push(`${pathname}${editorHref(project.id, step)}`)
    }

    return (
        <VideoScriptStepBase
            props={{
                heading: t("scriptHeading"),
                tookLabel:
                    project.scriptMs === null
                        ? undefined
                        : t("scriptTook", { s: format.number(project.scriptMs / 1000, { maximumFractionDigits: 0 }) }),
                writing: scripting || pending === "write",
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
                    ...props.media.map((item) => ({ id: item.path, label: item.name })),
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
                canEdit: props.canEdit,
                locked: !props.canEdit || scripting || pending === "write",
                saving: pending === "save",
                canContinue: estimate === "ok",
                error,
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
                dismissError: () => setError(null),
            }}
        />
    )
}
