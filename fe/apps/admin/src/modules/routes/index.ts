/** The destinations of the platform-admin app, named once. The app owns the root of its host. */
export const ADMIN_ROUTES = {
    workspaces: "/",
    health: "/health",
} as const

/** The filters of the workspace list. */
type AdminListFilter = "all" | "attention" | "unpaid" | "idle"

/** The overview of one workspace. */
export const adminWorkspacePath = (workspaceId: string): string => `/${workspaceId}`

/** The workspace list with a filter and a search kept in the address. */
export const adminListPath = (filter: AdminListFilter, query: string): string => {
    const pairs = new URLSearchParams()
    if (filter !== "all") pairs.set("f", filter)
    if (query !== "") pairs.set("q", query)
    const text = pairs.toString()
    return text === "" ? ADMIN_ROUTES.workspaces : `${ADMIN_ROUTES.workspaces}?${text}`
}
