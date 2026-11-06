/** Every key the browser storage holds: the one place a key is named. */
export enum StorageId {
    /** The workspace a Zalo authorization was started from: the fixed return address of Zalo cannot name it, so the browser forwards the return into it. */
    ZaloOAuthWorkspace = "NIVO_ZALO_OAUTH_WORKSPACE",
    /** Which console rails each person collapsed, by person id. */
    RailCollapsed = "NIVO_RAIL_COLLAPSED",
    /** Which notices the reader closed, one record keyed by notice. */
    /** The Zalo connection whose permission page the browser was sent to from its own page, so the return lands back there. */
    ZaloReturn = "NIVO_ZALO_RETURN",
    /** The files of an upload batch whose bytes were on their way to storage, so a reload says the upload stopped. */
    UploadInFlight = "NIVO_UPLOAD_IN_FLIGHT",
}

/** The cookie that remembers the last workspace the person opened, so the front address leads back to it. */
export const WORKSPACE_COOKIE = "NIVO_WORKSPACE"
