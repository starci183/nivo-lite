"use client"

import { useTranslations } from "next-intl"
import type { DescriptionListStatItem } from "@starci/grammar/common"
import { HIRING_TAB_IDS } from "@/hooks/hiring"
import { tabCounts, useHiringWorkbenchView } from "@/hooks/hiringWorkbench"
import type { HiringWorkbenchData } from "@/hooks/hiringWire"
import { HiringWorkbenchBase } from "./component"
import type { HiringWorkbenchBaseProps } from "./component"

/** What the page hands the block: the deep link of `?tab=` and `?focus=`, and the installation the workbench is opened for. */
interface HiringWorkbenchProps {
    readonly initialTab: string | null
    readonly focus: string | null
    readonly installationId: string | null
}

type WorkbenchState = HiringWorkbenchBaseProps["props"]["state"]

/** Where the read stands: refused, failed, still running, or done. */
const stateOf = (isForbidden: boolean, isFailed: boolean, hasData: boolean): WorkbenchState => {
    if (isForbidden) return "forbidden"
    if (isFailed) return "failed"
    return hasData ? "ready" : "loading"
}

/** The connected Hiring workbench: reads the hiring board from the back end GraphQL API and draws the six surfaces as tabs. */
export const HiringWorkbench = (props: HiringWorkbenchProps) => {
    const t = useTranslations("workbenchFigures")
    const view = useHiringWorkbenchView(props.initialTab, props.focus)
    const { data } = view
    const counts = data === undefined ? {} : tabCounts(data)
    const figuresOf = (board: HiringWorkbenchData): ReadonlyArray<DescriptionListStatItem> => [
        {
            id: "roles",
            term: t("hrRoles"),
            description: String(board.figures.openRoles),
            meta: t("hrRolesMeta", { n: board.figures.totalRoles }),
        },
        {
            id: "pipeline",
            term: t("hrPipeline"),
            description: String(board.figures.pipeline),
            meta: t("hrPipelineMeta"),
        },
        {
            id: "interviews",
            term: t("hrInterviews"),
            description: String(board.figures.interviewsWeek),
            meta: t("hrInterviewsMeta"),
        },
        {
            id: "offers",
            term: t("hrOffers"),
            description: String(board.figures.offersWaiting + board.figures.offersSent),
            meta: t("hrOffersMeta", { waiting: board.figures.offersWaiting, sent: board.figures.offersSent }),
        },
    ]
    const labelOf = (id: string): string => {
        const count = counts[id] ?? 0
        const name = t(`hrTab${id.slice(0, 1).toUpperCase()}${id.slice(1)}`)
        return count > 0 ? `${name} (${count})` : name
    }
    return (
        <HiringWorkbenchBase
            props={{
                installationId: props.installationId,
                state: stateOf(view.isForbidden, view.isFailed, data !== undefined),
                figures: data === undefined ? [] : figuresOf(data),
                tabs: HIRING_TAB_IDS.map((id) => ({ id, label: labelOf(id) })),
                tab: view.tab,
                data,
                jobId: view.jobId,
                opened: view.opened,
                failedTitle: t("hrFailedTitle"),
                failedBody: t("hrFailedBody"),
                forbiddenTitle: t("hrForbiddenTitle"),
                forbiddenBody: t("hrForbiddenBody"),
            }}
            on={{
                tab: view.setTab,
                openPipeline: view.openPipeline,
                job: view.setJobId,
                open: view.open,
                openAndShow: view.openAndShow,
                close: view.close,
            }}
        />
    )
}
