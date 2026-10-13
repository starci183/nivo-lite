"use client"

import { useTranslations } from "next-intl"
import { useEffect, useRef, useState } from "react"
import {
    editorHref,
    estimateScriptSeconds,
    useVideoFailure,
    useVideoRefresh,
    useVideoRender,
    VIDEO_MAX_SECONDS,
} from "@/hooks/video"
import type { MediaItem, ProjectView } from "@/hooks/video"
import { navigation } from "@/modules/i18n"
import { VideoPreviewStepBase } from "./component"
import type { VideoFrameShape } from "./component"

/** The stages the renderer reports. */
const STAGES = ["tts", "scenes", "mix", "encode", "upload"]

const shapeOf = (aspect: string): VideoFrameShape => {
    if (aspect === "9:16") return "portrait"
    return aspect === "1:1" ? "square" : "landscape"
}

interface VideoPreviewStepProps {
    readonly project: ProjectView
    readonly media: ReadonlyArray<MediaItem>
    readonly canEdit: boolean
}

/** Step four of the wizard: the storyboard and the render. The back end renders; the page reads its progress again every few seconds. */
export const VideoPreviewStep = (props: VideoPreviewStepProps) => {
    const t = useTranslations("video")
    const failure = useVideoFailure()
    const requestRender = useVideoRender()
    const router = navigation.useRouter()
    const pathname = navigation.usePathname()
    const { project } = props
    const [pending, setPending] = useState(false)
    const [error, setError] = useState<string | null>(project.lastError)
    const rendering = project.status === "rendering"
    const wasRendering = useRef(rendering)
    useVideoRefresh(rendering)

    // A render that finishes while this step is open moves on to the result.
    useEffect(() => {
        if (wasRendering.current && project.status === "ready")
            router.push(`${pathname}${editorHref(project.id, "result")}`)
        wasRendering.current = rendering
    }, [rendering, project.status, project.id, pathname, router])

    const render = async () => {
        setPending(true)
        setError(null)
        const code = await requestRender(project.id)
        if (code !== null) setError(t("actionFailed", { error: failure(code) }))
        router.refresh()
        setPending(false)
    }

    const scenes = project.script
    const total = estimateScriptSeconds(scenes)
    const stage = project.render?.stage ?? ""
    return (
        <VideoPreviewStepBase
            props={{
                heading: t("storyboardHeading"),
                estimateLabel: t("estimated", { n: total }),
                hint: t("storyboardHint"),
                shape: shapeOf(project.aspect),
                frames: scenes.map((scene, index) => {
                    const item =
                        scene.media === null ? undefined : props.media.find((entry) => entry.path === scene.media)
                    return {
                        label: t("sceneN", { n: index + 1 }),
                        caption: scene.caption,
                        mediaName: item?.name ?? null,
                        mediaUrl: item?.url ?? null,
                        mediaKind: item?.kind ?? null,
                    }
                }),
                live: rendering,
                progressTitle: t("rendering"),
                stageLabel: STAGES.includes(stage) ? t(`stage_${stage}`) : t("stage_queued"),
                progressLabel: t("progressLabel"),
                progress: project.render?.progress ?? 0,
                note: t("renderNote"),
                backLabel: t("back"),
                renderLabel: project.renderCount > 0 ? t("rerender") : t("render"),
                pending: pending || rendering,
                canRender: props.canEdit && scenes.length > 0 && total <= VIDEO_MAX_SECONDS,
                error,
                dismissLabel: t("back"),
            }}
            on={{
                back: () => router.push(`${pathname}${editorHref(project.id, "script")}`),
                render: () => void render(),
                dismissError: () => setError(null),
            }}
        />
    )
}
