/** Every key the browser storage holds: the one place a key is named. */
export enum StorageId {
    /** The workspace the person works in; the GraphQL client sends it as `X-Workspace-Id`. */
    ActiveWorkspaceId = "NIVO_ACTIVE_WORKSPACE_ID",
    /** Which console rails each person collapsed, by person id. */
    RailCollapsed = "NIVO_RAIL_COLLAPSED",
    /** Which notices the reader closed, one record keyed by notice. */
    Dismissed = "NIVO_DISMISSED",
    /** The Zalo connection whose permission page the browser was sent to from its own page, so the return lands back there. */
    ZaloReturn = "NIVO_ZALO_RETURN",
}

/** The cookie that remembers the active workspace for the server-rendered console pages, which still read it until they move to GraphQL. */
export const WORKSPACE_COOKIE = "NIVO_WORKSPACE"
