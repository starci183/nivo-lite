"use client"

import { useTranslations } from "next-intl"
import type { WorkbenchWhyView } from "@/modules/types"

/**
 * The words of the why pane. The path of the run (`agentGraphRun`) is not in the back end contract yet, so there is no recorded view to
 * draw and the pane says the decision has no recorded path; when the read lands, `view` is the one place that fills it.
 */
export const useWorkbenchWhy = () => {
    const t = useTranslations("workbench")
    const view: WorkbenchWhyView | null = null
    return {
        view,
        labels: {
            pathLabel: t("whyPath"),
            factsLabel: t("whyFacts"),
            sourcesLabel: t("whySources"),
            approverLabel: t("whoApproves"),
            timeLabel: t("whyTime"),
            openOnMap: t("openOnMap"),
            missingTitle: t("whyMissingTitle"),
            missingBody: t("whyMissingBody"),
        },
        closeLabel: t("whyClose"),
        openLabel: t("whyOpen"),
        paneLabel: t("whyPane"),
        listLabel: t("whyList"),
    }
}
