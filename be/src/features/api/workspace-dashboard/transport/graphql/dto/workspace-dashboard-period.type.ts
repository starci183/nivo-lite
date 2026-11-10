import { registerEnumType } from "@nestjs/graphql"

/** The periods the dashboard switches between; each reads the same data over a different window. */
export const WorkspaceDashboardPeriod = {
    today: "today",
    last_7_days: "last_7_days",
    last_30_days: "last_30_days",
    this_month: "this_month",
} as const

registerEnumType(WorkspaceDashboardPeriod, { name: "WorkspaceDashboardPeriod" })
