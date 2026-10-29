"use client"

import { useOverviewData, useOverviewKpis } from "@/hooks/overview"
import { OVERVIEW_KPI_BAND_PLACEHOLDER, OverviewKpiBandBase } from "./component"

/** The connected KPI band: counts of open, waiting, due today, overdue and new leads; inert geometry while the dashboard is read, nothing when it failed (the overview status says so). */
export const OverviewKpiBand = () => {
    const band = useOverviewKpis()
    const { failed } = useOverviewData()
    if (band === undefined && failed) return null
    return (
        <OverviewKpiBandBase props={{ ...(band ?? OVERVIEW_KPI_BAND_PLACEHOLDER), isSkeleton: band === undefined }} />
    )
}
