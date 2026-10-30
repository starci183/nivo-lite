import type { WorkDashboardDirectory } from "./agents.port"

/** The dashboard work lines in the setup mode (the cli seed), which runs no dashboard: none. */
export const noWorkLines = (): ReturnType<WorkDashboardDirectory["dashboardList"]> => Promise.resolve([])
