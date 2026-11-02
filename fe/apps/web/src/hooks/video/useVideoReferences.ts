"use client"
import { useFormatter, useTranslations } from "next-intl"
import { useMemo } from "react"
import { useQueryVideoFiguresSwr, useQueryVideoSourcesSwr } from "@/hooks/swr"
import type { SourceChoice } from "@/modules/video"
import type { WorkbenchFigureData } from "@/modules/types"

/** Sources belong to the editor; figures belong to the normal ribbon, each retaining its authoritative read. */
export const useVideoReferences = (isActive = true, withSources = true, withFigures = true) => {
    const t = useTranslations("video"),
        format = useFormatter()
    const sourcesQuery = useQueryVideoSourcesSwr(isActive && withSources),
        figuresQuery = useQueryVideoFiguresSwr(isActive && withFigures)
    const sources = useMemo<ReadonlyArray<SourceChoice>>(
        () => (sourcesQuery.data ?? []).map((source) => ({ ...source, topic: source.topic ?? null })),
        [sourcesQuery.data],
    )
    const figures = useMemo<ReadonlyArray<WorkbenchFigureData>>(() => {
        const data = figuresQuery.data
        return [
            {
                id: "rendering",
                term: t("figRendering"),
                value: data ? format.number(data.rendering) : "",
                meta: t("figRenderingMeta", { n: data?.scripting ?? 0 }),
            },
            {
                id: "ready",
                term: t("figReady"),
                value: data ? format.number(data.readyToPublish) : "",
                meta: t("figReadyMeta", { approved: data?.approved ?? 0 }),
            },
            {
                id: "published",
                term: t("figPublished"),
                value: data ? format.number(data.published30) : "",
                meta: t("figPublishedMeta"),
            },
            {
                id: "credits",
                term: t("figCredits"),
                value: data ? format.number(data.credits30) : "",
                meta: t("figCreditsMeta"),
            },
        ]
    }, [figuresQuery.data, format, t])
    return { sources, figures, reads: { sources: sourcesQuery, figures: figuresQuery } }
}
