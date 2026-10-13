/** Every key the browser storage holds: the one place a key is named. */
export enum StorageId {
    /** The workspace the person works in; the GraphQL client sends it as `X-Workspace-Id`. */
    ActiveWorkspaceId = "NIVO_ACTIVE_WORKSPACE_ID",
}

/** The cookie that remembers the active workspace for the server-rendered console pages, which still read it until they move to GraphQL. */
export const WORKSPACE_COOKIE = "NIVO_WORKSPACE"
