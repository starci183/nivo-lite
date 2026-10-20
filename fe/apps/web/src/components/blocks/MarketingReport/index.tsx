"use client"

import { useTranslations } from "next-intl"
import { useAgentRights } from "@/hooks/agentSettings"
import { useMarketingReport } from "@/hooks/content"
import { useSlotLabels } from "@/hooks/slot"
import { MarketingReportBase } from "./component"

/** The connected Performance tab of the AI Marketing agent: reads the weekly report and posts it into the Hub. */
export const MarketingReport = () => {
    const t = useTranslations("marketing")
    const slotLabels = useSlotLabels()
    const { canEdit } = useAgentRights()
    const report = useMarketingReport()
    return (
        <MarketingReportBase
            props={{
                slot: report.slot,
                placeholder: report.placeholder,
                slotLabels: slotLabels(t("reportEmpty")),
                words: {
                    title: t("reportTitle"),
                    description: t("reportDescription"),
                    chartTitle: t("chartTitle"),
                    chartNote: t("chartNote"),
                    channelsTitle: t("channelsTitle"),
                    insightTitle: t("insightTitle"),
                    postLabel: t("postLabel"),
                    postHint: t("postHint"),
                },
                isPosting: report.isPosting,
                canPost: canEdit,
            }}
            on={{ post: () => void report.send(), retry: report.reload }}
        />
    )
}
