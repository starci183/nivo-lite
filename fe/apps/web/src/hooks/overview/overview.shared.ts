import { isTestRunName } from "@/hooks/overviewFigures"
import type { DashboardType } from "@/hooks/swr"

/** The dashboard as the back end answers it. */
type Dashboard = DashboardType

const WEEK_MS = 7 * 86_400_000

/** The greeting for an hour of the day. */
export const greetingOf = (hour: number): "morning" | "afternoon" | "evening" => {
    if (hour < 12) return "morning"
    return hour < 18 ? "afternoon" : "evening"
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
