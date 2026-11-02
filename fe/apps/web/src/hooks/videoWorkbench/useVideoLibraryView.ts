"use client"

import type { VideoLibraryActions } from "@/modules/types"
type VideoLibraryListActions = VideoLibraryActions["library"]
import { useState } from "react"
import { useTranslations } from "next-intl"
import type { BadgeTone } from "@starci/grammar/common"
import { useVideoActions } from "@/hooks/video"
import { useFeatureLifetime, useFeatureReset } from "@/hooks/reuseables"
import { editorHref, GOAL_TEMPLATES, goalLabelKey, stepFor } from "@/modules/video"
import type { ProjectStatus } from "@/modules/video"
import { navigation } from "@/modules/i18n"
import { useGraphQLWithToast } from "@/modules/toast"
import { videoOwnerOf } from "./videoWorkbench.shared"
import type { VideoViewInput } from "./videoWorkbench.shared"
const STATUS_TONE: Record<ProjectStatus, BadgeTone> = {
    draft: "neutral",
    scripting: "accent",
    rendering: "accent",
    ready: "warning",
    approved: "success",
    published: "success",
    archived: "neutral",
}
interface LibraryProjection {
    readonly input: VideoViewInput
    readonly t: ReturnType<typeof useTranslations<"video">>
    readonly common: ReturnType<typeof useTranslations<"common">>
    readonly busy: boolean
    readonly error: string | null
}
const libraryFieldsOf = (context: LibraryProjection) => {
    const { input, t, common, busy, error } = context
    const ui = {
        title: t("tabLibrary"),
        emptyTitle: t("libraryEmptyTitle"),
        emptyBody: t("libraryEmptyBody"),
        newLabel: t("newVideo"),
        openLabel: t("open"),
        menuLabel: common("more"),
        duplicateLabel: t("duplicate"),
        archiveLabel: t("archive"),
        error,
        dismissLabel: t("back"),
        busy,
    }
    if (input.library === null) return { ui, read: null }
    const library = input.library
    return {
        ui,
        read: {
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
            canEdit: library.canEdit,
            isViewOnly: !library.canEdit,
        },
    }
}
/** Duplicate/archive retain their real original command and current-origin local outcome. */
export const useVideoLibraryView = (input: VideoViewInput) => {
    const t = useTranslations("video"),
        common = useTranslations("common"),
        owner = videoOwnerOf(input, "library"),
        lifetime = useFeatureLifetime(owner.isActive, owner.scope),
        actions = useVideoActions(owner),
        router = navigation.useRouter(),
        pathname = navigation.usePathname(),
        report = useGraphQLWithToast(),
        [busy, setBusy] = useState(false),
        [error, setError] = useState<string | null>(null)
    useFeatureReset({
        isActive: input.isActive,
        isReady: input.library !== null,
        scope: owner.scope,
        onReset: () => {
            setBusy(false)
            setError(null)
        },
    })
    const act = (id: string, kind: "duplicate" | "archive") => {
        const current = lifetime.capture()
        if (!current()) return
        setBusy(true)
        setError(null)
        const done = (value: unknown) => {
            if (value === undefined && current()) setError(t("err_default"))
        }
        const task = kind === "duplicate" ? actions.duplicate(id, done) : actions.archive(id, done)
        task.catch((error) => report(() => Promise.reject(error), { showSuccessToast: false })).finally(() => {
            if (current()) setBusy(false)
        })
    }
    const on: VideoLibraryListActions = {
        create: () => {
            if (lifetime.capture()()) router.push(pathname + editorHref("new", "goal"))
        },
        duplicate: (id) => act(id, "duplicate"),
        archive: (id) => act(id, "archive"),
        dismissError: () => setError(null),
    }
    return { ...libraryFieldsOf({ input, t, common, busy, error }), on }
}
