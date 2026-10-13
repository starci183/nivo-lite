"use client"

import { useTranslations } from "next-intl"
import { useMemo } from "react"
import { CONSOLE_ROUTES, responsibilitiesHref } from "@/modules/routes"
import { leadsThisWeek } from "./overview.shared"
import { useOverviewData } from "./useOverviewData"
import { useOverviewRows } from "./useOverviewRows"

/** The KPI band: the five counts, each linking to its filtered list; undefined until the dashboard is read. */
export const useOverviewKpis = () => {
    const t = useTranslations("overview")
    const { dashboard } = useOverviewData()
    const data = useOverviewRows()
    return useMemo(() => {
        if (dashboard === undefined || data === undefined) return undefined
        const { now, rows, active } = data
        return {
            title: t("ownerBelow"),
            label: t("kpiAria"),
            kpis: [
                {
                    id: "open",
                    label: t("kpiOpen"),
                    value: rows.filter((row) => row.status === "open").length,
                    href: responsibilitiesHref("status=open"),
                    isAlert: false,
                },
                {
                    id: "waiting",
                    label: t("kpiWaiting"),
                    value: rows.filter((row) => row.status === "waiting_approval").length,
                    href: responsibilitiesHref("status=waiting_approval"),
                    isAlert: true,
                },
                {
                    id: "today",
                    label: t("kpiToday"),
                    value: active.filter((row) => row.isDueToday).length,
                    href: responsibilitiesHref("due=today"),
                    isAlert: false,
                },
                {
                    id: "overdue",
                    label: t("kpiOverdue"),
                    value: active.filter((row) => row.isOverdue).length,
                    href: responsibilitiesHref("due=overdue"),
                    isAlert: true,
                },
                {
                    id: "leads",
                    label: t("kpiLeads"),
                    value: leadsThisWeek(dashboard.leads, now),
                    href: CONSOLE_ROUTES.leads,
                    isAlert: false,
                },
            ],
        }
    }, [dashboard, data, t])
}
