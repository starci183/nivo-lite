"use client"

import { useFormatter, useTranslations } from "next-intl"
import { useMemo } from "react"
import { groupByOwner, stampOf } from "@/hooks/overviewRows"
import { CONSOLE_ROUTES } from "@/modules/routes"
import { trimGroups } from "./overview.shared"
import { useOverviewData } from "./useOverviewData"
import { useOverviewRows } from "./useOverviewRows"

/** The open work by owner with the words of its empty state; undefined until the dashboard is read. */
export const useOverviewOwners = () => {
    const t = useTranslations("overview")
    const format = useFormatter()
    const { dashboard } = useOverviewData()
    const data = useOverviewRows()
    return useMemo(() => {
        if (dashboard === undefined || data === undefined) return undefined
        const hasAgents = dashboard.agents.length > 0
        return {
            title: t("byOwner"),
            verifiedLabel: t("verified", { time: stampOf(format, data.now) }),
            groups: trimGroups(groupByOwner(data.active)),
            emptyMessage: t("emptyMessage"),
            emptyDescription: hasAgents ? t("emptyWithAgents") : t("emptyNoAgents"),
            emptyActionLabel: hasAgents ? t("emptyActionLead") : t("emptyActionModules"),
            emptyHref: hasAgents ? CONSOLE_ROUTES.newLead : CONSOLE_ROUTES.modules,
        }
    }, [dashboard, data, format, t])
}
