/** The root of the workspace picker and of every page that belongs to one workspace. */
const WORKSPACES_ROUTE = "/workspaces"

/**
 * The address of a page of one workspace: `path` is the page's own path with its query and anchor (`/agents`, `/leads/abc?tab=x`),
 * and the workspace the person works in is the first segment of the address. Every link, redirect and push to a console page is
 * built here and nowhere else.
 */
export const workspaceHref = (workspaceId: string, path: string): string => {
    const root = `${WORKSPACES_ROUTE}/${encodeURIComponent(workspaceId)}`
    return path === "/" ? root : `${root}${path}`
}

const WORKSPACE_PREFIX = /^\/workspaces\/[^/]+/u

/** The path of a page inside its workspace: `/workspaces/abc/leads/1` gives `/leads/1`; an address outside a workspace comes back as it is. */
export const pathInWorkspace = (pathname: string): string => pathname.replace(WORKSPACE_PREFIX, "") || "/"
