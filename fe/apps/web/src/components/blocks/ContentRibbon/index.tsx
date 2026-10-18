"use client"

import { useTranslations } from "next-intl"
import { useContentRibbon, useContentWorkbench } from "@/hooks/content"
import { ContentRibbonBase } from "./component"

/** The connected ribbon of the Content workbench, read from the content workbench query. */
export const ContentRibbon = () => {
    const t = useTranslations("content")
    const frame = useTranslations("agentDashboard")
    const workbench = useContentWorkbench()
    const data = workbench.data
    const items = useContentRibbon(data?.figures ?? undefined)
    return (
        <ContentRibbonBase
            props={{
                label: frame("ribbonAria"),
                isLoading: data === undefined && !workbench.error,
                isFailed: Boolean(workbench.error) || data?.figures === null,
                failedTitle: t("loadFailedTitle"),
                failedBody: t("loadFailedBody"),
                items,
            }}
        />
    )
}
