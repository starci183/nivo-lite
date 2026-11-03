"use client"

import type { VideoProductionActions, VideoProductionViews } from "@/modules/types"
type VideoResultViewFields = VideoProductionViews["result"]
export type VideoResultViewActions = VideoProductionActions["result"]
import { useState } from "react"
import { useTranslations, useFormatter } from "next-intl"
import { useVideoRelease, useVideoFailure } from "@/hooks/video"
import { useFeatureLifetime, useFeatureReset } from "@/hooks/reuseables"
import { editorHref } from "@/modules/video"

import { navigation } from "@/modules/i18n"
import { useGraphQLWithToast } from "@/modules/toast"
import { shapeOf, videoOwnerOf, videoResultBadgesOf } from "./videoWorkbench.shared"
import type { VideoViewInput, VideoResultBadge } from "./videoWorkbench.shared"
type ResultBusy = "approve" | "share" | "posted"
const copyOf = (t: ReturnType<typeof useTranslations<"video">>) => ({
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
const resultFieldsOf = (context: ResultProjection) => {
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
type UseVideoResultStepViewResult =
    | {
          on: VideoResultViewActions
          ui: {
              failedTitle: string
              approveHeading: string
              approveHelp: string
              approving: boolean
              sharing: boolean
              posting: boolean
              lockedNote: string
              message: {
                  readonly tone: "negative" | "informative"
                  readonly text: string
              } | null
              heading: string
              waitingLabel: string
              captionsLabel: string
              approveLabel: string
              downloadLabel: string
              shareLabel: string
              postedLabel: string
              soonLabel: string
              tikTokLabel: string
              facebookLabel: string
              postNote: string
              editLabel: string
              rerenderLabel: string
          }
          read: null
      }
    | {
          on: VideoResultViewActions
          ui: {
              failedTitle: string
              approveHeading: string
              approveHelp: string
              approving: boolean
              sharing: boolean
              posting: boolean
              lockedNote: string
              message: {
                  readonly tone: "negative" | "informative"
                  readonly text: string
              } | null
              heading: string
              waitingLabel: string
              captionsLabel: string
              approveLabel: string
              downloadLabel: string
              shareLabel: string
              postedLabel: string
              soonLabel: string
              tikTokLabel: string
              facebookLabel: string
              postNote: string
              editLabel: string
              rerenderLabel: string
          }
          read: {
              fact: string
              title: string
              shape: "portrait" | "square" | "landscape"
              videoUrl: string | null
              posterUrl: string | null
              captionsUrl: string | null
              captionsLang: string | null
              failedDetail: string | null
              badges: readonly VideoResultBadge[]
              showApprove: boolean
              approveDisabled: boolean
              downloadUrl: string | null
              showShare: boolean
              showPosted: boolean
              canEdit: boolean
              rerenderDisabled: boolean
              isApproved: boolean
              hasFailedRender: boolean
          }
      }

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
