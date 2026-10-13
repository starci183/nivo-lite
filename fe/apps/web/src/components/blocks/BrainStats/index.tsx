"use client"

import { useTranslations } from "next-intl"
import { useBrainCommand, useBrainStats } from "@/hooks/brain"
import { BrainStatsBase } from "./component"

/** The connected Second Brain figures: offers to bring the brain up to date when something is due. */
export const BrainStats = () => {
    const t = useTranslations("brain")
    const command = useBrainCommand()
    const { figures, isMaintenanceDue, isLoading } = useBrainStats()
    return (
        <BrainStatsBase
            props={{
                label: t("statsLabel"),
                isSkeleton: isLoading,
                figures: [
                    {
                        id: "docs",
                        term: t("statDocs"),
                        value: String(figures.documents),
                        meta: t("statDocsMeta", { n: figures.indexing }),
                    },
                    {
                        id: "facts",
                        term: t("statFacts"),
                        value: String(figures.facts),
                        meta: t("statFactsMeta", { n: figures.scheduled }),
                    },
                    {
                        id: "review",
                        term: t("statReview"),
                        value: String(figures.review),
                        meta: t("statReviewMeta", { n: figures.conflicts }),
                    },
                    {
                        id: "lessons",
                        term: t("statLessons"),
                        value: String(figures.lessons),
                        meta: t("statLessonsMeta", { n: figures.proposedLessons }),
                    },
                    { id: "gaps", term: t("statGaps"), value: String(figures.gaps), meta: t("statGapsMeta") },
                ],
                processing:
                    figures.processing > 0
                        ? { title: t("processingTitle", { count: figures.processing }), body: t("processingBody") }
                        : undefined,
                maintain: isMaintenanceDue
                    ? { title: t("maintainTitle"), body: t("maintainBody"), actionLabel: t("maintainAction") }
                    : undefined,
            }}
            on={{ maintain: () => command.send("brain.maintain", undefined) }}
        />
    )
}
