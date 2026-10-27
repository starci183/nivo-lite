"use client"

import { useTranslations } from "next-intl"
import { useContentRibbon, useContentWorkbench } from "@/hooks/content"
import { slotOfSwr, useSlotLabels } from "@/hooks/slot"
import { ContentRibbonBase } from "./component"

/** The connected ribbon of the Content workbench, read from the content workbench query. */
export const ContentRibbon = () => {
    const t = useTranslations("content")
    const frame = useTranslations("agentDashboard")
    const slotLabels = useSlotLabels()
    const workbench = useContentWorkbench()
    const data = workbench.data
    const items = useContentRibbon(data?.figures ?? undefined)
    const isFailed = Boolean(workbench.error) || data?.figures === null
    return (
        <ContentRibbonBase
            props={{
                label: frame("ribbonAria"),
                slot: slotOfSwr({
                    data: data === undefined || isFailed ? undefined : items,
                    error: isFailed ? t("loadFailedBody") : undefined,
                    isLoading: data === undefined && !workbench.error,
                }),
                labels: slotLabels(t("loadFailedTitle")),
                placeholder: items,
            }}
            on={{ retry: workbench.reload }}
        />
    )
}
