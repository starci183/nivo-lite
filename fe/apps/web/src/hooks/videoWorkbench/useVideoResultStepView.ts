"use client"

import type { VideoProductionActions, VideoProductionViews } from "@/modules/types"
type VideoResultViewFields = VideoProductionViews["result"]
import { useState } from "react"
import { useTranslations, useFormatter } from "next-intl"
import { useVideoRelease, useVideoFailure } from "@/hooks/video"
import { useFeatureLifetime, useFeatureReset } from "@/hooks/reuseables"
import { editorHref } from "@/modules/video"

import { navigation } from "@/modules/i18n"
import { useGraphQLWithToast } from "@/modules/toast"
import { shapeOf, videoOwnerOf, videoResultBadgesOf, type VideoViewInput } from "./videoWorkbench.shared"
/** The actions the result step offers: approve, share, mark posted, edit again, re-render. */
export type VideoResultViewActions = VideoProductionActions["result"]
type ResultBusy = "approve" | "share" | "posted"
type ResultCopy = Pick<
    VideoResultViewFields,
    | "heading"
    | "waitingLabel"
    | "captionsLabel"
    | "approveLabel"
    | "downloadLabel"
    | "shareLabel"
    | "postedLabel"
    | "soonLabel"
    | "tikTokLabel"
    | "facebookLabel"
    | "postNote"
    | "editLabel"
    | "rerenderLabel"
>
const copyOf = (t: ReturnType<typeof useTranslations<"video">>): ResultCopy => ({
    heading: t("resultHeading"),
    waitingLabel: t("status_rendering"),
    captionsLabel: t("captionsLabel"),
    approveLabel: t("approve"),
    downloadLabel: t("download"),
    shareLabel: t("share"),
    postedLabel: t("markPublished"),
    soonLabel: t("soon"),
    tikTokLabel: t("postTikTok"),
    facebookLabel: t("postFacebook"),
    postNote: t("postNote"),
    editLabel: t("editAgain"),
    rerenderLabel: t("rerender"),
})
interface ResultProjection {
    readonly input: VideoViewInput
    readonly t: ReturnType<typeof useTranslations<"video">>
    readonly format: ReturnType<typeof useFormatter>
    readonly failure: ReturnType<typeof useVideoFailure>
    readonly busy: ResultBusy | null
    readonly message: VideoResultViewFields["message"]
}
type ResultUi = ResultCopy & {
    readonly failedTitle: string
    readonly approveHeading: string
    readonly approveHelp: string
    readonly approving: boolean
    readonly sharing: boolean
    readonly posting: boolean
    readonly lockedNote: string
    readonly message: VideoResultViewFields["message"]
}
type ResultRead = Pick<
    VideoResultViewFields,
    | "fact"
    | "title"
    | "shape"
    | "videoUrl"
    | "posterUrl"
    | "captionsUrl"
    | "captionsLang"
    | "failedDetail"
    | "badges"
    | "showApprove"
    | "approveDisabled"
    | "downloadUrl"
    | "showShare"
    | "showPosted"
    | "canEdit"
    | "rerenderDisabled"
> & { readonly isApproved: boolean; readonly hasFailedRender: boolean }
type ResultFields = { readonly ui: ResultUi; readonly read: ResultRead | null }
const resultFieldsOf = (context: ResultProjection): ResultFields => {
    const { input, t, format, failure, busy, message } = context,
        editor = input.editor,
        project = editor?.project ?? null
    const ui = {
        ...copyOf(t),
        failedTitle: input.copy.renderFailed,
        approveHeading: input.copy.approve,
        approveHelp: input.copy.approveHelp,
        approving: busy === "approve",
        sharing: busy === "share",
        posting: busy === "posted",
        lockedNote: input.copy.approvedLocked,
        message: message,
    }
    if (project === null || editor === null) return { ui, read: null }
    const render = project.render,
        approved = project.status === "approved" || project.status === "published",
        badges = videoResultBadgesOf(project, t, format),
        statusLabel = t(`status_${project.status}`)
    return {
        ui,
        read: {
            fact: `${t("version", { n: project.renderCount })} - ${statusLabel}`,
            title: project.title,
            shape: shapeOf(project.aspect),
            videoUrl: render?.videoUrl ?? null,
            posterUrl: render?.posterUrl ?? null,
            captionsUrl: render?.captionsUrl ?? null,
            captionsLang: render?.captionsLang ?? null,
            failedDetail: render?.error ? failure(render.error) : null,
            badges,
            showApprove: !approved,
            approveDisabled: !editor.canEdit || project.status !== "ready",
            downloadUrl: approved ? (render?.downloadUrl ?? null) : null,
            showShare: approved,
            showPosted: project.status === "approved",
            canEdit: editor.canEdit,
            rerenderDisabled: !editor.canEdit || project.status === "rendering",
            isApproved: approved,
            hasFailedRender: render?.status === "failed",
        },
    }
}
type UseVideoResultStepViewResult = ResultFields & { on: VideoResultViewActions }

/** Existing release actions retain their same result predicates and standard feedback owner. */
export const useVideoResultStepView = (input: VideoViewInput): UseVideoResultStepViewResult => {
    const t = useTranslations("video"),
        format = useFormatter(),
        failure = useVideoFailure(),
        owner = videoOwnerOf(input, "result"),
        lifetime = useFeatureLifetime(owner.isActive, owner.scope),
        actions = useVideoRelease(owner),
        router = navigation.useRouter(),
        pathname = navigation.usePathname(),
        report = useGraphQLWithToast(),
        project = input.editor?.project ?? null,
        [busy, setBusy] = useState<ResultBusy | null>(null),
        [message, setMessage] = useState<VideoResultViewFields["message"]>(null)
    useFeatureReset({
        isActive: input.isActive,
        isReady: project !== null,
        scope: owner.scope,
        onReset: () => {
            setBusy(null)
            setMessage(null)
        },
    })
    const run = (name: ResultBusy) => {
        const current = lifetime.capture()
        if (!current() || project === null) return
        setBusy(name)
        const done = (text: VideoResultViewFields["message"]) => {
            if (current()) setMessage(text)
        }
        let task: Promise<unknown>
        if (name === "approve") task = actions.approve(project.id, () => done(null))
        else if (name === "share")
            task = actions.share(project.id, (value) =>
                done(
                    value === undefined
                        ? null
                        : { tone: "informative", text: value.telegram ? t("sharedTelegram") : t("shared") },
                ),
            )
        else
            task = actions.publish(project.id, (value) =>
                done(value === undefined ? null : { tone: "informative", text: t("postedNote") }),
            )
        task.catch((error) => report(() => Promise.reject(error), { showSuccessToast: false })).finally(() => {
            if (current()) setBusy(null)
        })
    }
    const on: VideoResultViewActions = {
        approve: () => run("approve"),
        share: () => run("share"),
        posted: () => run("posted"),
        edit: () => {
            if (project !== null && lifetime.capture()()) router.push(pathname + editorHref(project.id, "script"))
        },
        rerender: () => {
            if (project !== null && lifetime.capture()()) router.push(pathname + editorHref(project.id, "preview"))
        },
    }
    return { ...resultFieldsOf({ input, t, format, failure, busy, message }), on }
}
