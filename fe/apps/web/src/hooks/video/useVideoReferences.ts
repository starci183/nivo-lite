import { useFormatter, useTranslations } from "next-intl"
import { useMemo } from "react"
import type { DescriptionListStatItem } from "@starci/grammar/common"
import { useQueryVideoFiguresSwr, useQueryVideoMediaSwr, useQueryVideoSourcesSwr } from "@/hooks/swr"
import { mediaItemOf } from "./video.shared"
import type { SourceChoice } from "./video.shared"

/** The sources, the media library and the figures the video workbench offers around the project. */
export const useVideoReferences = () => {
    const t = useTranslations("video")
    const format = useFormatter()
    const sourcesQuery = useQueryVideoSourcesSwr()
    const mediaQuery = useQueryVideoMediaSwr()
    const figuresQuery = useQueryVideoFiguresSwr()
    const media = useMemo(() => (mediaQuery.data ?? []).map(mediaItemOf), [mediaQuery.data])
    const sources = useMemo<ReadonlyArray<SourceChoice>>(
        () => (sourcesQuery.data ?? []).map((source) => ({ ...source, topic: source.topic ?? null })),
        [sourcesQuery.data],
    )
    const figures = useMemo<ReadonlyArray<DescriptionListStatItem>>(() => {
        const data = figuresQuery.data
        return [
            {
                id: "rendering",
                term: t("figRendering"),
                description: data ? format.number(data.rendering) : "",
                meta: t("figRenderingMeta", { n: data?.scripting ?? 0 }),
            },
            {
                id: "ready",
                term: t("figReady"),
                description: data ? format.number(data.readyToPublish) : "",
                meta: t("figReadyMeta", { approved: data?.approved ?? 0 }),
            },
            {
                id: "published",
                term: t("figPublished"),
                description: data ? format.number(data.published30) : "",
                meta: t("figPublishedMeta"),
            },
            {
                id: "credits",
                term: t("figCredits"),
                description: data ? format.number(data.credits30) : "",
                meta: t("figCreditsMeta"),
            },
        ]
    }, [figuresQuery.data, format, t])
    return {
        sources,
        media,
        figures,
        figuresFailed: Boolean(figuresQuery.error),
        isLoading: sourcesQuery.isLoading || mediaQuery.isLoading || figuresQuery.isLoading,
    }
}
