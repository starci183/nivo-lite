"use client"

import { useTranslations } from "next-intl"
import { useAgentWorkView } from "@/hooks/agentWork"
import { AgentWorkTabsBase } from "./component"

/** The connected tab line of the Work tab: the view the URL opens, and the move to the other. */
export const AgentWorkTabs = () => {
    const t = useTranslations("agentWork")
    const { view, select } = useAgentWorkView()
    return (
        <AgentWorkTabsBase
            props={{ label: t("viewsLabel"), workLabel: t("viewWork"), runsLabel: t("viewRuns"), selected: view }}
            on={{ select }}
        />
    )
}
