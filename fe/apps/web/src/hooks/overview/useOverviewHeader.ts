"use client"

import { useFormatter, useTranslations } from "next-intl"
import { useMemo } from "react"
import { governanceFrom } from "@/hooks/overviewGovernance"
import { hourInZone, stampOf } from "@/hooks/overviewRows"
import { CONSOLE_ROUTES } from "@/modules/routes"
import { firstNameOf, greetingOf } from "./overview.shared"
import { useOverviewData } from "./useOverviewData"

/** The heading of the overview and its two actions; undefined until the dashboard is read. */
export const useOverviewHeader = () => {
    const t = useTranslations("overview")
    const format = useFormatter()
    const { dashboard, displayName } = useOverviewData()
    return useMemo(() => {
        if (dashboard === undefined) return undefined
        const now = new Date()
        const pending = governanceFrom(dashboard.governance, dashboard.since7).pendingDecisions
        return {
            title: t(greetingOf(hourInZone(now)), { name: firstNameOf(displayName) }),
            description: t("description", { time: stampOf(format, now) }),
            openOfficeLabel: t("openOffice"),
            openOfficeHref: CONSOLE_ROUTES.chat,
            newLeadLabel: t("newLead"),
            newLeadHref: CONSOLE_ROUTES.newLead,
            newLeadIsPrimary: pending === 0,
        }
    }, [dashboard, displayName, format, t])
}
