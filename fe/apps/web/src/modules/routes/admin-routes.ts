/** The destinations of the platform-admin console, named once. */
export const ADMIN_ROUTES = {
    workspaces: "/admin",
    health: "/admin/health",
} as const

/** The filters of the admin workspace list. */
export type AdminListFilter = "all" | "attention" | "unpaid" | "idle"

/** The admin overview of one workspace. */
export const adminWorkspacePath = (workspaceId: string): string => `${ADMIN_ROUTES.workspaces}/${workspaceId}`

/** The admin workspace list with a filter and a search kept in the address. */
export const adminListPath = (filter: AdminListFilter, query: string): string => {
    const pairs = new URLSearchParams()
    if (filter !== "all") pairs.set("f", filter)
    if (query !== "") pairs.set("q", query)
    const text = pairs.toString()
    return text === "" ? ADMIN_ROUTES.workspaces : `${ADMIN_ROUTES.workspaces}?${text}`
}
