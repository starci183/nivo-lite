/** Workspace-scoped arguments for requestContentMonthPlan. */
export interface RequestContentMonthPlanRequest {
    /** The selected workspace, verified by the domain service. */
    readonly workspaceId: string
    /** The requested calendar month in YYYY-MM form. */
    readonly month: string
}
