"use client"

import type { VideoProductionActions, VideoProductionViews } from "@/modules/types"
import { useEffect, useRef, useState } from "react"
import { useTranslations } from "next-intl"
import { useVideoRender, useVideoFailure } from "@/hooks/video"
import { useFeatureLifetime, useFeatureReset } from "@/hooks/reuseables"
import { editorHref, estimateScriptSeconds, VIDEO_MAX_SECONDS } from "@/modules/video"

import { navigation } from "@/modules/i18n"
import { useGraphQLWithToast } from "@/modules/toast"
import { shapeOf, videoOwnerOf } from "./videoWorkbench.shared"

import type { VideoViewInput } from "./videoWorkbench.shared"

/** The actions the preview step card offers: go back, start a render, dismiss an error. */
export type VideoPreviewCardActions = VideoProductionActions["preview"]

const STAGES: ReadonlySet<string> = new Set(["tts", "scenes", "mix", "encode", "upload"])
interface PreviewProjection {
    readonly input: VideoViewInput
    readonly t: ReturnType<typeof useTranslations<"video">>
    readonly renderJob: ReturnType<typeof useVideoRender>
    readonly failure: ReturnType<typeof useVideoFailure>
    readonly error: string | null
    readonly pending: boolean
    readonly rendering: boolean
}
type PreviewUi = Pick<
    VideoProductionViews["preview"],
    | "heading"
    | "hint"
    | "progressTitle"
    | "progressLabel"
    | "note"
    | "backLabel"
    | "renderLabel"
    | "pending"
    | "error"
    | "dismissLabel"
>
type PreviewRead = Pick<
    VideoProductionViews["preview"],
    "estimateLabel" | "shape" | "frames" | "live" | "stageLabel" | "progress" | "canRender"
> & { readonly hasRender: boolean; readonly statusFailure: string | null }
type PreviewFields = { readonly ui: PreviewUi; readonly read: PreviewRead | null }
const videoPreviewFieldsOf = (context: PreviewProjection): PreviewFields => {
    const { input, t, renderJob, failure, error, pending, rendering } = context,
        editor = input.editor,
        project = editor?.project ?? null
    const ui = {
        heading: t("storyboardHeading"),
        hint: t("storyboardHint"),
        progressTitle: t("rendering"),
        progressLabel: t("progressLabel"),
        note: t("renderNote"),
        backLabel: t("back"),
        renderLabel: input.copy.render,
        pending: pending,
        error: error,
        dismissLabel: t("back"),
    }
    if (project === null || editor === null) return { ui, read: null }
    const scenes = project.script,
        total = estimateScriptSeconds(scenes),
        stage = renderJob.status?.stage ?? project.render?.stage ?? ""
    return {
        ui,
        read: {
            estimateLabel: t("estimated", { n: total }),
            shape: shapeOf(project.aspect),
            frames: scenes.map((scene, index) => {
                const item = scene.media === null ? undefined : editor.media.find((entry) => entry.path === scene.media)
                return {
                    label: t("sceneN", { n: index + 1 }),
                    caption: scene.caption,
                    mediaName: item?.name ?? null,
                    mediaUrl: item?.url ?? null,
                    mediaKind: item?.kind ?? null,
                }
            }),
            live: rendering,
            stageLabel: STAGES.has(stage) ? t(`stage_${stage}`) : t("stage_queued"),
            progress: renderJob.status?.progress ?? project.render?.progress ?? 0,
            canRender: editor.canEdit && scenes.length > 0 && total <= VIDEO_MAX_SECONDS,
            hasRender: project.renderCount > 0,
            statusFailure: renderJob.status?.errorCode ? failure(renderJob.status.errorCode) : null,
        },
    }
}
type UseVideoPreviewStepViewResult = PreviewFields & {
    on: VideoPreviewCardActions
    statusRead: ReturnType<typeof useVideoRender>["read"]
    isStatusEnabled: boolean
}

/** Follows the actual selected render; leaving this step pauses its status read. */
export const useVideoPreviewStepView = (input: VideoViewInput): UseVideoPreviewStepViewResult => {
    const t = useTranslations("video"),
        failure = useVideoFailure(),
        owner = videoOwnerOf(input, "preview"),
        lifetime = useFeatureLifetime(owner.isActive, owner.scope),
        project = input.editor?.project ?? null,
        renderJob = useVideoRender(project?.status === "rendering" ? project.render?.id : undefined, owner),
        router = navigation.useRouter(),
        pathname = navigation.usePathname(),
        report = useGraphQLWithToast(),
        [error, setError] = useState<string | null>(project?.lastError ? failure(project.lastError) : null)
    const rendering =
            project?.status === "rendering" ||
            (renderJob.status !== undefined && !["done", "succeeded", "failed"].includes(renderJob.status.status)),
        previous = useRef<{ readonly scope: string; readonly rendering: boolean } | null>(null)
    useFeatureReset({
        isActive: input.isActive,
        isReady: project !== null,
        scope: owner.scope,
        onReset: () => setError(project?.lastError ? failure(project.lastError) : null),
    })
    useEffect(() => {
        if (!input.isActive || project === null) {
            previous.current = null
            return
        }
        const prior = previous.current
        if (
            prior?.scope === owner.scope &&
            prior.rendering &&
            (project.status === "ready" || ["done", "succeeded"].includes(renderJob.status?.status ?? "")) &&
            lifetime.capture()()
        )
            router.push(pathname + editorHref(project.id, "result"))
        previous.current = { scope: owner.scope, rendering }
    }, [input.isActive, project, owner.scope, rendering, renderJob.status?.status, lifetime, router, pathname])
    const on: VideoPreviewCardActions = {
        back: () => {
            if (project !== null && lifetime.capture()()) router.push(pathname + editorHref(project.id, "script"))
        },
        render: () => {
            if (project === null || !lifetime.capture()()) return
            setError(null)
            renderJob
                .request(project.id)
                .catch((error) => report(() => Promise.reject(error), { showSuccessToast: false }))
        },
        dismissError: () => setError(null),
    }
    return {
        ...videoPreviewFieldsOf({ input, t, renderJob, failure, error, pending: renderJob.isPending, rendering }),
        on,
        statusRead: renderJob.read,
        isStatusEnabled: renderJob.isStatusEnabled,
    }
}
