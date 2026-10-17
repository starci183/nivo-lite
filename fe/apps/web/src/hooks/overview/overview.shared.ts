import { isTestRunName } from "@/hooks/overviewFigures"
import type { OwnerGroupModel } from "@/hooks/overviewRows"
import type { DashboardType } from "@/hooks/swr"

/** The dashboard as the back end answers it. */
type Dashboard = DashboardType

/** How many open rows the overview shows across owners: a glance, not a wall. */
const ROW_LIMIT = 6
const WEEK_MS = 7 * 86_400_000

/** The greeting for an hour of the day. */
export const greetingOf = (hour: number): "morning" | "afternoon" | "evening" => {
    if (hour < 12) return "morning"
    return hour < 18 ? "afternoon" : "evening"
}

/** Keeps the first few open rows across owners. */
export const trimGroups = (groups: ReadonlyArray<OwnerGroupModel>): Array<OwnerGroupModel> => {
    let left = ROW_LIMIT
    const kept: Array<OwnerGroupModel> = []
    for (const group of groups) {
        if (left <= 0) break
        const rows = group.rows.slice(0, left)
        left -= rows.length
        kept.push({ ...group, rows })
    }
    return kept
}

/** The first word of a person's name. */
export const firstNameOf = (name: string | undefined): string => (name ?? "").trim().split(/\s+/)[0] ?? ""

/** How many leads came in during the last week, test runs left out. */
export const leadsThisWeek = (leads: Dashboard["leads"], now: Date): number =>
    leads.filter(
        (lead) =>
            !isTestRunName(lead.contactName, lead.company) &&
            new Date(lead.createdAt).getTime() >= now.getTime() - WEEK_MS,
    ).length

/** The responsibilities of the dashboard without the test runs. */
export const realResponsibilities = (rows: Dashboard["responsibilities"]): Dashboard["responsibilities"] =>
    rows.filter((row) => !isTestRunName(row.lead.contactName, row.lead.company))
