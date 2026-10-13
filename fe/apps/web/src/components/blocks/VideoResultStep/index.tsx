"use client"

import { useFormatter, useTranslations } from "next-intl"
import { useState } from "react"
import { editorHref, useVideoFailure } from "@/hooks/video"
import type { ProjectView } from "@/hooks/video"
import { navigation } from "@/modules/i18n"
import { approveVideoProject, shareVideoProject } from "@/modules/db/video/write-approval"
import { markVideoPublished } from "@/modules/db/video/write-project"
import { VideoResultStepBase } from "./component"
import type { VideoResultBadge } from "./component"

/** The command that is running now. */
type ResultBusy = "approve" | "share" | "posted"

/** A line shown above the result. */
interface ResultMessage {
    readonly tone: "negative" | "informative"
    readonly text: string
}

interface VideoResultStepProps {
    readonly project: ProjectView
    readonly canEdit: boolean
}

const shapeOf = (aspect: string): "portrait" | "square" | "landscape" => {
    if (aspect === "9:16") return "portrait"
    return aspect === "1:1" ? "square" : "landscape"
}

/** Step five of the wizard: the finished video, its approval, download, share and the owner's own posting. */
export const VideoResultStep = (props: VideoResultStepProps) => {
    const t = useTranslations("video")
    const format = useFormatter()
    const failure = useVideoFailure()
    const router = navigation.useRouter()
    const pathname = navigation.usePathname()
    const { project } = props
    const [busy, setBusy] = useState<ResultBusy | null>(null)
    const [message, setMessage] = useState<ResultMessage | null>(null)
    const render = project.render
    const approved = project.status === "approved" || project.status === "published"

    const run = async (name: ResultBusy, work: () => Promise<ResultMessage | null>) => {
        setBusy(name)
        setMessage(await work())
        router.refresh()
        setBusy(null)
    }
    const failed = (code: string): ResultMessage => ({
        tone: "negative",
        text: t("actionFailed", { error: failure(code) }),
    })

    const approve = () =>
        run("approve", async () => {
            const done = await approveVideoProject(project.id)
            return done.kind === "ok" ? null : failed(done.code)
        })
    const share = () =>
        run("share", async () => {
            const done = await shareVideoProject(project.id)
            if (done.kind !== "ok") return failed(done.code)
            return { tone: "informative", text: done.value.telegram ? t("sharedTelegram") : t("shared") }
        })
    const posted = () =>
        run("posted", async () => {
            const done = await markVideoPublished(project.id)
            return done.kind === "ok" ? { tone: "informative", text: t("postedNote") } : failed(done.code)
        })

    const badges: ReadonlyArray<VideoResultBadge> = [
        ...(render?.durationMs
            ? [
                  {
                      id: "length",
                      tone: "neutral" as const,
                      text: t("seconds", { n: Math.round(render.durationMs / 1000) }),
                  },
              ]
            : []),
        ...(render?.sizeBytes
            ? [
                  {
                      id: "size",
                      tone: "neutral" as const,
                      text: t("fileSize", {
                          n: format.number(render.sizeBytes / 1_048_576, { maximumFractionDigits: 1 }),
                      }),
                  },
              ]
            : []),
        { id: "aspect", tone: "neutral" as const, text: project.aspect },
        ...(approved
            ? [
                  {
                      id: "approved",
                      tone: "success" as const,
                      text:
                          project.approvedByName === null
                              ? t(`status_${project.status}`)
                              : t("approvedBy", { name: project.approvedByName }),
                  },
              ]
            : []),
    ]
    return (
        <VideoResultStepBase
            props={{
                heading: t("resultHeading"),
                fact: `${t("version", { n: project.renderCount })} - ${t(`status_${project.status}`)}`,
                title: project.title,
                shape: shapeOf(project.aspect),
                videoUrl: render?.videoUrl ?? null,
                posterUrl: render?.posterUrl ?? null,
                failedTitle: render?.status === "failed" ? t("renderFailed") : null,
                failedDetail: render?.error ?? null,
                waitingLabel: t("status_rendering"),
                badges,
                approveHeading: approved ? t("status_approved") : t("approve"),
                approveHelp: approved ? null : t("approveHelp"),
                approveLabel: t("approve"),
                showApprove: !approved,
                approving: busy === "approve",
                approveDisabled: !props.canEdit || project.status !== "ready",
                downloadLabel: t("download"),
                downloadUrl: approved ? (render?.downloadUrl ?? null) : null,
                shareLabel: t("share"),
                showShare: approved,
                sharing: busy === "share",
                postedLabel: t("markPublished"),
                showPosted: project.status === "approved",
                posting: busy === "posted",
                soonLabel: t("soon"),
                tikTokLabel: t("postTikTok"),
                facebookLabel: t("postFacebook"),
                postNote: t("postNote"),
                editLabel: t("editAgain"),
                lockedNote: approved ? t("approvedLocked") : null,
                rerenderLabel: t("rerender"),
                canEdit: props.canEdit,
                rerenderDisabled: !props.canEdit || project.status === "rendering",
                message,
            }}
            on={{
                approve: () => void approve(),
                share: () => void share(),
                posted: () => void posted(),
                edit: () => router.push(`${pathname}${editorHref(project.id, "script")}`),
                rerender: () => router.push(`${pathname}${editorHref(project.id, "preview")}`),
            }}
        />
    )
}
