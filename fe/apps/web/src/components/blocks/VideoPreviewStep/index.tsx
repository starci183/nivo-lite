"use client"

import {
    useVideoProjectData,
    editorHref,
    estimateScriptSeconds,
    useVideoFailure,
    useVideoRender,
    VIDEO_MAX_SECONDS,
} from "@/hooks/video"
import { useTranslations } from "next-intl"
import { useEffect, useRef, useState } from "react"
import { navigation } from "@/modules/i18n"
import { VideoPreviewStepBase, type VideoFrameShape } from "./component"

/** The stages the renderer reports. */
const STAGES: ReadonlySet<string> = new Set(["tts", "scenes", "mix", "encode", "upload"])

const shapeOf = (aspect: string): VideoFrameShape => {
    if (aspect === "9:16") return "portrait"
    return aspect === "1:1" ? "square" : "landscape"
}

/** What the page tells the step. */
interface VideoPreviewStepProps {
    /** The step named in the address. */
    readonly tab: string | null
    /** The video named in the address, or the new-video command. */
    readonly focus: string | null
}

/** Step four of the wizard: the storyboard and the render. The back end renders; the page reads its progress again every few seconds. */
export const VideoPreviewStep = (props: VideoPreviewStepProps) => {
    const editor = useVideoProjectData(props)
    const t = useTranslations("video")
    const failure = useVideoFailure()
    const router = navigation.useRouter()
    const pathname = navigation.usePathname()
    const { project } = editor
    const renderJob = useVideoRender(project.status === "rendering" ? project.render?.id : undefined)
    const [pending, setPending] = useState(false)
    const [error, setError] = useState<string | null>(project.lastError ? failure(project.lastError) : null)
    const rendering =
        project.status === "rendering" ||
        (renderJob.status !== undefined && !["done", "succeeded", "failed"].includes(renderJob.status.status))
    const wasRendering = useRef(rendering)

    // A render that finishes while this step is open moves on to the result.
    useEffect(() => {
        if (
            wasRendering.current &&
            (project.status === "ready" || ["done", "succeeded"].includes(renderJob.status?.status ?? ""))
        )
            router.push(`${pathname}${editorHref(project.id, "result")}`)
        wasRendering.current = rendering
    }, [rendering, renderJob.status?.status, project.status, project.id, pathname, router])

    const render = async () => {
        setPending(true)
        setError(null)
        await renderJob.request(project.id)
        setPending(false)
    }

    const scenes = project.script
    const total = estimateScriptSeconds(scenes)
    const stage = renderJob.status?.stage ?? project.render?.stage ?? ""
    return (
        <VideoPreviewStepBase
            props={{
                heading: t("storyboardHeading"),
                estimateLabel: t("estimated", { n: total }),
                hint: t("storyboardHint"),
                shape: shapeOf(project.aspect),
                frames: scenes.map((scene, index) => {
                    const item =
                        scene.media === null ? undefined : editor.media.find((entry) => entry.path === scene.media)
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
                stageLabel: STAGES.has(stage) ? t(`stage_${stage}`) : t("stage_queued"),
                progressLabel: t("progressLabel"),
                progress: renderJob.status?.progress ?? project.render?.progress ?? 0,
                note: t("renderNote"),
                backLabel: t("back"),
                renderLabel: project.renderCount > 0 ? t("rerender") : t("render"),
                pending: pending || rendering,
                canRender: editor.canEdit && scenes.length > 0 && total <= VIDEO_MAX_SECONDS,
                error:
                    error ??
                    (renderJob.error instanceof Error ? renderJob.error.message : null) ??
                    (renderJob.status?.errorCode ? failure(renderJob.status.errorCode) : null),
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
