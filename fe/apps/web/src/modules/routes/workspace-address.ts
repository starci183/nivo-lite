const WORKSPACE_PAGE = /^\/workspaces\/([^/?#]+)/u
const CREATION_STEP = /^\/workspaces\/new(?:[/?#]|$)/u

/**
 * The workspace an address belongs to: the first segment after `/workspaces/` of a workspace page, or the `ws` the steps of creating a
 * workspace carry in their query; `undefined` for any other address (the picker, the sign-in pages, the public pages).
 */
export const workspaceIdOfAddress = (pathname: string, search: string): string | undefined => {
    if (CREATION_STEP.test(pathname)) return new URLSearchParams(search).get("ws") ?? undefined
    const segment = WORKSPACE_PAGE.exec(pathname)?.[1]
    return segment === undefined ? undefined : decodeURIComponent(segment)
}

/** The workspace of the address the browser has open now; the transports (the GraphQL client and the event streams) send it with every operation. */
export const openWorkspaceId = (): string | undefined =>
    typeof window === "undefined" ? undefined : workspaceIdOfAddress(window.location.pathname, window.location.search)
