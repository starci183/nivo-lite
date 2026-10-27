"use client"

import { useTranslations } from "next-intl"
import { useHiringWorkbench } from "@/hooks/hiring"
import { useSlotLabels } from "@/hooks/slot"
import { HiringFiguresBase } from "./component"

/** The connected figures strip of the Hiring workbench: the four real numbers, or the notice when the board cannot be read. */
export const HiringFigures = () => {
    const t = useTranslations("workbenchFigures")
    const slotLabels = useSlotLabels()
    const { board, hasBoard, isFailed, isForbidden, reload } = useHiringWorkbench()
    const figures = board.figures
    const items = [
        {
            id: "roles",
            term: t("hrRoles"),
            description: String(figures.openRoles),
            meta: t("hrRolesMeta", { n: figures.totalRoles }),
        },
        {
            id: "pipeline",
            term: t("hrPipeline"),
            description: String(figures.pipeline),
            meta: t("hrPipelineMeta"),
        },
        {
            id: "interviews",
            term: t("hrInterviews"),
            description: String(figures.interviewsWeek),
            meta: t("hrInterviewsMeta"),
        },
        {
            id: "offers",
            term: t("hrOffers"),
            description: String(figures.offersWaiting + figures.offersSent),
            meta: t("hrOffersMeta", { waiting: figures.offersWaiting, sent: figures.offersSent }),
        },
    ]
    return (
        <HiringFiguresBase
            props={{
                label: t("hrTabJobs"),
                slot: {
                    items: hasBoard && !isForbidden ? items : undefined,
                    isForbidden,
                    isError: isFailed && !isForbidden,
                    isLoading: !hasBoard && !isFailed && !isForbidden,
                },
                labels: {
                    ...slotLabels(t("hrFailedTitle")),
                    forbidden: t("hrForbiddenTitle"),
                    error: t("hrFailedTitle"),
                },
                placeholder: items,
            }}
            on={{ retry: reload }}
        />
    )
}
