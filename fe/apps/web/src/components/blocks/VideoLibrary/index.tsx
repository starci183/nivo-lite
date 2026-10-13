"use client"

import { useLocale, useTranslations } from "next-intl"
import { useState } from "react"
import type { BadgeTone } from "@starci/grammar/common"
import { editorHref, GOAL_TEMPLATES, stepFor, useVideoFailure, useVideoRefresh } from "@/hooks/video"
import type { ProjectStatus, ProjectView } from "@/hooks/video"
import { navigation } from "@/modules/i18n"
import { archiveVideoProject, duplicateVideoProject } from "@/modules/db/video/write-project"
import { VideoLibraryBase } from "./component"

const STATUS_TONE: Record<ProjectStatus, BadgeTone> = {
    draft: "neutral",
    scripting: "accent",
    rendering: "accent",
    ready: "warning",
    approved: "success",
    published: "success",
    archived: "neutral",
}

interface VideoLibraryProps {
    readonly projects: ReadonlyArray<ProjectView>
    readonly canEdit: boolean
}

/** The library of the workspace's videos; while one is being scripted or rendered the page reads again every few seconds. */
export const VideoLibrary = (props: VideoLibraryProps) => {
    const t = useTranslations("video")
    const lang = useLocale() === "en" ? "en" : "vi"
    const failure = useVideoFailure()
    const router = navigation.useRouter()
    const pathname = navigation.usePathname()
    const [busy, setBusy] = useState(false)
    const [error, setError] = useState<string | null>(null)
    useVideoRefresh(props.projects.some((entry) => entry.status === "scripting" || entry.status === "rendering"))

    const act = async (work: () => Promise<{ readonly kind: string; readonly code?: string }>) => {
        setBusy(true)
        setError(null)
        const done = await work()
        if (done.kind !== "ok") setError(t("actionFailed", { error: failure(done.code ?? "default") }))
        router.refresh()
        setBusy(false)
    }

    return (
        <VideoLibraryBase
            props={{
                title: t("tabLibrary"),
                meta: t("libraryCount", { n: props.projects.length }),
                entries: props.projects.map((project) => {
                    const render = project.render
                    const working = render?.status === "rendering" || render?.status === "queued"
                    const seconds = render?.durationMs ? Math.round(render.durationMs / 1000) : project.targetSeconds
                    const renders = project.renderCount > 0 ? ` - ${t("renders", { n: project.renderCount })}` : ""
                    return {
                        id: project.id,
                        title: project.title,
                        posterUrl: render?.posterUrl ?? null,
                        noPoster: working ? t("status_rendering") : t("notRendered"),
                        statusLabel: t(`status_${project.status}`),
                        statusTone: STATUS_TONE[project.status],
                        goalLabel: GOAL_TEMPLATES.find((entry) => entry.goal === project.goal)?.label[lang] ?? "",
                        aspectLabel: project.aspect,
                        facts: `${t("seconds", { n: seconds })}${renders} - ${t("views")}: ${t("viewsNone")}`,
                        href: editorHref(project.id, stepFor(project.status, project.script.length)),
                        archiveDisabled: project.status === "scripting" || project.status === "rendering",
                    }
                }),
                emptyTitle: t("libraryEmptyTitle"),
                emptyBody: t("libraryEmptyBody"),
                newLabel: t("newVideo"),
                openLabel: t("open"),
                duplicateLabel: t("duplicate"),
                archiveLabel: t("archive"),
                viewOnly: props.canEdit ? null : t("viewOnly"),
                error,
                dismissLabel: t("back"),
                canEdit: props.canEdit,
                busy,
            }}
            on={{
                create: () => router.push(`${pathname}${editorHref("new", "goal")}`),
                duplicate: (id) => void act(() => duplicateVideoProject(id)),
                archive: (id) => void act(() => archiveVideoProject(id, true)),
                dismissError: () => setError(null),
            }}
        />
    )
}
