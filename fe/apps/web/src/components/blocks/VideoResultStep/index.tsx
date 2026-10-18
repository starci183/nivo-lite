"use client"

import { useVideoProjectData, editorHref, useVideoRelease, useVideoFailure } from "@/hooks/video"
import { useFormatter, useTranslations } from "next-intl"
import { useState } from "react"
import { navigation } from "@/modules/i18n"
import { VideoResultStepBase, type VideoResultBadge } from "./component"

/** The command that is running now. */
type ResultBusy = "approve" | "share" | "posted"

/** A line shown above the result. */
interface ResultMessage {
    readonly tone: "negative" | "informative"
    readonly text: string
}

/** What the page tells the step. */
interface VideoResultStepProps {
    /** The step named in the address. */
    readonly tab: string | null
    /** The video named in the address, or the new-video command. */
    readonly focus: string | null
}

const shapeOf = (aspect: string): "portrait" | "square" | "landscape" => {
    if (aspect === "9:16") return "portrait"
    return aspect === "1:1" ? "square" : "landscape"
}

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

const badgesOf = (
    project: ReturnType<typeof useVideoProjectData>["project"],
    t: ReturnType<typeof useTranslations<"video">>,
    format: ReturnType<typeof useFormatter>,
): ReadonlyArray<VideoResultBadge> => {
    const render = project.render
    const approved = project.status === "approved" || project.status === "published"
    return [
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
}

/** Step five of the wizard: the finished video, its approval, download, share and the owner's own posting. */
export const VideoResultStep = (props: VideoResultStepProps) => {
    const editor = useVideoProjectData(props)
    const t = useTranslations("video")
    const format = useFormatter()
    const failure = useVideoFailure()
    const actions = useVideoRelease()
    const router = navigation.useRouter()
    const pathname = navigation.usePathname()
    const { project } = editor
    const [busy, setBusy] = useState<ResultBusy | null>(null)
    const [message, setMessage] = useState<ResultMessage | null>(null)
    const render = project.render
    const approved = project.status === "approved" || project.status === "published"

    const run = async (name: ResultBusy, work: () => Promise<ResultMessage | null>) => {
        setBusy(name)
        setMessage(await work())
        setBusy(null)
    }
    const approve = () =>
        run("approve", async () => {
            await actions.approve(project.id)
            return null
        })
    const share = () =>
        run("share", async () => {
            const done = await actions.share(project.id)
            if (done === undefined) return null
            return { tone: "informative", text: done.telegram ? t("sharedTelegram") : t("shared") }
        })
    const posted = () =>
        run("posted", async () => {
            const done = await actions.publish(project.id)
            return done !== undefined ? { tone: "informative", text: t("postedNote") } : null
        })

    const badges = badgesOf(project, t, format)
    const statusLabel = t(`status_${project.status}`)
    return (
        <VideoResultStepBase
            props={{
                ...copyOf(t),
                fact: `${t("version", { n: project.renderCount })} - ${statusLabel}`,
                title: project.title,
                shape: shapeOf(project.aspect),
                videoUrl: render?.videoUrl ?? null,
                posterUrl: render?.posterUrl ?? null,
                captionsUrl: render?.captionsUrl ?? null,
                captionsLang: render?.captionsLang ?? null,
                failedTitle: render?.status === "failed" ? t("renderFailed") : null,
                failedDetail: render?.error ? failure(render.error) : null,
                badges,
                approveHeading: approved ? t("status_approved") : t("approve"),
                approveHelp: approved ? null : t("approveHelp"),
                showApprove: !approved,
                approving: busy === "approve",
                approveDisabled: !editor.canEdit || project.status !== "ready",
                downloadUrl: approved ? (render?.downloadUrl ?? null) : null,
                showShare: approved,
                sharing: busy === "share",
                showPosted: project.status === "approved",
                posting: busy === "posted",
                lockedNote: approved ? t("approvedLocked") : null,
                canEdit: editor.canEdit,
                rerenderDisabled: !editor.canEdit || project.status === "rendering",
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
