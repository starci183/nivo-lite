"use client"

import { useTranslations } from "next-intl"
import { useState } from "react"
import type { BadgeTone } from "@starci/grammar/common"
import {
    editorHref,
    GOAL_TEMPLATES,
    goalLabelKey,
    stepFor,
    useVideoActions,
    useVideoLibraryData,
    type ProjectStatus,
} from "@/hooks/video"
import { navigation } from "@/modules/i18n"
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

/** The library of the workspace's videos; while one is being scripted or rendered the page reads again every few seconds. */
export const VideoLibrary = () => {
    const library = useVideoLibraryData()
    const t = useTranslations("video")
    const { archive, duplicate } = useVideoActions()
    const router = navigation.useRouter()
    const pathname = navigation.usePathname()
    const [busy, setBusy] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const act = async (work: () => Promise<unknown>) => {
        setBusy(true)
        setError(null)
        const done = await work()
        if (done === undefined) setError(t("err_default"))
        setBusy(false)
    }

    return (
        <VideoLibraryBase
            props={{
                title: t("tabLibrary"),
                meta: t("libraryCount", { n: library.projects.length }),
                entries: library.projects.map((project) => {
                    const render = project.render
                    const working = render?.status === "rendering" || render?.status === "queued"
                    const seconds = render?.durationMs ? Math.round(render.durationMs / 1000) : project.targetSeconds
                    const renders = project.renderCount > 0 ? ` - ${t("renders", { n: project.renderCount })}` : ""
                    const goal = GOAL_TEMPLATES.find((entry) => entry.goal === project.goal)?.goal
                    return {
                        id: project.id,
                        title: project.title,
                        posterUrl: render?.posterUrl ?? null,
                        noPoster: working ? t("status_rendering") : t("notRendered"),
                        statusLabel: t(`status_${project.status}`),
                        statusTone: STATUS_TONE[project.status],
                        goalLabel: goal === undefined ? "" : t(goalLabelKey(goal)),
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
                viewOnly: library.canEdit ? null : t("viewOnly"),
                error,
                dismissLabel: t("back"),
                canEdit: library.canEdit,
                busy,
            }}
            on={{
                create: () => router.push(`${pathname}${editorHref("new", "goal")}`),
                duplicate: (id) => void act(() => duplicate(id)),
                archive: (id) => void act(() => archive(id)),
                dismissError: () => setError(null),
            }}
        />
    )
}
