import type { DashboardPeriod } from "@modules/domain/workspace-dashboard"

/** The bounded request for the workspace dashboard. */
export interface GetWorkspaceDashboardRequest {
    /** The workspace selected by the transport; the service proves the caller is its owner or manager. */
    readonly workspaceId: string
    /** The period whose figures are read. */
    readonly period: DashboardPeriod
}
