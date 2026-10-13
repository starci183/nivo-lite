"use client"

import { useTranslations } from "next-intl"
import { useMemo } from "react"
import { toRowModels } from "@/hooks/overviewRows"
import { realResponsibilities } from "./overview.shared"
import { useOverviewData } from "./useOverviewData"

/** The open responsibilities of the workspace resolved for display, test runs left out; undefined until the dashboard is read. */
export const useOverviewRows = () => {
    const t = useTranslations("responsibilities")
    const { dashboard } = useOverviewData()
    return useMemo(() => {
        if (dashboard === undefined) return undefined
        const now = new Date()
        const rows = toRowModels(realResponsibilities(dashboard.responsibilities), dashboard.agents, now, t)
        return { now, rows, active: rows.filter((row) => row.status !== "done") }
    }, [dashboard, t])
}
