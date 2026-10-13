"use client"

import { useTranslations } from "next-intl"
import { useHiringWorkbench } from "@/hooks/hiring"
import { HiringFiguresBase } from "./component"
import type { HiringFiguresBaseProps } from "./component"

type FiguresState = HiringFiguresBaseProps["props"]["state"]

/** Where the read of the board stands. */
const stateOf = (isForbidden: boolean, isFailed: boolean, hasBoard: boolean): FiguresState => {
    if (isForbidden) return "forbidden"
    if (isFailed) return "failed"
    return hasBoard ? "ready" : "loading"
}

/** The connected figures strip of the Hiring workbench: the four real numbers, or the notice when the board cannot be read. */
export const HiringFigures = () => {
    const t = useTranslations("workbenchFigures")
    const { board, hasBoard, isFailed, isForbidden } = useHiringWorkbench()
    const figures = board.figures
    const state = stateOf(isForbidden, isFailed, hasBoard)
    return (
        <HiringFiguresBase
            props={{
                state,
                ariaLabel: t("hrTabJobs"),
                figures: [
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
                ],
                noticeTitle: t(state === "forbidden" ? "hrForbiddenTitle" : "hrFailedTitle"),
                noticeBody: t(state === "forbidden" ? "hrForbiddenBody" : "hrFailedBody"),
            }}
        />
    )
}
