"use client"

import { useOverviewKpis } from "@/hooks/overview"
import { OverviewKpiBandBase } from "./component"

/** The connected KPI band: counts of open, waiting, due today, overdue and new leads. */
export const OverviewKpiBand = () => {
    const band = useOverviewKpis()
    if (band === undefined) return null
    return <OverviewKpiBandBase props={band} />
}
