/** Fixed document identity and time shared by the source row and its expected views. */
const WS = "11111111-1111-4111-8111-111111111111"
const AT = "2026-10-12T10:00:00.000Z"

/** A queued text document, with every persisted column. */
export const row = {
    id: "s1",
    workspace_id: WS,
    module: null,
    installation_id: null,
    kind: "text",
    topic: null,
    tags: [],
    visibility: "internal",
    title: "T",
    content: "c",
    status: "queued",
    error: null,
    chunk_count: 0,
    progress: 0,
    storage_path: null,
    source_url: null,
    origin: null,
    created_by: null,
    created_at: AT,
    updated_at: AT,
}
/** The independent expected list view. */
export const summary = {
    id: "s1",
    workspaceId: WS,
    module: null,
    installationId: null,
    kind: "text",
    topic: null,
    tags: [],
    visibility: "internal",
    title: "T",
    status: "queued",
    error: null,
    chunkCount: 0,
    progress: 0,
    createdAt: "2026-10-11T10:00:00.000Z",
    updatedAt: AT,
}
/** The independent expected readable view. */
export const readable = {
    id: "shared",
    title: "T",
    topic: null,
    kind: "text",
    visibility: "public",
    updatedAt: AT,
    content: "c",
}
